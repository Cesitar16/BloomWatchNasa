# src/dataset_inspector.py
"""
dataset_inspector.py
---------------------------------
Explora datasets de Google Earth Engine y lista sus bandas.
"""

import os
import sys
import ee

# Asegurar que el paquete raíz esté en sys.path
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.append(ROOT)

from src.gee_auth import initialize_gee


def list_bands(dataset_id: str) -> None:
    """Lista las bandas del primer elemento de una colección."""
    try:
        col = ee.ImageCollection(dataset_id)
        img = col.first()
        if img is None:
            print(f"⚠️ No se encontraron imágenes en el dataset: {dataset_id}")
            return

        bands = img.bandNames().getInfo()
        print(f"\n🛰️ Dataset: {dataset_id}")
        print(f"📊 Bandas disponibles ({len(bands)}):")
        for b in bands:
            print(f"   - {b}")

        info = img.getInfo()
        if "properties" in info:
            props = list(info["properties"].keys())[:10]
            print(f"ℹ️ Ejemplo de propiedades: {props}")

    except Exception as e:
        print(f"❌ Error consultando {dataset_id}: {e}")


def inspect_all_common_datasets() -> None:
    """Consulta rápida de bandas en los datasets usados en BloomWatch."""
    datasets = [
        "MODIS/061/MOD13Q1",                    # NDVI Vegetación
        "MODIS/061/MOD11A2",                    # LST
        "COPERNICUS/S2_SR_HARMONIZED",          # Sentinel-2 SR
        "NASA/GPM_L3/IMERG_V07",                # Precipitación
        "NASA_USDA/HSL/SMAP10KM_soil_moisture"  # Humedad del suelo
    ]
    print("🔍 Inspeccionando datasets satelitales...\n")
    for ds in datasets:
        list_bands(ds)
    print("\n✅ Inspección completada.")


if __name__ == "__main__":
    initialize_gee()
    inspect_all_common_datasets()
