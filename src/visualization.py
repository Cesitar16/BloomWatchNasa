# src/visualization.py
from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt

NDVI_CSV = Path("data/raw/modis_ndvi_monthly.csv")
PROC_DIR = Path("data/processed")
RES_DIR  = Path("data/results")
RES_DIR.mkdir(parents=True, exist_ok=True)

def _load_ndvi():
    if not NDVI_CSV.exists():
        print(f"⚠️ No existe {NDVI_CSV}")
        return None
    df = pd.read_csv(NDVI_CSV)
    date_col = "date" if "date" in df.columns else ("fecha" if "fecha" in df.columns else None)
    if date_col is None or "NDVI" not in df.columns:
        print("⚠️ NDVI CSV sin columnas esperadas ('date'/'fecha','NDVI').")
        return None
    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
    df = df.dropna(subset=[date_col, "NDVI"]).sort_values(date_col).reset_index(drop=True)
    df.rename(columns={date_col: "date"}, inplace=True)
    return df

def plot_ndvi_trends(results_csv: str | None = None):
    """
    Grafica toda la serie NDVI y sombreos de floración por año.
    Si no se pasa results_csv, intenta el global y, si no existe, el anual.
    """
    df = _load_ndvi()
    if df is None:
        return

    if results_csv is None:
        # prioridad: global -> anual
        candidate_global = PROC_DIR / "bloom_periods_global.csv"
        candidate_annual = PROC_DIR / "bloom_periods_annual.csv"
        if candidate_global.exists():
            results_csv = str(candidate_global)
        elif candidate_annual.exists():
            results_csv = str(candidate_annual)
        else:
            print("⚠️ No hay resultados de floración (global/annual). Ejecuta el análisis primero.")
            return

    bp = pd.read_csv(results_csv)
    plt.figure(figsize=(12, 5))
    plt.plot(df["date"], df["NDVI"], marker="o", linewidth=1.5)
    plt.title("Tendencia NDVI mensual 2015–2025 🌿")
    plt.xlabel("Fecha")
    plt.ylabel("NDVI")

    # sombrear períodos
    for i, row in bp.iterrows():
        if pd.isna(row.get("bloom_start")) or pd.isna(row.get("bloom_end")):
            continue
        try:
            x0 = pd.to_datetime(row["bloom_start"])
            x1 = pd.to_datetime(row["bloom_end"])
            plt.axvspan(x0, x1, alpha=0.25, label="Floración" if i == 0 else None)
        except Exception:
            pass

    plt.grid(True, alpha=0.3)
    plt.legend(loc="best")
    out = RES_DIR / ("ndvi_trend_global.png" if "global" in results_csv else "ndvi_trend_annual.png")
    plt.tight_layout()
    plt.savefig(out, dpi=300)
    print(f"✅ Gráfico guardado en {out}")

def plot_ndvi_year(year: int, results_csv: str | None = None):
    """
    Grafica NDVI de un año específico, marcando la franja de floración.
    Por defecto intenta usar los resultados ANUALES, y si no existen, GLOBAL.
    """
    df = _load_ndvi()
    if df is None:
        return

    if results_csv is None:
        c_annual = PROC_DIR / "bloom_periods_annual.csv"
        c_global = PROC_DIR / "bloom_periods_global.csv"
        if c_annual.exists():
            results_csv = str(c_annual)
        elif c_global.exists():
            results_csv = str(c_global)
        else:
            print("⚠️ No hay resultados de floración (global/annual). Ejecuta el análisis primero.")
            return

    bp = pd.read_csv(results_csv)
    row = bp[bp["year"] == year]
    if row.empty:
        print(f"⚠️ No hay registro de floración para {year} en {results_csv}")
        return
    row = row.iloc[0]

    dfy = df[df["date"].dt.year == year].copy()
    if dfy.empty:
        print(f"⚠️ No hay datos NDVI para el año {year}.")
        return

    plt.figure(figsize=(12, 5))
    plt.plot(dfy["date"], dfy["NDVI"], marker="o", linewidth=1.5)
    plt.title(f"NDVI {year} y ventana de floración 🌿")
    plt.xlabel("Mes")
    plt.ylabel("NDVI")
    plt.grid(True, alpha=0.3)

    if pd.notna(row.get("bloom_start")) and pd.notna(row.get("bloom_end")):
        try:
            x0 = pd.to_datetime(row["bloom_start"])
            x1 = pd.to_datetime(row["bloom_end"])
            plt.axvspan(x0, x1, alpha=0.25, label="Floración")
        except Exception:
            pass

    # ticks por mes
    months = pd.date_range(f"{year}-01-01", f"{year}-12-31", freq="MS")
    plt.xticks(months, [m.strftime("%b") for m in months])

    plt.legend(loc="best")
    out = RES_DIR / f"ndvi_{year}.png"
    plt.tight_layout()
    plt.savefig(out, dpi=300)
    print(f"✅ Gráfico guardado en {out}")
