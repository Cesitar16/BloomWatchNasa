# src/dataset_inspector.py
import ee
from src.gee_auth import initialize_gee

DATASETS = [
    "MODIS/061/MOD13Q1",
    "MODIS/061/MOD11A2",
    "COPERNICUS/S2_SR_HARMONIZED",
    "NASA/GPM_L3/IMERG_V07",
    "NASA_USDA/HSL/SMAP10KM_soil_moisture",
]

def _describe(dataset_id: str):
    ic = ee.ImageCollection(dataset_id).limit(1)
    img = ee.Image(ic.first())
    bands = img.bandNames().getInfo() or []
    props = img.propertyNames().getInfo() or []
    print(f"\n🛰️ Dataset: {dataset_id}")
    print(f"📊 Bandas disponibles ({len(bands)}):")
    for b in bands:
        print(f"   - {b}")
    print(f"ℹ️ Ejemplo de propiedades: {props[:10]}")

def inspect_all():
    print("🔍 Inspeccionando datasets satelitales...")
    for ds in DATASETS:
        try:
            _describe(ds)
        except Exception as e:
            print(f"⚠️ Error inspeccionando {ds}: {e}")
    print("\n✅ Inspección completada.")

if __name__ == "__main__":
    initialize_gee()
    inspect_all()
