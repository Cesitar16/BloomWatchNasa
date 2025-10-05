# src/data_collector.py
import os
from datetime import datetime
import ee
import pandas as pd

# -------------------------------
# Configuración general del área (solo coordenadas, sin objetos EE en import)
# -------------------------------
AOI_COORDS = [
    [-71.100, -28.000],
    [-70.450, -28.000],
    [-70.450, -27.600],
    [-71.100, -27.600],
    [-71.100, -28.000],
]

START_DATE = "2015-01-01"
END_DATE   = "2025-12-31"

RAW_DIR = os.path.join("data", "raw")
os.makedirs(RAW_DIR, exist_ok=True)

def get_aoi() -> ee.Geometry:
    """Construye el AOI como Geometry de EE (llamar solo después de initialize_gee)."""
    return ee.Geometry.Polygon([AOI_COORDS])

# -------------------------------
# Utilidades
# -------------------------------
def _series_from_collection_mean(ic: ee.ImageCollection, band: str, aoi: ee.Geometry, scale_multip=1.0):
    """
    Reduce cada imagen a media sobre AOI, saca 'date' (YYYY-MM-01) y 'value',
    y devuelve un DataFrame mensual (promedio si la colección es 8/16-días).
    """
    def per_img(img):
        mean = img.select(band).reduceRegion(
            reducer=ee.Reducer.mean(), geometry=aoi, scale=1000, bestEffort=True
        ).get(band)
        date_str = ee.Date(img.get('system:time_start')).format('YYYY-MM-01')
        return img.set({'date': date_str, 'value': mean})

    ic2 = ic.map(per_img)
    dates = ee.List(ic2.aggregate_array('date')).getInfo() or []
    vals  = ee.List(ic2.aggregate_array('value')).getInfo() or []

    df = pd.DataFrame({'date': dates, 'value': vals})
    df = df.dropna()
    df['date'] = pd.to_datetime(df['date'], errors='coerce')
    df['value'] = pd.to_numeric(df['value'], errors='coerce') * scale_multip
    df = df.dropna().sort_values('date')

    # Promedio mensual
    df_m = df.groupby(df['date'].dt.to_period('M'))['value'].mean().reset_index()
    df_m['date'] = df_m['date'].dt.to_timestamp()
    return df_m

# -------------------------------
# Descargas por dataset
# -------------------------------
def download_modis_ndvi():
    """NDVI MODIS (MOD13Q1, escala 0.0001) → data/raw/modis_ndvi_monthly.csv"""
    aoi = get_aoi()
    ic = (ee.ImageCollection('MODIS/061/MOD13Q1')
          .filterDate(START_DATE, END_DATE)
          .filterBounds(aoi)
          .select('NDVI'))
    df = _series_from_collection_mean(ic, 'NDVI', aoi, scale_multip=0.0001)
    df.rename(columns={'value': 'NDVI'}, inplace=True)
    out = os.path.join(RAW_DIR, 'modis_ndvi_monthly.csv')
    df.to_csv(out, index=False)
    return out, len(df)

def download_modis_lst():
    """LST día MODIS (MOD11A2, escala 0.02K → °C) → data/raw/modis_lst_monthly.csv"""
    aoi = get_aoi()
    ic = (ee.ImageCollection('MODIS/061/MOD11A2')
          .filterDate(START_DATE, END_DATE)
          .filterBounds(aoi)
          .select('LST_Day_1km'))
    df = _series_from_collection_mean(ic, 'LST_Day_1km', aoi, scale_multip=0.02)
    df['LST_C'] = df['value'] - 273.15
    df = df[['date', 'LST_C']]
    out = os.path.join(RAW_DIR, 'modis_lst_monthly.csv')
    df.to_csv(out, index=False)
    return out, len(df)

def download_gpm_precip_monthly():
    """Precipitación mensual IMERG V07 → data/raw/gpm_precip_monthly.csv"""
    aoi = get_aoi()
    ic = (ee.ImageCollection('NASA/GPM_L3/IMERG_MONTHLY_V07')
          .filterDate(START_DATE, END_DATE)
          .filterBounds(aoi)
          .select('precipitation'))
    df = _series_from_collection_mean(ic, 'precipitation', aoi, scale_multip=1.0)
    df.rename(columns={'value': 'precip_mm'}, inplace=True)
    out = os.path.join(RAW_DIR, 'gpm_precip_monthly.csv')
    df.to_csv(out, index=False)
    return out, len(df)

def download_smap_soil():
    """Humedad superficial del suelo SMAP (ssm) → data/raw/smap_soil_monthly.csv"""
    aoi = get_aoi()
    ic = (ee.ImageCollection('NASA_USDA/HSL/SMAP10KM_soil_moisture')
          .filterDate(START_DATE, END_DATE)
          .filterBounds(aoi)
          .select('ssm'))
    df = _series_from_collection_mean(ic, 'ssm', aoi, scale_multip=1.0)
    df.rename(columns={'value': 'soil_moisture'}, inplace=True)
    out = os.path.join(RAW_DIR, 'smap_soil_monthly.csv')
    df.to_csv(out, index=False)
    return out, len(df)

# -------------------------------
# Tabla para el menú
# -------------------------------
DOWNLOAD_FUNCTIONS = {
    "modis_ndvi": {
        "label": "MODIS NDVI (MOD13Q1)",
        "fn": download_modis_ndvi
    },
    "modis_lst": {
        "label": "MODIS LST día (MOD11A2)",
        "fn": download_modis_lst
    },
    "gpm": {
        "label": "GPM IMERG V07 mensual (precipitación)",
        "fn": download_gpm_precip_monthly
    },
    "smap": {
        "label": "SMAP 10km (humedad superficial del suelo, ssm)",
        "fn": download_smap_soil
    },
}

# -------------------------------
# Exportar todos (pipeline rápido)
# -------------------------------
def export_all():
    results = {}
    for k, meta in DOWNLOAD_FUNCTIONS.items():
        try:
            path, n = meta["fn"]()
            results[k] = {"status": "ok", "rows": n, "path": path}
        except Exception as e:
            results[k] = {"status": "error", "error": str(e)}
    # Guardar resumen
    os.makedirs(os.path.join("data", "processed"), exist_ok=True)
    summary_path = os.path.join("data", "processed", "summary_datasets.csv")
    pd.DataFrame([{"dataset": k, **v} for k, v in results.items()]).to_csv(summary_path, index=False)
    return results
