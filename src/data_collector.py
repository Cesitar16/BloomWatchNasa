# src/data_collector.py
# -*- coding: utf-8 -*-
"""
Descarga/exportación de datasets satelitales para BloomWatch.

Incluye:
- MODIS NDVI con QA (MODIS/061/MOD13Q1)
- Sentinel-2 NDVI mensual (COPERNICUS/S2_SR_HARMONIZED) — ligero y robusto
- MODIS LST día (MODIS/061/MOD11A2)
- GPM IMERG V07 (NASA/GPM_L3/IMERG_V07)
- SMAP humedad del suelo (NASA_USDA/HSL/SMAP10KM_soil_moisture)

Todos exportan CSVs mensuales reducidos al AOI.
"""

import os
from datetime import datetime

import ee
import pandas as pd

# --- Parámetros globales ---
START_DATE = '2015-01-01'
END_DATE   = '2025-01-01'

RAW_DIR = os.path.join('data', 'raw')
os.makedirs(RAW_DIR, exist_ok=True)


# ==========================
# Utilidades comunes
# ==========================

def get_aoi() -> ee.Geometry:
    """AOI: polígono de Llanos de Challe (ejemplo usado hasta ahora)."""
    # Asegúrate de que EE ya esté inicializado antes de importar este módulo
    return ee.Geometry.Polygon([
        [[-71.100, -28.000],
         [-71.100, -27.800],
         [-70.700, -27.800],
         [-70.700, -28.000],
         [-71.100, -28.000]]
    ], None, False)


def _monthly_images(ic: ee.ImageCollection, stat: str = 'mean') -> ee.ImageCollection:
    """
    Genera una colección con una imagen por mes entre START_DATE y END_DATE
    aplicando una estadística: 'mean' | 'median' | 'sum'.
    """
    start = ee.Date(START_DATE)
    end   = ee.Date(END_DATE)

    n_months = end.difference(start, 'month').floor().int()

    def month_image(i):
        i = ee.Number(i)
        month_start = start.advance(i, 'month')
        month_end   = month_start.advance(1, 'month')

        subset = ic.filterDate(month_start, month_end)
        # Seleccionar la operación
        composite = (subset.median() if stat == 'median'
                     else subset.sum() if stat == 'sum'
                     else subset.mean())

        # Colocar time_start para el primer día del mes
        return (composite
                .set('system:time_start', month_start.millis())
                .set('month_str', month_start.format('YYYY-MM')))

    return ee.ImageCollection(ee.List.sequence(0, n_months.subtract(1)).map(month_image))


def _filter_images_with_band(ic: ee.ImageCollection, band: str) -> ee.ImageCollection:
    """
    Devuelve solo las imágenes de la colección que contienen la banda pedida.
    Útil para saltar compositos mensuales que quedaron vacíos.
    """
    ic_flagged = ic.map(lambda img: img.set('hasBand', img.bandNames().contains(band)))
    return ee.ImageCollection(ic_flagged).filter(ee.Filter.eq('hasBand', True))


def _reduce_series_to_dataframe_safe(
    ic: ee.ImageCollection,
    band: str,
    scale: int,
    aoi: ee.Geometry
) -> pd.DataFrame:
    """
    Reduce una serie (colección mensual) al AOI de forma robusta:
    - Si una imagen no tiene la banda, devuelve None y luego se filtra.
    - bestEffort y maxPixels altos para evitar errores.
    """
    def _img_to_feat(img):
        has = img.bandNames().contains(band)
        # Si no tiene la banda, devolvemos ND (None) para luego filtrar
        img_band = ee.Image(ee.Algorithms.If(
            has,
            img.select(band),
            ee.Image.constant(0).rename(band).updateMask(ee.Image(0))
        ))
        red = img_band.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=aoi,
            scale=scale,
            maxPixels=1e13,
            bestEffort=True
        )
        val = ee.Number(red.get(band))
        return ee.Feature(None, {
            'date': ee.Date(img.get('system:time_start')).format('YYYY-MM-dd'),
            band: val
        })

    fc = ee.FeatureCollection(ic.map(_img_to_feat))
    fc = fc.filter(ee.Filter.notNull([band]))

    dates = fc.aggregate_array('date').getInfo()
    vals  = fc.aggregate_array(band).getInfo()

    df = pd.DataFrame({'date': dates, band: vals})
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date').reset_index(drop=True)
    return df


