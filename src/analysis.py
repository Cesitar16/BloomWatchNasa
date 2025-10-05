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

def correlate_rain_ndvi():
    """
    Correlación precipitación (GPM) → NDVI (MODIS) con lags 0,+1,+2 meses.
    Usa la tabla maestra si existe; si no, usa los CSV base.
    """
    # Usar features si existe (mejor alineación)
    features = os.path.join(PROC_DIR, "features_monthly.csv")
    if os.path.exists(features):
        df = pd.read_csv(features, parse_dates=["date"])
        df = df.sort_values("date")
        ndvi = df["NDVI"].values
        rain = df["precip_mm"].values
    else:
        ndvi_csv = os.path.join(RAW_DIR, "modis_ndvi_monthly.csv")
        rain_csv = os.path.join(RAW_DIR, "gpm_precip_monthly.csv")
        if not (os.path.exists(ndvi_csv) and os.path.exists(rain_csv)):
            raise FileNotFoundError("Faltan CSV de NDVI o GPM. Descárgalos en el menú 1.")
        nd = pd.read_csv(ndvi_csv, parse_dates=["date"]).sort_values("date")
        gp = pd.read_csv(rain_csv, parse_dates=["date"]).sort_values("date")
        df = pd.merge(nd, gp, on="date", how="inner")
        ndvi = df["NDVI"].values
        rain = df["precip_mm"].values

    def corr_at_lag(l):
        if l == 0:
            a, b = rain, ndvi
        else:
            a, b = rain[:-l], ndvi[l:]
        if len(a) < 3:
            return np.nan
        # correlación de Pearson
        if np.all(np.isnan(a)) or np.all(np.isnan(b)):
            return np.nan
        return np.corrcoef(a, b)[0, 1]

    results = []
    for lag in [0, 1, 2]:
        r = corr_at_lag(lag)
        print(f"📊 Correlación lluvia → NDVI (lag {lag}): r = {np.round(r, 3) if pd.notna(r) else 'NaN'}")
        results.append({"lag_months": lag, "pearson_r": r})

    out = os.path.join(PROC_DIR, "rain_ndvi_correlation.csv")
    pd.DataFrame(results).to_csv(out, index=False)
    print(f"✅ Guardado: {out}")
    return out
