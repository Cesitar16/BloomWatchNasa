# src/analysis.py
"""
analysis.py
---------------------------------
Analiza las series de tiempo NDVI para detectar el inicio y fin
de las etapas de floración por año.
"""

import os
import numpy as np
import pandas as pd

RAW_PATH = "data/raw/"
OUTPUT_PATH = "data/processed/bloom_periods.csv"


def analyze_bloom_season() -> None:
    """Analiza la serie NDVI mensual para detectar los periodos de floración."""
    ndvi_file = os.path.join(RAW_PATH, "modis_ndvi_monthly.csv")

    if not os.path.exists(ndvi_file):
        print("⚠️ No se encontró el archivo NDVI. Ejecuta primero data_collector.export_all().")
        return

    print(f"📈 Analizando NDVI desde: {ndvi_file}")
    df = pd.read_csv(ndvi_file)

    if "NDVI" not in df.columns or "year" not in df.columns or "month" not in df.columns:
        print("⚠️ El CSV NDVI no tiene las columnas esperadas ('year','month','NDVI').")
        return

    # Fecha yyyy-mm-01 para graficar coherente
    df["date"] = pd.to_datetime(dict(year=df["year"], month=df["month"], day=1))
    df = df.dropna(subset=["NDVI"]).sort_values("date")

    # Escalado por si viniera sin factor aplicado
    if df["NDVI"].mean() > 1:
        df["NDVI"] = df["NDVI"] * 0.0001

    threshold = df["NDVI"].quantile(0.75)
    print(f"🌿 Umbral de floración (percentil 75): {threshold:.3f}")

    results = []
    for year, g in df.groupby("date.dt.year", group_keys=False):
        g = g.sort_values("date")
        blooming = g[g["NDVI"] > threshold]
        if blooming.empty:
            continue
        start = blooming.iloc[0]["date"].strftime("%Y-%m-%d")
        end   = blooming.iloc[-1]["date"].strftime("%Y-%m-%d")
        results.append({
            "year": int(year),
            "bloom_start": start,
            "bloom_end": end,
            "duration_days": (pd.to_datetime(end) - pd.to_datetime(start)).days
        })
        print(f"🌸 {year}: floración entre {start} y {end} ({results[-1]['duration_days']} días)")

    if results:
        os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
        pd.DataFrame(results).to_csv(OUTPUT_PATH, index=False)
        print(f"✅ Resultados guardados en {OUTPUT_PATH}")
    else:
        print("⚠️ No se detectaron periodos de floración en la serie NDVI.")
