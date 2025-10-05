# src/analysis.py
from pathlib import Path
import pandas as pd
import numpy as np

NDVI_CSV = Path("data/raw/modis_ndvi_monthly.csv")
OUT_DIR  = Path("data/processed")

def _load_ndvi():
    if not NDVI_CSV.exists():
        print(f"⚠️ No existe {NDVI_CSV}. Corre primero la descarga.")
        return None, None
    df = pd.read_csv(NDVI_CSV)
    date_col = "date" if "date" in df.columns else ("fecha" if "fecha" in df.columns else None)
    if date_col is None or "NDVI" not in df.columns:
        print("⚠️ El CSV NDVI no tiene columnas esperadas ('date'/'fecha' y 'NDVI').")
        return None, None
    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
    df = df.dropna(subset=[date_col, "NDVI"]).sort_values(date_col).reset_index(drop=True)
    df.rename(columns={date_col: "date"}, inplace=True)
    return df, "date"

def analyze_bloom_season(mode: str = "global") -> str | None:
    """
    Detecta floración por año según umbral:
      - mode='global': umbral = p75 de toda la serie.
      - mode='annual': umbral por cada año = p75 del NDVI de ese año.
    Genera:
      data/processed/bloom_periods_global.csv   o
      data/processed/bloom_periods_annual.csv
    """
    df, date_col = _load_ndvi()
    if df is None:
        return None

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    periods = []
    if mode == "global":
        thr_global = float(np.nanpercentile(df["NDVI"], 75))
        print(f"🌿 Umbral de floración GLOBAL (percentil 75): {thr_global:.3f}")
        for year, g in df.groupby(df[date_col].dt.year, group_keys=False):
            g = g[["date", "NDVI"]].dropna().sort_values("date")
            if g.empty or not (g["NDVI"] >= thr_global).any():
                periods.append({"year": int(year), "bloom_start": None, "bloom_end": None,
                                "duration_days": 0, "threshold": thr_global})
                continue
            over = g["NDVI"] >= thr_global
            idx_first = over.idxmax()
            idx_last  = over[::-1].idxmax()
            start = g.loc[idx_first, "date"]
            end   = g.loc[idx_last,  "date"]
            duration = max(0, int((end - start).days))
            print(f"🌸 {year}: floración entre {start.date()} y {end.date()} ({duration} días)")
            periods.append({"year": int(year),
                            "bloom_start": start.date().isoformat(),
                            "bloom_end": end.date().isoformat(),
                            "duration_days": duration,
                            "threshold": thr_global})
        out_path = OUT_DIR / "bloom_periods_global.csv"

    elif mode == "annual":
        print("🌿 Umbral de floración ANUAL (percentil 75 por año)")
        for year, g in df.groupby(df[date_col].dt.year, group_keys=False):
            g = g[["date", "NDVI"]].dropna().sort_values("date")
            if g.empty:
                periods.append({"year": int(year), "bloom_start": None, "bloom_end": None,
                                "duration_days": 0, "threshold": None})
                continue
            thr_y = float(np.nanpercentile(g["NDVI"], 75))
            over = g["NDVI"] >= thr_y
            if not over.any():
                periods.append({"year": int(year), "bloom_start": None, "bloom_end": None,
                                "duration_days": 0, "threshold": thr_y})
                continue
            idx_first = over.idxmax()
            idx_last  = over[::-1].idxmax()
            start = g.loc[idx_first, "date"]
            end   = g.loc[idx_last,  "date"]
            duration = max(0, int((end - start).days))
            print(f"🌸 {year}: floración entre {start.date()} y {end.date()} ({duration} días)")
            periods.append({"year": int(year),
                            "bloom_start": start.date().isoformat(),
                            "bloom_end": end.date().isoformat(),
                            "duration_days": duration,
                            "threshold": thr_y})
        out_path = OUT_DIR / "bloom_periods_annual.csv"

    else:
        print("⚠️ Modo no reconocido. Usa 'global' o 'annual'.")
        return None

    pd.DataFrame(periods, columns=["year","bloom_start","bloom_end","duration_days","threshold"]).to_csv(out_path, index=False)
    print(f"✅ Resultados guardados en {out_path}")
    return str(out_path)
