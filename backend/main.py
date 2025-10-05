"""FastAPI application exposing BloomWatch analyses to the frontend."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, List, Optional

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from src import data_collector

from main import ensure_initialized, execute_menu_option, get_menu_options

from .schemas import (
    AOIGeometry,
    ApiError,
    BloomAnalysisRequest,
    BloomSummary,
    CorrelationRequest,
    DatasetListItem,
    MenuOption,
    PlotItem,
    PlotRequest,
    RainNdviCorrelation,
    TimeSeriesPoint,
)

RAW_DIR = Path("data/raw")
PROC_DIR = Path("data/processed")
RESULTS_DIR = Path("data/results")

app = FastAPI(title="BloomWatch API", version="0.1.0")

# Allow local dev setups to connect easily
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event() -> None:
    """Ensure the CLI pipeline is initialized once the API boots."""

    try:
        ensure_initialized()
    except Exception:
        # La inicialización puede requerir credenciales interactivas en entornos sin GEE.
        pass


def _rows_in_csv(path: Path) -> int | None:
    try:
        return sum(1 for _ in path.open()) - 1
    except FileNotFoundError:
        return None
    except Exception:
        return None


def _load_dataframe(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"No se encontró el archivo {path}")
    try:
        return pd.read_csv(path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error al leer {path}: {exc}") from exc


def _available_csvs(base: Path, kind: str) -> Iterable[DatasetListItem]:
    for csv in sorted(base.glob("*.csv")):
        rows = _rows_in_csv(csv)
        yield DatasetListItem(name=csv.name, path=str(csv), kind=kind, rows=rows)


def _plot_type_from_name(name: str) -> str:
    stem = Path(name).stem
    if stem.startswith("ndvi_trend"):
        return "ndvi_trend"
    if stem.startswith("ndvi_rain_"):
        return "ndvi_rain_year"
    if stem.startswith("ndvi_"):
        return "ndvi_year"
    if stem.startswith("features"):
        return "features_overview"
    return "ndvi_trend"


def _year_from_name(name: str) -> Optional[int]:
    stem = Path(name).stem
    for piece in stem.split("_"):
        if piece.isdigit() and len(piece) == 4:
            return int(piece)
    return None


def _plot_item_from_path(path: Path, forced_type: Optional[str] = None) -> PlotItem:
    plot_type = forced_type or _plot_type_from_name(path.name)
    generated_at: Optional[str] = None
    try:
        generated_at = datetime.fromtimestamp(
            path.stat().st_mtime, tz=timezone.utc
        ).isoformat()
    except OSError:
        generated_at = None

    year = _year_from_name(path.name)
    if plot_type not in {"ndvi_year", "ndvi_rain_year"}:
        year = None

    return PlotItem(
        name=path.name,
        plot_type=plot_type,
        path=str(path),
        url=f"/plots/{path.name}",
        generated_at=generated_at,
        year=year,
    )


def _list_plot_files() -> List[PlotItem]:
    if not RESULTS_DIR.exists():
        return []
    return [_plot_item_from_path(path) for path in sorted(RESULTS_DIR.glob("*.png"))]


@app.get("/health")
def health_check() -> dict:
    """Simple liveliness probe."""

    return {"status": "ok"}


@app.get("/menu", response_model=List[MenuOption])
def menu_metadata() -> List[MenuOption]:
    """Expose the CLI menu so the frontend can mirror available actions."""

    return [MenuOption(**item) for item in get_menu_options()]


@app.get("/aoi", response_model=AOIGeometry)
def get_aoi() -> AOIGeometry:
    """Return the AOI polygon as GeoJSON so the frontend can render it."""

    polygon = {
        "type": "Polygon",
        "coordinates": [[list(reversed(coord)) for coord in data_collector.AOI_COORDS]],
    }
    return AOIGeometry(geometry=polygon)


@app.get("/datasets", response_model=List[DatasetListItem])
def list_datasets() -> List[DatasetListItem]:
    """List CSV datasets available in raw and processed folders."""

    raw_items = list(_available_csvs(RAW_DIR, "raw")) if RAW_DIR.exists() else []
    proc_items = list(_available_csvs(PROC_DIR, "processed")) if PROC_DIR.exists() else []
    return raw_items + proc_items


@app.get("/timeseries", response_model=List[TimeSeriesPoint])
def get_timeseries() -> List[TimeSeriesPoint]:
    """Return monthly NDVI and precipitation time-series for charts."""

    candidates = [
        PROC_DIR / "features_monthly.csv",
        RAW_DIR / "modis_ndvi_monthly.csv",
    ]

    table: pd.DataFrame | None = None
    source = None
    for candidate in candidates:
        if candidate.exists():
            table = _load_dataframe(candidate)
            source = candidate
            break

    if table is None:
        return []

    if "date" not in table.columns:
        raise HTTPException(status_code=500, detail=f"El archivo {source} no tiene columna 'date'")

    table["date"] = pd.to_datetime(table["date"], errors="coerce")
    table = table.dropna(subset=["date"]).sort_values("date")

    if "precip_mm" not in table.columns and (RAW_DIR / "gpm_precip_monthly.csv").exists():
        precip = _load_dataframe(RAW_DIR / "gpm_precip_monthly.csv")
        precip["date"] = pd.to_datetime(precip["date"], errors="coerce")
        table = table.merge(precip, on="date", how="left", suffixes=("", "_precip"))
        if "precip_mm_precip" in table.columns:
            table.rename(columns={"precip_mm_precip": "precip_mm"}, inplace=True)

    points: List[TimeSeriesPoint] = []
    for _, row in table.iterrows():
        ndvi_value = row.get("NDVI")
        precip_value = row.get("precip_mm")

        if pd.isna(ndvi_value):
            ndvi_value = None
        if pd.isna(precip_value):
            precip_value = None

        points.append(
            TimeSeriesPoint(
                date=row["date"].strftime("%Y-%m-%d"),
                ndvi=ndvi_value,
                precipitation_mm=precip_value,
            )
        )
    return points


@app.get("/plots", response_model=List[PlotItem])
def list_plots() -> List[PlotItem]:
    """Enumerate plot outputs generated by src/visualization.py."""

    return _list_plot_files()


@app.post("/plots", response_model=PlotItem, responses={400: {"model": ApiError}, 404: {"model": ApiError}})
def generate_plot_from_menu(request: PlotRequest) -> PlotItem:
    """Trigger option 3 of the CLI menu to build visualization assets."""

    if request.plot in {"ndvi_year", "ndvi_rain_year"} and request.year is None:
        raise HTTPException(
            status_code=400,
            detail="Debes indicar 'year' para este tipo de gráfico.",
        )

    try:
        output = execute_menu_option(
            "3",
            plot=request.plot,
            year=request.year,
            results_csv=request.results_csv,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if output is None:
        raise HTTPException(
            status_code=500,
            detail="No se generó ningún archivo de gráfico.",
        )

    path = Path(output)
    if not path.exists():
        raise HTTPException(
            status_code=500,
            detail=f"El archivo {output} no se encuentra en disco.",
        )

    return _plot_item_from_path(path, forced_type=request.plot)


@app.get("/plots/{filename}")
def fetch_plot_image(filename: str):
    """Serve plot PNG files stored under data/results."""

    safe_name = Path(filename).name
    path = RESULTS_DIR / safe_name
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"No existe {safe_name} en data/results.")
    return FileResponse(path, media_type="image/png")


@app.post(
    "/analysis/bloom",
    response_model=List[BloomSummary] | dict,
    responses={404: {"model": ApiError}},
)
def run_bloom_analysis(payload: BloomAnalysisRequest):
    """Trigger the bloom season analysis and return the resulting table."""

    try:
        output = execute_menu_option("2", mode=payload.mode)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if output is None:
        return {"detail": "No se generó ninguna tabla de floración."}

    df = _load_dataframe(Path(output))
    summaries = [
        BloomSummary(
            year=int(row["year"]),
            bloom_start=str(row["bloom_start"]),
            bloom_end=str(row["bloom_end"]),
            duration_days=int(row["duration_days"]),
        )
        for _, row in df.iterrows()
    ]
    return summaries


@app.get("/analysis/bloom", response_model=List[BloomSummary])
def fetch_bloom_analysis():
    """Return the most recent bloom summary available on disk."""

    for filename in ["bloom_periods_global.csv", "bloom_periods_annual.csv"]:
        path = PROC_DIR / filename
        if path.exists():
            df = _load_dataframe(path)
            return [
                BloomSummary(
                    year=int(row["year"]),
                    bloom_start=str(row["bloom_start"]),
                    bloom_end=str(row["bloom_end"]),
                    duration_days=int(row["duration_days"]),
                )
                for _, row in df.iterrows()
            ]
    return []


@app.post("/analysis/correlation", response_model=List[RainNdviCorrelation], responses={404: {"model": ApiError}})
def run_correlation(request: CorrelationRequest):
    """Recalculate the rain/NDVI correlation table."""

    try:
        output = execute_menu_option(
            "6", features_csv=request.features_csv, max_lag=request.max_lag
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if output is None:
        return []
    df = _load_dataframe(Path(output))
    return [
        RainNdviCorrelation(
            lag_months=int(row["lag_months"]),
            r_pearson=(float(row["r_pearson"]) if pd.notna(row["r_pearson"]) else None),
            n_pairs=int(row["n_pairs"]),
        )
        for _, row in df.iterrows()
    ]


@app.get("/analysis/correlation", response_model=List[RainNdviCorrelation])
def fetch_correlation():
    """Return the latest rain/NDVI correlation results if present."""

    path = PROC_DIR / "rain_ndvi_correlation.csv"
    if not path.exists():
        return []
    df = _load_dataframe(path)
    return [
        RainNdviCorrelation(
            lag_months=int(row["lag_months"]),
            r_pearson=(float(row["r_pearson"]) if pd.notna(row["r_pearson"]) else None),
            n_pairs=int(row["n_pairs"]),
        )
        for _, row in df.iterrows()
    ]
