# src/gee_auth.py
"""
gee_auth.py
---------------------------------
Autenticación e inicialización de Google Earth Engine
para el proyecto BloomWatch - NASA Space Apps 2025.
"""

import ee
from config.settings import PROJECT_ID


def initialize_gee(project_id: str | None = None) -> None:
    """
    Inicializa la conexión con Google Earth Engine usando el PROJECT_ID.
    Si no hay sesión, intenta autenticación interactiva.
    """
    pid = project_id or PROJECT_ID
    try:
        ee.Initialize(project=pid)
        print(f"✅ Earth Engine inicializado correctamente con el proyecto: {pid}")
    except Exception as e:
        print("ℹ️ No había sesión activa. Iniciando autenticación interactiva...")
        ee.Authenticate()
        ee.Initialize(project=pid)
        print(f"✅ Earth Engine inicializado correctamente con el proyecto: {pid}")
