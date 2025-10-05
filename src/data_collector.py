# src/data_collector.py
import os
import calendar
from datetime import date, timedelta

import ee
import pandas as pd

# ==== CONFIGURACIÓN GENERAL ====
START = "2015-01-01"
END   = "2025-12-31"

# **IMPORTANTE**: NO crear objetos ee.* aquí (evita fallar en import).
# Solo guardamos las coordenadas crudas del AOI.
AOI_COORDS = [
    [-71.100, -28.000],
    [-70.500, -28.000],
    [-70.500, -27.600],
    [-71.100, -27.600],
    [-71.100, -28.000],
]

RAW_DIR = "data/raw"
PROC_DIR = "data/processed"
os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(PROC_DIR, exist_ok=True)


# ---------- Utilidades locales (autocontenidas) ----------
def _get_aoi() -> ee.Geometry:
    """Construye el ee.Geometry cuando YA está inicializado GEE."""
    return ee.Geometry.Polygon([AOI_COORDS])

def _coerce_month_date(df: pd.DataFrame) -> pd.DataFrame:
    """Normaliza columna 'date' a datetime primer día del mes."""
    if "date" in df.columns:
        df = df.copy()
        df["date"] = pd.to_datetime(df["date"], errors="coerce")
        # Forzar a periodo mensual (primer día del mes)
        df["date"] = df["date"].values.astype("datetime64[M]")
    return df

def _month_starts(start: str = START, end: str = END):
    """Genera primeros de mes como objetos date (zona UTC)."""
    s = date.fromisoformat(start[:10])
    e = date.fromisoformat(end[:10])
    d = date(s.year, s.month, 1)
    out = []
    while d <= e:
        out.append(d)
        y = d.year + (d.month // 12)
        m = 1 if d.month == 12 else d.month + 1
        d = date(y, m, 1)
    return out

def _month_range(d: date):
    """Devuelve strings ISO de inicio (incl.) y fin (excl.) del mes de d, y #días."""
    y, m = d.year, d.month
    days = calendar.monthrange(y, m)[1]
    start = date(y, m, 1).isoformat()
    end   = (date(y, m, 1) + timedelta(days=days)).isoformat()  # 1ro del mes siguiente
    return start, end, days

def _reduce_month(ic: ee.ImageCollection, make_image, band_name: str, scale: int = 500,
                  start: str = START, end: str = END) -> pd.DataFrame:
    """
    Itera meses: make_image(ic_mes) -> ee.Image; reduce mean en AOI.
    Devuelve DataFrame con columnas: date, <band_name>.
    """
    aoi = _get_aoi()
    rows = []
    for dm in _month_starts(start, end):
        ms, me, _ = _month_range(dm)
        ic_m = ic.filterDate(ms, me)
        img  = make_image(ic_m)  # ee.Image
        stat = img.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=aoi,
            scale=scale,
            maxPixels=1e13,
        )
        try:
            val = stat.get(band_name).getInfo()
        except Exception:
            val = None
        rows.append({"date": f"{dm.isoformat()}", band_name: val})
    df = pd.DataFrame(rows)
    return _coerce_month_date(df)

def _safe_merge(left: pd.DataFrame | None, right: pd.DataFrame | None, how="outer") -> pd.DataFrame:
    """Merge robusto por 'date'."""
    if left is None or len(left) == 0:
        return right if right is not None else pd.DataFrame(columns=["date"])
    if right is None or len(right) == 0:
        return left
    left = _coerce_month_date(left)
    right = _coerce_month_date(right)
    return left.merge(right, on="date", how=how)