# ==========================
# MODIS NDVI (MOD13Q1) con QA
# ==========================

def _mask_modis_ndvi_with_summaryqa(img: ee.Image) -> ee.Image:
    """
    MODIS/061/MOD13Q1:
    - Usamos SummaryQA: 0=best, 1=good, 2=marginal, 3=cloudy
    - Permitimos 0 y 1 (best/good).
    - NDVI está escalado por 0.0001 → convertimos a float real.
    """
    ndvi_raw = img.select('NDVI')
    qa       = img.select('SummaryQA')

    good = qa.lte(1)
    ndvi  = ndvi_raw.multiply(0.0001).updateMask(good)
    return ndvi.rename('NDVI').copyProperties(img, ['system:time_start'])


def download_modis_ndvi_monthly():
    """
    Exporta NDVI mensual de MODIS (QA aplicado), reduciendo al AOI:
    data/raw/modis_ndvi_monthly.csv
    """
    aoi = get_aoi()

    col = (ee.ImageCollection('MODIS/061/MOD13Q1')
           .filterBounds(aoi)
           .filterDate(START_DATE, END_DATE))

    ndvi_col = col.map(_mask_modis_ndvi_with_summaryqa)

    monthly = _monthly_images(ndvi_col, stat='mean')
    monthly = _filter_images_with_band(monthly, 'NDVI')

    df = _reduce_series_to_dataframe_safe(monthly, 'NDVI', scale=250, aoi=aoi)

    out = os.path.join(RAW_DIR, 'modis_ndvi_monthly.csv')
    df.to_csv(out, index=False)
    return out, len(df)


# ==========================
# Sentinel-2 NDVI mensual “ligero”
# ==========================

def download_sentinel2_monthly_ndvi():
    """
    Sentinel-2 SR Harmonized → NDVI mensual “ligero” con máscara SCL.
    - Tolera imágenes sin B4/B8/SCL (rellena bandas vacías).
    - Mediana mensual.
    - Descarta meses cuyo composite quede sin banda NDVI.
    """
    aoi = get_aoi()

    col = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
           .filterBounds(aoi)
           .filterDate(START_DATE, END_DATE))

    def _ensure_band(img, band_name):
        has = img.bandNames().contains(band_name)
        filler = ee.Image.constant(0).rename(band_name).updateMask(ee.Image(0))
        return ee.Image(ee.Algorithms.If(has, img.select(band_name), filler))

    def add_ndvi_safe(img):
        b4  = _ensure_band(img, 'B4')
        b8  = _ensure_band(img, 'B8')
        scl = _ensure_band(img, 'SCL')

        ndvi = b8.subtract(b4).divide(b8.add(b4)).rename('NDVI')
        ndvi = ndvi.updateMask(b8.add(b4).neq(0))

        # Máscara SCL “ligera”: vegetación(4), suelo(5), agua(6), no clasificado(7)
        good = scl.eq(4).Or(scl.eq(5)).Or(scl.eq(6)).Or(scl.eq(7))
        ndvi = ndvi.updateMask(good)

        return ndvi.copyProperties(img, ['system:time_start'])

    ndvi_col = col.map(add_ndvi_safe)

    monthly = _monthly_images(ndvi_col, stat='median')
    monthly = _filter_images_with_band(monthly, 'NDVI')

    df = _reduce_series_to_dataframe_safe(monthly, 'NDVI', scale=20, aoi=aoi)

    out = os.path.join(RAW_DIR, 'sentinel2_ndvi_monthly.csv')
    df.to_csv(out, index=False)
    return out, len(df)


# ==========================
# MODIS LST (temperatura superficial diurna)
# ==========================

def _modis_lst_to_celsius(img: ee.Image) -> ee.Image:
    """
    MODIS/061/MOD11A2:
    LST_Day_1km tiene factor de escala 0.02 K.
    Convertimos a °C: LST * 0.02 - 273.15
    """
    lst_k = img.select('LST_Day_1km').multiply(0.02)
    lst_c = lst_k.subtract(273.15).rename('LST_Day_C')
    return lst_c.copyProperties(img, ['system:time_start'])


