PROJECT_ID = "bloomwatchinvestigacion2025"

AOI = {
    "name": "Llanos de Challe",
    "geometry": [
        [
            [-71.074, -28.084],
            [-70.990, -28.084],
            [-70.990, -27.990],
            [-71.074, -27.990]
        ]
    ]
}

START_DATE = "2015-01-01"
END_DATE = "2025-01-01"

DATASETS = {
    "modis_ndvi": "MODIS/061/MOD13Q1",
    "sentinel2_sr": "COPERNICUS/S2_SR",
    "modis_lst": "MODIS/061/MOD11A2",
    "gpm_precip": "NASA/GPM_L3/IMERG_V06",
    "smap_soil": "NASA_USDA/HSL/SMAP10KM_soil_moisture"
}

EXPORT_DIR = "data/raw/"
