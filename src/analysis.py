# src/analysis.py
import os
import pandas as pd
import numpy as np

RAW_DIR = "data/raw"
PROC_DIR = "data/processed"
os.makedirs(PROC_DIR, exist_ok=True)


# ---------------------------------------------------------------------
# (Tu función existente) – la mantienes como estaba
# ---------------------------------------------------------------------
def analyze_bloom_season(mode='global', ndvi_csv=None, out_csv=None):
    """
    mode: 'global' (p75 de toda la serie) o 'annual' (p75 por año).
    Lee NDVI mensual desde CSV y escribe archivo con periodos de floración.
    """
    if ndvi_csv is None:
        ndvi_csv = os.path.join(RAW_DIR, 'modis_ndvi_monthly.csv')
    df = pd.read_csv(ndvi_csv)
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date').reset_index(drop=True)

    # por si viene NDVI en otra columna (Sentinel)
    value_col = 'NDVI' if 'NDVI' in df.columns else df.columns[-1]

    results = []
    if mode == 'global':
        thr = df[value_col].quantile(0.75)
        in_bloom = df[value_col] >= thr
        if in_bloom.any():
            s = df.loc[in_bloom, 'date'].min()
            e = df.loc[in_bloom, 'date'].max()
            days = int((e - s).days)
            results.append({'year': s.year, 'bloom_start': s.date(), 'bloom_end': e.date(), 'duration_days': days})
        out = out_csv or os.path.join(PROC_DIR, 'bloom_periods_global.csv')
    else:
        # anual
        years = df['date'].dt.year.unique()
        for y in years:
            g = df[df['date'].dt.year == y].copy()
            if g.empty: 
                continue
            thr = g[value_col].quantile(0.75)
            m = g[g[value_col] >= thr]
            if m.empty: 
                continue
            s = m['date'].min()
            e = m['date'].max()
            days = int((e - s).days)
            results.append({'year': y, 'bloom_start': s.date(), 'bloom_end': e.date(), 'duration_days': days})
        out = out_csv or os.path.join(PROC_DIR, 'bloom_periods_annual.csv')

    pd.DataFrame(results).to_csv(out, index=False)
    print(f"✅ Resultados guardados en {out}")
    return out


# ---------------------------------------------------------------------
# NUEVO: correlación GPM (lluvia) → NDVI con lags
# ---------------------------------------------------------------------
def correlate_rain_ndvi(ndvi_csv=None, rain_csv=None, lags=(0, 1, 2), out_csv=None):
    """
    Calcula la correlación de Pearson entre precipitación mensual (GPM) y NDVI
    probando lags 0, +1, +2 meses (lluvia antecede a NDVI).
    Devuelve ruta del CSV con las correlaciones.
    """
    if ndvi_csv is None:
        ndvi_csv = os.path.join(RAW_DIR, 'modis_ndvi_monthly.csv')
    if rain_csv is None:
        rain_csv = os.path.join(RAW_DIR, 'gpm_precip_monthly.csv')
    if out_csv is None:
        out_csv = os.path.join(PROC_DIR, 'rain_ndvi_correlation.csv')

    ndvi = pd.read_csv(ndvi_csv)
    rain = pd.read_csv(rain_csv)

    ndvi['date'] = pd.to_datetime(ndvi['date'])
    rain['date'] = pd.to_datetime(rain['date'])

    ndvi = ndvi.sort_values('date').reset_index(drop=True)
    rain = rain.sort_values('date').reset_index(drop=True)

    # sacar nombre de columna de NDVI (MODIS o Sentinel)
    ndvi_col = 'NDVI' if 'NDVI' in ndvi.columns else ndvi.columns[-1]
    rain_col = 'precipitation' if 'precipitation' in rain.columns else rain.columns[-1]

    # dataframe base por fecha
    base = pd.DataFrame({'date': pd.date_range(ndvi['date'].min(), ndvi['date'].max(), freq='MS')})
    base = base.merge(ndvi[['date', ndvi_col]], on='date', how='left')
    base = base.merge(rain[['date', rain_col]], on='date', how='left')

    rows = []
    for lag in lags:
        # precip con desplazamiento positivo (lluvia antecede NDVI)
        x = base[rain_col].shift(lag)
        y = base[ndvi_col]
        valid = x.notna() & y.notna()
        if valid.sum() >= 3:
            r = float(np.corrcoef(x[valid], y[valid])[0, 1])
        else:
            r = float('nan')
        rows.append({'lag_months': lag, 'pearson_r': r})

    out_df = pd.DataFrame(rows)
    out_df.to_csv(out_csv, index=False)
    print("📊 Correlación lluvia → NDVI (lags):")
    for _, r in out_df.iterrows():
        print(f"   lag {int(r['lag_months'])} mes(es): r = {r['pearson_r']:.3f}")
    print(f"✅ Guardado: {out_csv}")
    return out_csv