def download_modis_lst_monthly():
    """
    Exporta LST diurna mensual (°C) reducida al AOI:
    data/raw/modis_lst_monthly.csv
    """
    aoi = get_aoi()

    col = (ee.ImageCollection('MODIS/061/MOD11A2')
           .filterBounds(aoi)
           .filterDate(START_DATE, END_DATE))

    lst_col = col.map(_modis_lst_to_celsius)

    monthly = _monthly_images(lst_col, stat='mean')
    monthly = _filter_images_with_band(monthly, 'LST_Day_C')

    df = _reduce_series_to_dataframe_safe(monthly, 'LST_Day_C', scale=1000, aoi=aoi)

    out = os.path.join(RAW_DIR, 'modis_lst_monthly.csv')
    df.to_csv(out, index=False)
    return out, len(df)


# ==========================
# GPM IMERG V07 (precipitación)
# ==========================

def download_gpm_monthly():
    """
    Exporta precipitación mensual (promedio) de IMERG V07:
    data/raw/gpm_precip_monthly.csv
    Nota: IMERG V07 (Final run) es 30-min. / 0.1°. Aquí tomamos promedio mensual.
    """
    aoi = get_aoi()

    col = (ee.ImageCollection('NASA/GPM_L3/IMERG_V07')
           .filterBounds(aoi)
           .filterDate(START_DATE, END_DATE)
           .select('precipitation'))

    monthly = _monthly_images(col, stat='mean')
    monthly = _filter_images_with_band(monthly, 'precipitation')

    df = _reduce_series_to_dataframe_safe(monthly, 'precipitation', scale=10000, aoi=aoi)

    out = os.path.join(RAW_DIR, 'gpm_precip_monthly.csv')
    df.to_csv(out, index=False)
    return out, len(df)


# ==========================
# SMAP (humedad del suelo)
# ==========================

def download_smap_monthly():
    """
    Exporta humedad superficial del suelo SMAP (m3/m3) mensual:
    data/raw/smap_soil_monthly.csv
    """
    aoi = get_aoi()

    col = (ee.ImageCollection('NASA_USDA/HSL/SMAP10KM_soil_moisture')
           .filterBounds(aoi)
           .filterDate(START_DATE, END_DATE)
           .select('ssm'))  # soil surface moisture

    monthly = _monthly_images(col, stat='mean')
    monthly = _filter_images_with_band(monthly, 'ssm')

    df = _reduce_series_to_dataframe_safe(monthly, 'ssm', scale=10000, aoi=aoi)

    out = os.path.join(RAW_DIR, 'smap_soil_monthly.csv')
    df.to_csv(out, index=False)
    return out, len(df)


# ==========================
# Orquestador “export_all” y mapa para el menú
# ==========================

def export_all():
    """
    Ejecuta todos los descargadores disponibles y devuelve un resumen.
    """
    summary = {}

    for key, meta in DOWNLOAD_FUNCTIONS.items():
        label = meta['label']
        fn    = meta['fn']
        try:
            path, n = fn()
            summary[key] = {"label": label, "path": path, "rows": n, "status": "ok"}
        except Exception as e:
            summary[key] = {"label": label, "error": str(e), "status": "error"}

    # Guarda un CSV resumen por comodidad
    try:
        out = os.path.join('data', 'processed', 'summary_datasets.csv')
        os.makedirs(os.path.dirname(out), exist_ok=True)
        # normalizamos a filas
        rows = []
        for k, v in summary.items():
            row = {"dataset": k, "label": v.get("label", "")}
            row.update({kk: vv for kk, vv in v.items() if kk not in ("label",)})
            rows.append(row)
        pd.DataFrame(rows).to_csv(out, index=False)
    except Exception:
        pass

    return summary


# Mapa para el menú del main.py
DOWNLOAD_FUNCTIONS = {
    "modis_ndvi":  {"label": "MODIS NDVI (QA)",                         "fn": download_modis_ndvi_monthly},
    "sentinel2_sr":{"label": "Sentinel-2 NDVI mensual (ligero)",        "fn": download_sentinel2_monthly_ndvi},
    "modis_lst":   {"label": "MODIS LST día",                            "fn": download_modis_lst_monthly},
    "gpm":         {"label": "GPM IMERG V07 precipitación",             "fn": download_gpm_monthly},
    "smap":        {"label": "SMAP humedad superficial",                "fn": download_smap_monthly},
}