# ---------- DESCARGAS ----------
def download_modis_ndvi_monthly(start: str = START, end: str = END):
    """
    MODIS NDVI con QA (MODIS/061/MOD13Q1)
    NDVI escala 0.0001. Filtramos por SummaryQA 0 o 1.
    """
    col = ee.ImageCollection("MODIS/061/MOD13Q1").select(["NDVI", "SummaryQA"])

    def mask_and_scale(ic_m: ee.ImageCollection) -> ee.Image:
        def per_img(img: ee.Image) -> ee.Image:
            qa = img.select("SummaryQA")
            good = qa.eq(0).Or(qa.eq(1))  # 0=good, 1=marginal
            ndvi = img.select("NDVI").multiply(0.0001).updateMask(good)
            return ndvi.rename("NDVI")
        return ic_m.map(per_img).mean()

    df = _reduce_month(col, mask_and_scale, "NDVI", scale=500, start=start, end=end)
    path = os.path.join(RAW_DIR, "modis_ndvi_monthly.csv")
    df.to_csv(path, index=False)
    return path, len(df)

def download_modis_lst_monthly(start: str = START, end: str = END):
    """
    MODIS LST día (MODIS/061/MOD11A2)
    LST_Day_1km escala 0.02 Kelvin → °C = val*0.02 - 273.15
    """
    col = ee.ImageCollection("MODIS/061/MOD11A2").select("LST_Day_1km")

    def to_celsius(ic_m: ee.ImageCollection) -> ee.Image:
        return ic_m.mean().multiply(0.02).subtract(273.15).rename("LST_C")

    df = _reduce_month(col, to_celsius, "LST_C", scale=1000, start=start, end=end)
    path = os.path.join(RAW_DIR, "modis_lst_monthly.csv")
    df.to_csv(path, index=False)
    return path, len(df)

def download_gpm_precip_monthly(start: str = START, end: str = END):
    """
    GPM IMERG MONTHLY V07: NASA/GPM_L3/IMERG_MONTHLY_V07
    Band: 'precipitation' (tasa mm/h). Convertimos a mm/mes = tasa * 24 * díasMes.
    """
    col = ee.ImageCollection("NASA/GPM_L3/IMERG_MONTHLY_V07").select("precipitation")
    aoi = _get_aoi()

    rows = []
    for dm in _month_starts(start, end):
        ms, me, ndays = _month_range(dm)
        ic_m = col.filterDate(ms, me)
        img  = ic_m.mean().rename("precip_rate")  # mm/h
        stat = img.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=aoi,
            scale=10000,
            maxPixels=1e13,
        )
        try:
            rate = stat.get("precip_rate").getInfo()  # mm/h
        except Exception:
            rate = None
        precip_mm = rate * 24 * ndays if rate is not None else None
        rows.append({"date": dm.isoformat(), "precip_mm": precip_mm})

    df = pd.DataFrame(rows)
    df = _coerce_month_date(df)
    path = os.path.join(RAW_DIR, "gpm_precip_monthly.csv")
    df.to_csv(path, index=False)
    return path, len(df)

def download_smap_soil_monthly(start: str = START, end: str = END):
    """
    SMAP (Enhanced L3, 9km): NASA/SMAP/SPL3SMP_E/005  (band: 'soil_moisture', m3/m3)
    """
    col = ee.ImageCollection("NASA/SMAP/SPL3SMP_E/005").select("soil_moisture")

    def monthly_sm(ic_m: ee.ImageCollection) -> ee.Image:
        return ic_m.mean().rename("soil_moisture")

    df = _reduce_month(col, monthly_sm, "soil_moisture", scale=9000, start=start, end=end)
    path = os.path.join(RAW_DIR, "smap_soil_monthly.csv")
    df.to_csv(path, index=False)
    return path, len(df)

