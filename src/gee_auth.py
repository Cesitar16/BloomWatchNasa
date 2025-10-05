# src/gee_auth.py
import os
import ee

PROJECT_ENV = "GEE_PROJECT"   # puedes setearlo en .env si quieres
DEFAULT_PROJECT = "bloomwatchinvestigacion2025"

_initialized = False

def initialize_gee(project: str | None = None):
    """
    Inicializa Earth Engine. Intenta usar el proyecto de entorno (GEE_PROJECT)
    o el DEFAULT_PROJECT si no se pasa nada explícito.
    """
    global _initialized
    if _initialized:
        return

    proj = project or os.environ.get(PROJECT_ENV, DEFAULT_PROJECT)
    try:
        ee.Initialize(project=proj)
        print(f"✅ Earth Engine inicializado correctamente con el proyecto: {proj}")
        _initialized = True
    except ee.EEException as e:
        # Si falta token, permitir Authenticate en REPL antes de volver a Initialize
        print("⚠️ No autenticado. Ejecuta en consola Python:\n"
              ">>> import ee; ee.Authenticate()\n"
              "y luego reintenta.")
        raise
