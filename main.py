# main.py
"""
BloomWatch - NASA Space Apps 2025
Autor: César Rojas Ramos
---------------------------------
Menú interactivo:
  1) Descargar datos por satélite
  2) Analizar floración (GLOBAL o ANUAL)
  3) Graficar (serie completa o año específico)
  4) Ejecutar TODO
  5) Inspeccionar datasets
"""

import os
import sys
import traceback

from src.gee_auth import initialize_gee
from src.data_collector import export_all, DOWNLOAD_FUNCTIONS
from src.analysis import analyze_bloom_season, correlate_rain_ndvi
from src.visualization import plot_ndvi_trends, plot_ndvi_year
from src.dataset_inspector import inspect_all

def _input(prompt: str) -> str:
    try:
        return input(prompt)
    except EOFError:
        return ""

def _ensure_dirs():
    os.makedirs("data/raw", exist_ok=True)
    os.makedirs("data/processed", exist_ok=True)
    os.makedirs("data/results", exist_ok=True)

def menu_download():
    if not DOWNLOAD_FUNCTIONS:
        print("⚠️ No hay funciones de descarga configuradas en src/data_collector.py")
        return

    print("\n=== ¿Qué satélites quieres descargar? ===")
    key_order = list(DOWNLOAD_FUNCTIONS.keys())
    for i, k in enumerate(key_order, start=1):
        print(f"{i}) {DOWNLOAD_FUNCTIONS[k]['label']:40s} [{k}]")
    print("a) Todos")

    choice = _input("\n👉 Elige (ej: 1,3 o claves: modis_ndvi,gpm o 'a'): ").strip().lower()
    if choice == "a":
        selected = key_order
    else:
        if any(c.isalpha() for c in choice):
            selected = [c.strip() for c in choice.split(",") if c.strip() in DOWNLOAD_FUNCTIONS]
        else:
            idxs = [int(x) for x in choice.split(",") if x.strip().isdigit()]
            selected = [key_order[i-1] for i in idxs if 1 <= i <= len(key_order)]

    if not selected:
        print("⚠️ Selección vacía.")
        return

    print("\n🛰️ Descargando y procesando datasets seleccionados...")
    for k in selected:
        meta = DOWNLOAD_FUNCTIONS[k]
        print(f"📦 Procesando {k} – {meta['label']} ...")
        try:
            path, n = meta["fn"]()
            print(f"✅ Exportado: {path} ({n} registros)")
        except Exception as e:
            print(f"⚠️ Error procesando {k}: {e}")

def menu_analyze():
    print("\n=== Modo de análisis de floración ===")
    print("1) Global (umbral p75 de toda la serie)")
    print("2) Anual  (umbral p75 por año)")
    ch = _input("\n👉 Elige (1/2): ").strip()
    mode = "annual" if ch == "2" else "global"
    out = analyze_bloom_season(mode=mode)
    if out:
        print(f"🧾 Archivo de resultados: {out}")

def menu_plot():
    print("\n=== Gráficos ===")
    print("1) Tendencia NDVI + franjas de floración (usar último análisis disponible)")
    print("2) Gráfico de un año específico")
    ch = _input("\n👉 Elige (1/2): ").strip()
    if ch == "2":
        y = _input("🔢 Año (ej. 2018): ").strip()
        try:
            year = int(y)
        except ValueError:
            print("⚠️ Año inválido.")
            return
        plot_ndvi_year(year)
    else:
        plot_ndvi_trends()

def run_all():
    # Descarga todo, analiza GLOBAL y ANUAL y genera ambos gráficos
    for k, meta in DOWNLOAD_FUNCTIONS.items():
        print(f"📦 Procesando {k} – {meta['label']} ...")
        try:
            path, n = meta["fn"]()
            print(f"✅ Exportado: {path} ({n} registros)")
        except Exception as e:
            print(f"⚠️ Error procesando {k}: {e}")

    # análisis
    g_csv = analyze_bloom_season(mode="global")
    a_csv = analyze_bloom_season(mode="annual")

    # gráficos
    plot_ndvi_trends(g_csv)
    plot_ndvi_trends(a_csv)

def main():
    print("=" * 60)
    print("🌎 BLOOMWATCH - NASA HACKATHON | ANÁLISIS DE FLORACIÓN 2015–2025")
    print("=" * 60)

    try:
        print("\n🔐 Iniciando conexión con Google Earth Engine...")
        initialize_gee()
        _ensure_dirs()
        print("✅ Conexión lista.\n")

        while True:
            print("\n=== MENÚ PRINCIPAL ===")
            print("1) Extraer datos satelitales (selección por satélite)")
            print("2) Analizar floración (GLOBAL / ANUAL)")
            print("3) Generar gráficos")
            print("4) Ejecutar TODO el flujo (extraer + analizar + graficar)")
            print("5) Inspeccionar datasets disponibles")
            print("6) Correlación lluvia→NDVI (lags 0/+1/+2)")
            print("0) Salir\n")

            opt = _input("👉 Elige una opción: ").strip()
            if opt == "1":
                menu_download()
            elif opt == "2":
                menu_analyze()
            elif opt == "3":
                menu_plot()
            elif opt == "4":
                run_all()
            elif opt == "5":
                inspect_all()
            elif opt == '6':
                # NUEVO: calcular correlación lluvia→NDVI
                try:
                    correlate_rain_ndvi()  # usa los CSV de modis_ndvi_monthly.csv y gpm_precip_monthly.csv
                except Exception as e:
                    print(f"⚠️ Error en correlación: {e}")
            elif opt == "0":
                break
            else:
                print("⚠️ Opción inválida.")

    except Exception as e:
        print("\n❌ Error en el flujo principal:")
        print(str(e))
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
