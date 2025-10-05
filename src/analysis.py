# src/analysis.py
import os
import pandas as pd
import numpy as np

RAW_DIR = "data/raw"
PROC_DIR = "data/processed"
os.makedirs(PROC_DIR, exist_ok=True)

def _detect_bloom(df, thr):
    """
    Devuelve inicio/fin como primeras/últimas fechas con NDVI >= thr
    (en la serie/segmento entregado).
    """
    mask = df["NDVI"] >= thr
    if not mask.any():
        return None, None
    on  = df.loc[mask, "date"].min()
    off = df.loc[mask, "date"].max()
    return on, off

def analyze_bloom_season(mode="global"):
    """
    mode: 'global' (umbral p75 en toda la serie)
          'annual' (umbral p75 por año)
    Además genera un CSV de sensibilidad (p65,p75,p80) si mode='global'.
    """
    ndvi_csv = os.path.join(RAW_DIR, "modis_ndvi_monthly.csv")
    if not os.path.exists(ndvi_csv):
        raise FileNotFoundError("Falta data/raw/modis_ndvi_monthly.csv (descarga MODIS NDVI primero)")

    df = pd.read_csv(ndvi_csv)
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").dropna(subset=["NDVI"])

    out_csv = None
    if mode == "global":
        thr = df["NDVI"].quantile(0.75)
        rows = []
        for y, g in df.groupby(df["date"].dt.year, group_keys=False):
            on, off = _detect_bloom(g, thr)
            if on is not None:
                duration = (off - on).days
                print(f"🌸 {y}: floración entre {on.date()} y {off.date()} ({duration} días)")
                rows.append({"year": y, "bloom_start": on.date(), "bloom_end": off.date(), "duration_days": duration})
        out_csv = os.path.join(PROC_DIR, "bloom_periods_global.csv")
        pd.DataFrame(rows).to_csv(out_csv, index=False)

        # Sensibilidad de umbral
        sens = []
        for q in [0.65, 0.75, 0.80]:
            t = df["NDVI"].quantile(q)
            active = []
            for y, g in df.groupby(df["date"].dt.year, group_keys=False):
                on, off = _detect_bloom(g, t)
                active.append(int(on is not None))
            sens.append({"quantile": q, "years_with_bloom": sum(active), "years_total": len(active)})
        pd.DataFrame(sens).to_csv(os.path.join(PROC_DIR, "bloom_threshold_sensitivity.csv"), index=False)

    else:  # annual
        rows = []
        for y, g in df.groupby(df["date"].dt.year, group_keys=False):
            thr = g["NDVI"].quantile(0.75)
            on, off = _detect_bloom(g, thr)
            if on is not None:
                duration = (off - on).days
                print(f"🌸 {y}: floración entre {on.date()} y {off.date()} ({duration} días)")
                rows.append({"year": y, "bloom_start": on.date(), "bloom_end": off.date(), "duration_days": duration})
        out_csv = os.path.join(PROC_DIR, "bloom_periods_annual.csv")
        pd.DataFrame(rows).to_csv(out_csv, index=False)

    if out_csv:
        print(f"✅ Resultados guardados en {out_csv}")
    return out_csv

def correlate_rain_ndvi(
    features_csv: str = "data/processed/features_monthly.csv",
    out_csv: str = "data/processed/rain_ndvi_correlation.csv",
    max_lag: int = 2,
):
    """
    Correlación Pearson entre precipitación mensual y NDVI usando la tabla maestra.
    Calcula lags positivos (lluvia adelantada 0, +1, +2 meses).
    Guarda un CSV con r y n_pares por cada lag.
    """
    if not os.path.exists(features_csv):
        print(f"⚠️ No existe {features_csv}. Construye primero la tabla maestra (menú 7).")
        return None

    df = pd.read_csv(features_csv)
    # Tipos y orden
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.sort_values("date").reset_index(drop=True)

    # Forzar numéricos por si vinieron como string
    for col in ["NDVI", "precip_mm"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    if "NDVI" not in df.columns or "precip_mm" not in df.columns:
        print("⚠️ La tabla maestra no tiene columnas 'NDVI' y/o 'precip_mm'.")
        return None

    # Filtrar al intervalo 2015-01 a 2025-12 por si hay ruido
    df = df[(df["date"].dt.year >= 2015) & (df["date"].dt.year <= 2025)].copy()

    # Base limpia
    base = df[["date", "NDVI", "precip_mm"]].dropna(subset=["NDVI", "precip_mm"]).copy()

    rows = []
    for lag in range(0, max_lag + 1):
        # Shift positivo: lluvia de meses previos afecta NDVI futuro
        tmp = base.copy()
        tmp["precip_lag"] = tmp["precip_mm"].shift(lag)

        # Quitamos filas sin ambos valores
        tmp = tmp.dropna(subset=["NDVI", "precip_lag"])

        # Si la varianza es ~0 en alguna serie, la correlación no está definida
        if len(tmp) < 3 or np.isclose(tmp["precip_lag"].std(ddof=1), 0.0) or np.isclose(tmp["NDVI"].std(ddof=1), 0.0):
            r = np.nan
        else:
            r = tmp["precip_lag"].corr(tmp["NDVI"], method="pearson")

        rows.append({"lag_months": lag, "r_pearson": r, "n_pairs": int(len(tmp))})

    out_df = pd.DataFrame(rows)
    os.makedirs(os.path.dirname(out_csv), exist_ok=True)
    out_df.to_csv(out_csv, index=False)

    # Log bonito
    for _, row in out_df.iterrows():
        r_txt = f"{row['r_pearson']:.3f}" if pd.notna(row["r_pearson"]) else "NaN"
        print(f"📊 Correlación lluvia → NDVI (lag {int(row['lag_months'])}): r = {r_txt} (n={int(row['n_pairs'])})")

    print(f"✅ Guardado: {out_csv}")
    return out_csv