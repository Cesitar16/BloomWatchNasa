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
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd

from src.gee_auth import initialize_gee
from src.data_collector import DOWNLOAD_FUNCTIONS, build_features_monthly
from src.analysis import analyze_bloom_season, correlate_rain_ndvi
from src.visualization import (
    plot_features_overview,
    plot_features_year,
    plot_ndvi_trends,
    plot_ndvi_year,
    plot_ndvi_forecast,
)
from src.dataset_inspector import inspect_all
from src.prediction_model import train_bloom_predictor

_INITIALIZED = False

def _input(prompt: str) -> str:
    try:
        return input(prompt)
    except EOFError:
        return ""

def _ensure_dirs():
    os.makedirs("data/raw", exist_ok=True)
    os.makedirs("data/processed", exist_ok=True)
    os.makedirs("data/results", exist_ok=True)


def ensure_initialized(force: bool = False) -> None:
    """Inicializa Earth Engine y carpetas solo una vez."""

    global _INITIALIZED
    if _INITIALIZED and not force:
        return

    print("\n🔐 Iniciando conexión con Google Earth Engine...")
    initialize_gee()
    _ensure_dirs()
    _INITIALIZED = True
    print("✅ Conexión lista.\n")


def download_datasets(selected_keys: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """Ejecuta las rutinas de descarga definidas en el menú (opción 1)."""

    if not DOWNLOAD_FUNCTIONS:
        return []

    if selected_keys is None:
        selected_keys = list(DOWNLOAD_FUNCTIONS.keys())

    results: List[Dict[str, Any]] = []
    for key in selected_keys:
        meta = DOWNLOAD_FUNCTIONS.get(key)
        if meta is None:
            results.append(
                {
                    "key": key,
                    "label": None,
                    "status": "error",
                    "error": "Clave de dataset desconocida.",
                }
            )
            continue

        try:
            path, n = meta["fn"]()
            results.append(
                {
                    "key": key,
                    "label": meta.get("label", key),
                    "status": "ok",
                    "path": path,
                    "rows": n,
                }
            )
        except Exception as exc:  # pragma: no cover - logging de CLI
            results.append(
                {
                    "key": key,
                    "label": meta.get("label", key),
                    "status": "error",
                    "error": str(exc),
                }
            )
    return results


def run_bloom_analysis(mode: str = "global") -> Optional[str]:
    """Ejecuta la opción 2 del menú (análisis de floración)."""
    return analyze_bloom_season(mode=mode)


def generate_plot(
    plot: str,
    *,
    year: Optional[int] = None,
    results_csv: Optional[str] = None,
) -> Optional[str]:
    """Genera los gráficos disponibles en la opción 3 del menú."""

    if plot == "ndvi_trend":
        return plot_ndvi_trends(results_csv)
    if plot == "ndvi_year":
        if year is None:
            raise ValueError("Se requiere 'year' para el gráfico NDVI anual.")
        return plot_ndvi_year(year, results_csv)
    if plot == "features_overview":
        return plot_features_overview()
    if plot == "ndvi_rain_year":
        if year is None:
            raise ValueError("Se requiere 'year' para el gráfico NDVI vs lluvia.")
        return plot_features_year(year)

    raise ValueError(f"Tipo de gráfico desconocido: {plot}")


def compute_correlation(
    *, features_csv: str = "data/processed/features_monthly.csv", max_lag: int = 2
) -> Optional[str]:
    """Calcula la correlación lluvia → NDVI (opción 6)."""
    return correlate_rain_ndvi(features_csv=features_csv, max_lag=max_lag)


def build_master_table(include_s2: bool = True) -> Optional[Dict[str, Any]]:
    """Construye la tabla maestra mensual (opción 7)."""
    try:
        out, rows = build_features_monthly(include_s2=include_s2)
        return {"path": out, "rows": rows}
    except Exception as exc:  # pragma: no cover - logging de CLI
        return {"error": str(exc)}


def generate_bloom_predictions(probability_threshold: float = 0.5) -> Dict[str, Any]:
    """Entrena el modelo de predicción y guarda las probabilidades por mes."""

    result = train_bloom_predictor(probability_threshold=probability_threshold)
    table = result.table.copy()
    table["date"] = table["date"].dt.strftime("%Y-%m-%d")

    predictions_path = Path("data/processed/bloom_predictions.csv")
    predictions_path.parent.mkdir(parents=True, exist_ok=True)
    table.to_csv(predictions_path, index=False)

    ndvi_forecast = result.ndvi_forecast.copy()
    ndvi_forecast["date"] = pd.to_datetime(ndvi_forecast["date"])
    ndvi_forecast["date"] = ndvi_forecast["date"].dt.strftime("%Y-%m-%d")

    ndvi_forecast_path = Path("data/processed/ndvi_forecast.csv")
    ndvi_forecast.to_csv(ndvi_forecast_path, index=False)

    forecast_plot: Optional[str] = None
    try:
        forecast_plot = plot_ndvi_forecast(forecast_csv=str(ndvi_forecast_path))
    except Exception as exc:  # pragma: no cover - solo logging
        print(f"⚠️ No fue posible generar el gráfico de pronóstico NDVI: {exc}")

    metadata = result.metadata.copy()
    metadata["predictions_path"] = str(predictions_path)
    metadata["records"] = int(len(table))
    metadata["forecast_records"] = int(len(result.forecast_rows))
    metadata["ndvi_forecast_path"] = str(ndvi_forecast_path)
    if forecast_plot:
        metadata["ndvi_forecast_plot"] = forecast_plot

    return metadata


MENU_METADATA: Dict[str, Dict[str, Any]] = {
    "1": {
        "label": "Extraer datos satelitales",
        "description": "Descarga los conjuntos de datos configurados en src/data_collector.py.",
        "parameters": [
            {
                "name": "selected_keys",
                "required": False,
                "description": "Lista de claves de DOWNLOAD_FUNCTIONS (None para todos).",
            }
        ],
    },
    "2": {
        "label": "Analizar floración",
        "description": "Calcula periodos de floración con umbral global o anual.",
        "parameters": [
            {
                "name": "mode",
                "required": False,
                "description": "Modo de análisis ('global' o 'annual').",
            }
        ],
    },
    "3": {
        "label": "Generar gráficos",
        "description": "Produce gráficos NDVI y series multivariables almacenados en data/results/.",
        "parameters": [
            {"name": "plot", "required": True, "description": "Tipo de gráfico: ndvi_trend, ndvi_year, features_overview o ndvi_rain_year."},
            {"name": "year", "required": False, "description": "Año requerido para ndvi_year o ndvi_rain_year."},
        ],
    },
    "4": {
        "label": "Ejecutar todo",
        "description": "Corre descargas, análisis global y anual y genera gráficos de tendencia.",
        "parameters": [],
    },
    "5": {
        "label": "Inspeccionar datasets",
        "description": "Imprime información básica de las colecciones en Earth Engine.",
        "parameters": [],
    },
    "6": {
        "label": "Correlación lluvia → NDVI",
        "description": "Genera la tabla de correlación Pearson para distintos lags.",
        "parameters": [
            {"name": "max_lag", "required": False, "description": "Número máximo de meses de retardo."},
            {"name": "features_csv", "required": False, "description": "Ruta a la tabla maestra de características."},
        ],
    },
    "7": {
        "label": "Construir tabla maestra",
        "description": "Fusiona NDVI, precipitación, LST, SMAP y Sentinel-2 en data/processed/features_monthly.csv.",
        "parameters": [
            {"name": "include_s2", "required": False, "description": "Incluir Sentinel-2 en la tabla."},
        ],
    },
    "8": {
        "label": "Predecir próximas floraciones",
        "description": "Entrena un modelo logístico usando la tabla maestra y guarda probabilidades mensuales en data/processed/bloom_predictions.csv.",
        "parameters": [
            {
                "name": "probability_threshold",
                "required": False,
                "description": "Umbral (0-1) para clasificar un mes como floración.",
            }
        ],
    },
}


def get_menu_options() -> List[Dict[str, Any]]:
    """Devuelve metadatos legibles de las opciones del menú CLI."""

    return [
        {"key": key, **value}
        for key, value in sorted(MENU_METADATA.items(), key=lambda item: item[0])
    ]


def execute_menu_option(option: str, **kwargs) -> Any:
    """Dispara la acción asociada a una opción de menú de forma programática."""

    if option == "1":
        return download_datasets(kwargs.get("selected_keys"))
    if option == "2":
        mode = kwargs.get("mode", "global")
        return run_bloom_analysis(mode=mode)
    if option == "3":
        return generate_plot(
            kwargs.get("plot"),
            year=kwargs.get("year"),
            results_csv=kwargs.get("results_csv"),
        )
    if option == "4":
        downloads = download_datasets()
        global_csv = run_bloom_analysis(mode="global")
        annual_csv = run_bloom_analysis(mode="annual")
        trend_global = plot_ndvi_trends(global_csv)
        trend_annual = plot_ndvi_trends(annual_csv)
        return {
            "downloads": downloads,
            "global_csv": global_csv,
            "annual_csv": annual_csv,
            "trend_global": trend_global,
            "trend_annual": trend_annual,
        }
    if option == "5":
        inspect_all()
        return None
    if option == "6":
        return compute_correlation(
            features_csv=kwargs.get("features_csv", "data/processed/features_monthly.csv"),
            max_lag=kwargs.get("max_lag", 2),
        )
    if option == "7":
        return build_master_table(include_s2=kwargs.get("include_s2", True))
    if option == "8":
        return generate_bloom_predictions(
            probability_threshold=kwargs.get("probability_threshold", 0.5)
        )

    raise ValueError(f"Opción de menú desconocida: {option}")

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
    results = download_datasets(selected)
    for res in results:
        label = res.get("label") or res.get("key")
        if res.get("status") == "ok":
            print(f"✅ Exportado: {label} → {res.get('path')} ({res.get('rows')} registros)")
        else:
            print(f"⚠️ Error procesando {label}: {res.get('error')}")

def menu_analyze():
    print("\n=== Modo de análisis de floración ===")
    print("1) Global (umbral p75 de toda la serie)")
    print("2) Anual  (umbral p75 por año)")
    ch = _input("\n👉 Elige (1/2): ").strip()
    mode = "annual" if ch == "2" else "global"
    out = run_bloom_analysis(mode=mode)
    if out:
        print(f"🧾 Archivo de resultados: {out}")

def menu_plot():
    print("\n=== Gráficos ===")
    print("1) Tendencia NDVI + franjas de floración (usar último análisis disponible)")
    print("2) Gráfico NDVI de un año específico")
    print("3) Serie multiserie (NDVI, LST, SMAP, S2 y precip) 2015–2025")  # NUEVO
    print("4) Año específico multiserie NDVI + lluvia (doble eje)")       # NUEVO
    ch = _input("\n👉 Elige (1/2/3/4): ").strip()
    if ch == "2":
        y = _input("🔢 Año (ej. 2018): ").strip()
        try:
            year = int(y); generate_plot("ndvi_year", year=year)
        except ValueError:
            print("⚠️ Año inválido.")
    elif ch == "3":
        generate_plot("features_overview")
    elif ch == "4":
        y = _input("🔢 Año (ej. 2018): ").strip()
        try:
            year = int(y); generate_plot("ndvi_rain_year", year=year)
        except ValueError:
            print("⚠️ Año inválido.")
    else:
        generate_plot("ndvi_trend")


def run_all():
    # Descarga todo, analiza GLOBAL y ANUAL y genera ambos gráficos
    for res in download_datasets():
        label = res.get("label") or res.get("key")
        if res.get("status") == "ok":
            print(f"✅ Exportado: {label} → {res.get('path')} ({res.get('rows')} registros)")
        else:
            print(f"⚠️ Error procesando {label}: {res.get('error')}")

    # análisis
    g_csv = run_bloom_analysis(mode="global")
    a_csv = run_bloom_analysis(mode="annual")

    # gráficos
    generate_plot("ndvi_trend", results_csv=g_csv)
    generate_plot("ndvi_trend", results_csv=a_csv)


def menu_predict():
    print("\n=== Predicción de floración ===")
    default_threshold = 0.5
    raw = _input(
        f"👉 Umbral de probabilidad (0-1, Enter para {default_threshold}): "
    ).strip()
    try:
        threshold = float(raw) if raw else default_threshold
    except ValueError:
        print("⚠️ Umbral inválido, usando valor por defecto 0.5.")
        threshold = default_threshold

    try:
        metadata = generate_bloom_predictions(probability_threshold=threshold)
    except Exception as exc:  # pragma: no cover - CLI feedback
        print(f"⚠️ No fue posible entrenar el modelo: {exc}")
        return

    path = metadata.get("predictions_path")
    metrics = metadata.get("metrics", {})
    print("\n✅ Predicciones guardadas en:", path)
    print(
        f"   Registros totales: {metadata.get('records')} | Próximos meses estimados: {metadata.get('forecast_records')}"
    )
    print(
        f"   Modelo: {metadata.get('model')} (muestras entrenamiento: {metadata.get('training_samples')})"
    )
    accuracy = metrics.get("accuracy")
    roc_auc = metrics.get("roc_auc")
    if accuracy is not None:
        print(f"   Exactitud (train): {accuracy:.2%}")
    if roc_auc is not None:
        print(f"   ROC-AUC (train): {roc_auc:.3f}")

    forecast_meta = metadata.get("forecast", {})
    if forecast_meta:
        months = forecast_meta.get("months")
        start = forecast_meta.get("start")
        end = forecast_meta.get("end")
        if months:
            print(f"   Pronóstico NDVI: {months} meses ({start} → {end})")
        rmse = forecast_meta.get("ndvi_rmse")
        mae = forecast_meta.get("ndvi_mae")
        if rmse is not None or mae is not None:
            rmse_txt = f"{rmse:.3f}" if rmse is not None else "—"
            mae_txt = f"{mae:.3f}" if mae is not None else "—"
            print(f"   Error NDVI (RMSE/MAE): {rmse_txt} / {mae_txt}")
    if metadata.get("ndvi_forecast_plot"):
        print(f"   Gráfico pronóstico NDVI: {metadata['ndvi_forecast_plot']}")


def main():
    print("=" * 60)
    print("🌎 BLOOMWATCH - NASA HACKATHON | ANÁLISIS DE FLORACIÓN 2015–2025")
    print("=" * 60)

    try:
        while True:
            print("\n=== MENÚ PRINCIPAL ===")
            print("1) Extraer datos satelitales (selección por satélite)")
            print("2) Analizar floración (GLOBAL / ANUAL)")
            print("3) Generar gráficos")
            print("4) Ejecutar TODO el flujo (extraer + analizar + graficar)")
            print("5) Inspeccionar datasets disponibles")
            print("6) Correlación lluvia→NDVI (lags 0/+1/+2)")
            print("7) Construir TABLA MAESTRA mensual (NDVI, precip, LST, SMAP, S2)")
            print("8) Predecir próximas floraciones")
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
                    compute_correlation()  # usa la tabla maestra de características
                except Exception as e:
                    print(f"⚠️ Error en correlación: {e}")
            elif opt == "7":
                try:
                    result = build_master_table(include_s2=True)
                    if result and "path" in result:
                        print(f"✅ Tabla maestra creada: {result['path']} ({result['rows']} filas)")
                    else:
                        print(f"⚠️ Error construyendo tabla maestra: {result.get('error') if result else 'desconocido'}")
                except Exception as e:
                    print(f"⚠️ Error construyendo tabla maestra: {e}")
            elif opt == "8":
                menu_predict()
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
