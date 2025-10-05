# main.py
"""
BloomWatch - NASA Space Apps 2025
Autor: César Rojas Ramos
---------------------------------
Flujo principal de extracción, procesamiento y análisis de floración
para el sector Llanos de Challe (Chile) usando Google Earth Engine.
"""

import os
import sys
import traceback
from datetime import datetime
import pandas as pd

from src.gee_auth import initialize_gee
from src.data_collector import export_all
from src.analysis import analyze_bloom_season
from src.visualization import plot_ndvi_trends


def main():
    print("=" * 60)
    print("🌎 BLOOMWATCH - NASA HACKATHON | ANÁLISIS DE FLORACIÓN 2015–2025")
    print("=" * 60)

    start_time = datetime.now()

    try:
        # 1) Autenticación e inicialización
        print("\n🔐 Iniciando conexión con Google Earth Engine...")
        initialize_gee()

        # Asegurar carpetas
        os.makedirs("data/raw", exist_ok=True)
        os.makedirs("data/processed", exist_ok=True)
        os.makedirs("data/results", exist_ok=True)

        # 2) Descarga y exportación de datasets
        print("\n🛰️ Descargando y procesando datasets (MODIS, Sentinel, GPM, SMAP)...")
        datasets_info = export_all()

        # Resumen
        if isinstance(datasets_info, dict) and len(datasets_info) > 0:
            summary_path = "data/processed/summary_datasets.csv"
            pd.DataFrame([
                {"dataset": k, **v} if isinstance(v, dict) else {"dataset": k, "status": str(v)}
                for k, v in datasets_info.items()
            ]).to_csv(summary_path, index=False)
            print(f"\n🧾 Resumen exportado: {summary_path}")
        else:
            print("⚠️ No se pudo generar resumen de datasets (estructura inesperada).")

        # 3) Análisis de floración
        print("\n🌿 Analizando series NDVI para detectar etapas de floración...")
        analyze_bloom_season()

        # 4) Visualización
        print("\n📈 Generando gráficos de tendencia NDVI y floración...")
        plot_ndvi_trends()

        # 5) Fin
        duration = (datetime.now() - start_time).seconds / 60
        print("\n✅ Flujo completado con éxito.")
        print(f"🕒 Duración total: {duration:.2f} minutos")

    except Exception as e:
        print("\n❌ Error en el flujo principal:")
        print(str(e))
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
