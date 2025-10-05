# src/data_collector.py
import os
from datetime import datetime
import ee
import pandas as pd

# Rango temporal
START_DATE = "2015-01-01"
END_DATE   = "2025-01-01"

# Directorios
RAW_DIR = "data/raw"
PROCESSED_DIR = "data/processed"
os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)


def get_aoi() -> ee.Geometry:
    """Devuelve el polígono del área de interés (AOI): Llanos de Challe aprox."""
    return ee.Geometry.Polygon([
        [-71.100, -28.000],
        [-71.100, -28.700],
        [-70.500, -28.700],
        [-70.500, -28.000],
        [-71.100, -28.000]
    ])


def _with_year_month(img: ee.Image) -> ee.Image:
    """Anexa propiedades 'year' y 'month' basadas en system:time_start."""
    d = ee.Date(img.get('system:time_start'))
    return img.set({'year': d.get('year'), 'month': d.get('month')})


def reduce_monthly_mean(collection: ee.ImageCollection, band: str) -> ee.ImageCollection:
    """
    Crea compuestos mensuales (mean) para un 'band' dado.
    Devuelve una ImageCollection con imágenes etiquetadas por 'year' y 'month'.
    """
    coll = collection.map(_with_year_month)
    years = ee.List.sequence(2015, 2024)  # 2015..2024 (END_DATE es 2025-01-01)
    months = ee.List.sequence(1, 12)

    def by_year(y):
        def by_month(m):
            filtered = coll.filter(ee.Filter.eq('year', y)).filter(ee.Filter.eq('month', m))
            img = filtered.select([band]).mean()
            time = ee.Date.fromYMD(ee.Number(y), ee.Number(m), 1)
            return img.set({'year': y, 'month': m, 'system:time_start': time.millis()})
        return months.map(by_month)

    return ee.ImageCollection(years.map(by_year).flatten())


def export_to_csv(collection: ee.ImageCollection, band: str, filename: str,
                  geometry: ee.Geometry, scale: int) -> pd.DataFrame:
    """
    Reduce los compuestos mensuales a un valor zonal (media) sobre 'geometry' y exporta a CSV.
    (Arreglo: convertir la reducción en Feature con propiedades year/month + valor de 'band')
    """
    def _img_to_feature(img: ee.Image) -> ee.Feature:
        red = img.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=geometry,
            scale=scale,
            maxPixels=1e13
        )
        d = ee.Dictionary(red)
        d = d.set('year', img.get('year'))
        d = d.set('month', img.get('month'))
        return ee.Feature(None, d)

    fc = ee.FeatureCollection(collection.map(_img_to_feature))

    # Extraer arrays
    values = fc.aggregate_array(band).getInfo()
    years  = fc.aggregate_array('year').getInfo()
    months = fc.aggregate_array('month').getInfo()

    # Construir y guardar DataFrame
    df = pd.DataFrame({'year': years, 'month': months, band: values})
    out = os.path.join(RAW_DIR, filename)
    df.to_csv(out, index=False)
    print(f"✅ Exportado: {out} ({len(df)} registros)")
    return df


# -------------------- Procesadores por dataset --------------------

def _sentinel2_mask_and_ndvi(img: ee.Image) -> ee.Image:
    """Enmascara nubes/hielo (básico) y calcula NDVI para Sentinel-2 SR Harmonized."""
    # Cloud probability < 40
    cld_ok = img.select('MSK_CLDPRB').lt(40)
    # Quitar clases SCL problemáticas
    scl = img.select('SCL')
    bad = (scl.eq(3)  # sombra
           .Or(scl.eq(8))  # nubes medias
           .Or(scl.eq(9))  # nubes altas
           .Or(scl.eq(10)) # cirros
           .Or(scl.eq(11)))# nieve/hielo
    mask = cld_ok.And(bad.Not())
    img = img.updateMask(mask)

    ndvi = img.normalizedDifference(['B8', 'B4']).rename('NDVI')
    return ndvi.copyProperties(img, ['system:time_start'])


def process_dataset(name: str, dataset_id: str, band: str,
                    geometry: ee.Geometry, scale: int) -> dict:
    """
    Procesa y exporta un dataset satelital: filtra, compone mensual y guarda CSV.
    Devuelve resumen: {count_months, csv} o {error}.
    """
    try:
        coll = ee.ImageCollection(dataset_id)\
            .filterBounds(geometry)\
            .filterDate(START_DATE, END_DATE)

        # Sentinel-2: derivar NDVI
        if name == 'sentinel2_sr':
            coll = coll.map(_sentinel2_mask_and_ndvi)
            band = 'NDVI'

        monthly = reduce_monthly_mean(coll, band)
        df = export_to_csv(monthly, band, f"{name}_monthly.csv", geometry, scale)
        return {'count_months': len(df), 'csv': f"data/raw/{name}_monthly.csv"}
    except Exception as e:
        print(f"⚠️ Error procesando {name}: {e}")
        return {'error': str(e)}


def export_all() -> dict:
    """
    Descarga y exporta todos los datasets necesarios a CSV (mensualizados).
    """
    aoi = get_aoi()

    SCALES = {
        'modis_ndvi': 250,
        'sentinel2_sr': 20,
        'modis_lst': 1000,
        'gpm_precip': 10000,
        'smap_soil': 10000,
    }

    datasets = {
        "modis_ndvi":  ("MODIS/061/MOD13Q1", "NDVI"),
        "sentinel2_sr": ("COPERNICUS/S2_SR_HARMONIZED", "NDVI"),
        "modis_lst":   ("MODIS/061/MOD11A2", "LST_Day_1km"),
        "gpm_precip":  ("NASA/GPM_L3/IMERG_V07", "precipitation"),
        "smap_soil":   ("NASA_USDA/HSL/SMAP10KM_soil_moisture", "ssm"),
    }

    out = {}
    for name, (ds_id, band) in datasets.items():
        print(f"📦 Procesando {name}...")
        out[name] = process_dataset(name, ds_id, band, aoi, SCALES[name])

    # Resumen rápido
    summary_path = os.path.join(PROCESSED_DIR, "summary_datasets.csv")
    pd.DataFrame(
        [{'dataset': k, **v} if isinstance(v, dict) else {'dataset': k, 'status': str(v)} for k, v in out.items()]
    ).to_csv(summary_path, index=False)
    print(f"\n🧾 Resumen exportado: {summary_path}")

    return out
