# src/visualization.py
"""
visualization.py
---------------------------------
Visualización de la serie NDVI y detección de floración.
"""

import os
import pandas as pd
import matplotlib.pyplot as plt

RAW_PATH = "data/raw/modis_ndvi_monthly.csv"
BLOOM_PATH = "data/processed/bloom_periods.csv"
OUTPUT_PATH = "data/results/ndvi_trend.png"


def plot_ndvi_trends() -> None:
    """Genera un gráfico de NDVI mensual y resalta periodos de floración."""
    if not os.path.exists(RAW_PATH):
        print("⚠️ Falta el NDVI mensual. Ejecuta export_all() primero.")
        return
    if not os.path.exists(BLOOM_PATH):
        print("⚠️ Falta bloom_periods.csv. Ejecuta analyze_bloom_season() primero.")
        return

    print(f"📈 Generando gráfico desde {RAW_PATH} y {BLOOM_PATH}")

    df = pd.read_csv(RAW_PATH)
    if "date" not in df.columns:
        df["date"] = pd.to_datetime(dict(year=df["year"], month=df["month"], day=1))
    else:
        df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date")

    if df["NDVI"].mean() > 1:
        df["NDVI"] = df["NDVI"] * 0.0001

    bloom_df = pd.read_csv(BLOOM_PATH)

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    plt.figure(figsize=(14, 6))
    plt.plot(df["date"], df["NDVI"], linewidth=1.8, label="NDVI")

    for i, row in bloom_df.iterrows():
        plt.axvspan(pd.to_datetime(row["bloom_start"]),
                    pd.to_datetime(row["bloom_end"]),
                    alpha=0.25,
                    label="Floración" if i == 0 else None)

    plt.title("🌿 Evolución del NDVI (2015–2025) - Llanos de Challe", fontsize=14)
    plt.xlabel("Fecha"); plt.ylabel("NDVI")
    plt.legend(); plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(OUTPUT_PATH, dpi=300)
    plt.close()
    print(f"✅ Gráfico guardado en {OUTPUT_PATH}")