def download_sentinel2_ndvi_monthly_light(start: str = START, end: str = END):
    """
    Sentinel-2 SR (HARMONIZED) NDVI mensual (ligero) con máscara SCL.
    B8,B4 con escala 0.0001 → NDVI = (NIR-RED)/(NIR+RED).
    """
    aoi = _get_aoi()
    col = (ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
           .filterBounds(aoi)
           .select(["B8", "B4", "SCL"]))

    def monthly_ndvi(ic_m: ee.ImageCollection) -> ee.Image:
        def per_img(img: ee.Image) -> ee.Image:
            scl = img.select("SCL")
            ok  = (scl.eq(4)  # Vegetation
                   .Or(scl.eq(5))   # Not-vegetated
                   .Or(scl.eq(6))   # Bare soil
                   .Or(scl.eq(7))   # Water
                   .Or(scl.eq(11))) # Snow/Ice (opcional)
            b8 = img.select("B8").multiply(0.0001)
            b4 = img.select("B4").multiply(0.0001)
            ndvi = b8.subtract(b4).divide(b8.add(b4)).updateMask(ok)
            return ndvi.rename("NDVI")
        return ic_m.map(per_img).mean()

    df = _reduce_month(col, monthly_ndvi, "NDVI", scale=20, start=start, end=end)
    path = os.path.join(RAW_DIR, "sentinel2_ndvi_monthly.csv")
    df.to_csv(path, index=False)
    return path, len(df)


# ---------- Tabla maestra mensual ----------
def _load_month_csv(path: str, colmap: dict) -> pd.DataFrame:
    """
    Carga un CSV mensual y renombra columnas según colmap.
    colmap: {"col_original" o (tuple de posibles): "col_final"}
    """
    if not os.path.exists(path):
        raise FileNotFoundError(f"No existe {path}")
    df = pd.read_csv(path)
    ren = {}
    for k, v in colmap.items():
        if isinstance(k, (list, tuple)):
            for cand in k:
                if cand in df.columns:
                    ren[cand] = v
                    break
        else:
            if k in df.columns:
                ren[k] = v
    if ren:
        df = df.rename(columns=ren)
    df = _coerce_month_date(df)
    if "date" not in df.columns:
        raise ValueError(f"{path}: no trae columna 'date'")
    return df

def build_features_monthly(
    out_path: str = "data/processed/features_monthly.csv",
    start: str = START,
    end: str = END,
    include_s2: bool = True,
):
    """
    Construye una tabla maestra mensual uniendo (por 'date'):
      - MODIS NDVI (QA)            -> 'NDVI'
      - MODIS LST (día)            -> 'LST_C'
      - GPM IMERG precipitación    -> 'precip_mm'
      - SMAP humedad superficial   -> 'soil_moisture'
      - Sentinel-2 NDVI mensual    -> 's2_ndvi' (opcional con include_s2)
    Devuelve: (ruta_csv, numero_registros)
    """
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    frames: list[pd.DataFrame] = []

    # 1) MODIS NDVI
    try:
        df_ndvi = _load_month_csv(
            os.path.join(RAW_DIR, "modis_ndvi_monthly.csv"),
            {("NDVI", "ndvi", "modis_ndvi"): "NDVI"}
        )
        df_ndvi = df_ndvi[(df_ndvi["date"] >= pd.to_datetime(start)) &
                          (df_ndvi["date"] <= pd.to_datetime(end))]
        frames.append(df_ndvi[["date", "NDVI"]])
    except Exception as e:
        print(f"⚠️ NDVI (MODIS) no disponible: {e}")

    # 2) MODIS LST
    try:
        df_lst = _load_month_csv(
            os.path.join(RAW_DIR, "modis_lst_monthly.csv"),
            {("LST_C", "LST_Day_1km", "LST"): "LST_C"}
        )
        df_lst = df_lst[(df_lst["date"] >= pd.to_datetime(start)) &
                        (df_lst["date"] <= pd.to_datetime(end))]
        frames.append(df_lst[["date", "LST_C"]])
    except Exception as e:
        print(f"⚠️ LST (MODIS) no disponible: {e}")

    # 3) GPM precip
    try:
        gpm_path = os.path.join(RAW_DIR, "gpm_precip_monthly.csv")
        if not os.path.exists(gpm_path):
            alt = os.path.join(RAW_DIR, "gpm_precip_monthly_monthly.csv")
            if os.path.exists(alt):
                gpm_path = alt
        df_gpm = _load_month_csv(
            gpm_path,
            {("precip_mm", "precipitation", "rain_mm", "precip"): "precip_mm"}
        )
        df_gpm = df_gpm[(df_gpm["date"] >= pd.to_datetime(start)) &
                        (df_gpm["date"] <= pd.to_datetime(end))]
        frames.append(df_gpm[["date", "precip_mm"]])
    except Exception as e:
        print(f"⚠️ GPM precipitación no disponible: {e}")

    # 4) SMAP soil moisture
    try:
        df_smap = _load_month_csv(
            os.path.join(RAW_DIR, "smap_soil_monthly.csv"),
            {("soil_moisture", "ssm", "SMAP_SSM"): "soil_moisture"}
        )
        df_smap = df_smap[(df_smap["date"] >= pd.to_datetime(start)) &
                          (df_smap["date"] <= pd.to_datetime(end))]
        frames.append(df_smap[["date", "soil_moisture"]])
    except Exception as e:
        print(f"⚠️ SMAP no disponible: {e}")

    # 5) Sentinel-2 (opcional)
    if include_s2:
        try:
            df_s2 = _load_month_csv(
                os.path.join(RAW_DIR, "sentinel2_ndvi_monthly.csv"),
                {("s2_ndvi", "NDVI", "S2_NDVI"): "s2_ndvi"}
            )
            df_s2 = df_s2[(df_s2["date"] >= pd.to_datetime(start)) &
                          (df_s2["date"] <= pd.to_datetime(end))]
            frames.append(df_s2[["date", "s2_ndvi"]])
        except Exception as e:
            print(f"⚠️ Sentinel-2 no disponible: {e}")

    # Merge progresivo
    if not frames:
        print("⚠️ No hay datos para unir. Revisa que existan los CSV en data/raw.")
        # Aun así devolvemos un archivo vacío
        pd.DataFrame(columns=["date"]).to_csv(out_path, index=False)
        return out_path, 0

    df_all = frames[0]
    for df in frames[1:]:
        df_all = _safe_merge(df_all, df, how="outer")

    df_all = df_all.sort_values("date").reset_index(drop=True)
    # Si hubiera duplicados por mes, agregamos promedio
    df_all = df_all.groupby("date", as_index=False).mean(numeric_only=True)

    df_all.to_csv(out_path, index=False)
    print(f"✅ Tabla maestra guardada en {out_path} ({len(df_all)} filas)")
    return out_path, len(df_all)


# ---------- Envoltorio "descargar todo" ----------
def export_all():
    """
    Corre todas las descargas (útil para la opción 'TODO').
    Devuelve dict con paths/num_registros por dataset.
    """
    results = {}
    for key, meta in DOWNLOAD_FUNCTIONS.items():
        try:
            path, n = meta["fn"]()
            results[key] = {"path": path, "rows": n}
        except Exception as e:
            results[key] = {"error": str(e)}
    # además crea features si se descargó lo base
    try:
        fpath, n = build_features_monthly(include_s2=True)
        results["features_monthly"] = {"path": fpath, "rows": n}
    except Exception as e:
        results["features_monthly"] = {"error": str(e)}
    return results


# ---------- Registro para el menú ----------
DOWNLOAD_FUNCTIONS = {
    "modis_ndvi": {
        "label": "MODIS NDVI (QA)",
        "fn": download_modis_ndvi_monthly
    },
    "sentinel2_sr": {
        "label": "Sentinel-2 NDVI mensual (ligero)",
        "fn": download_sentinel2_ndvi_monthly_light
    },
    "modis_lst": {
        "label": "MODIS LST día",
        "fn": download_modis_lst_monthly
    },
    "gpm": {
        "label": "GPM IMERG V07 precipitación",
        "fn": download_gpm_precip_monthly
    },
    "smap": {
        "label": "SMAP humedad superficial",
        "fn": download_smap_soil_monthly
    },
}
