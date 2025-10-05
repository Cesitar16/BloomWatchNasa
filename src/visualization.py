# src/visualization.py
import os
from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt

# Rutas estándar
NDVI_CSV = Path("data/raw/modis_ndvi_monthly.csv")
PROC_DIR = Path("data/processed")
RES_DIR  = Path("data/results")
RES_DIR.mkdir(parents=True, exist_ok=True)

FEATURES_CSV = "data/processed/features_monthly.csv"

# Paleta consistente
C_NDVI = "#2e7d32"   # verde (MODIS)
C_S2   = "#1b5e20"   # verde oscuro (S2)
C_LST  = "#f57c00"   # naranja (LST)
C_SMAP = "#6d4c41"   # marrón (SMAP)
C_RAIN = "#1e88e5"   # azul (precipitación)
C_BLOOM= "#1976d2"   # celeste para la franja de floración


# ------------------ Utilidades base ------------------
def _load_ndvi():
    """Carga NDVI MODIS mensual y normaliza columna fecha."""
    if not NDVI_CSV.exists():
        print(f"⚠️ No existe {NDVI_CSV}")
        return None
    df = pd.read_csv(NDVI_CSV)
    date_col = "date" if "date" in df.columns else ("fecha" if "fecha" in df.columns else None)
    if date_col is None or "NDVI" not in df.columns:
        print("⚠️ NDVI CSV sin columnas esperadas ('date'/'fecha','NDVI').")
        return None
    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
    df = df.dropna(subset=[date_col, "NDVI"]).sort_values(date_col).reset_index(drop=True)
    df = df.rename(columns={date_col: "date"})
    return df


def _load_features():
    """Carga la tabla maestra mensual."""
    if not os.path.exists(FEATURES_CSV):
        raise FileNotFoundError(
            f"No existe {FEATURES_CSV}. Construye la tabla maestra (menú opción 7)."
        )
    df = pd.read_csv(FEATURES_CSV)
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.sort_values("date").reset_index(drop=True)
    return df


def _load_bloom_csv(prefer_global=True):
    """Devuelve ruta a bloom_periods_global.csv o bloom_periods_annual.csv según disponibilidad."""
    g = PROC_DIR / "bloom_periods_global.csv"
    a = PROC_DIR / "bloom_periods_annual.csv"
    if prefer_global and g.exists():
        return str(g)
    if a.exists():
        return str(a)
    if g.exists():
        return str(g)
    return None


# ------------------ 1) Tendencia NDVI (global/anual) ------------------
def plot_ndvi_trends(results_csv: str | None = None) -> str | None:
    """
    Grafica toda la serie NDVI y sombreos de floración por año.
    Si no se pasa results_csv, intenta global y si no, anual.
    """
    df = _load_ndvi()
    if df is None:
        return None

    if results_csv is None:
        results_csv = _load_bloom_csv(prefer_global=True)
        if results_csv is None:
            print("⚠️ No hay resultados de floración (global/annual). Ejecuta el análisis primero.")
            return None

    bp = pd.read_csv(results_csv)
    plt.figure(figsize=(12, 5))
    plt.plot(df["date"], df["NDVI"], color=C_NDVI, marker="o", linewidth=1.6, label="NDVI (MODIS)")
    plt.title("Tendencia NDVI mensual 2015–2025 🌿")
    plt.xlabel("Fecha")
    plt.ylabel("NDVI")

    # sombrear períodos
    first = True
    for _, row in bp.iterrows():
        b0 = pd.to_datetime(row.get("bloom_start"), errors="coerce")
        b1 = pd.to_datetime(row.get("bloom_end"), errors="coerce")
        if pd.notna(b0) and pd.notna(b1):
            plt.axvspan(b0, b1, color=C_BLOOM, alpha=0.18, label="Floración" if first else None)
            first = False

    plt.grid(True, alpha=0.3, linestyle="--", linewidth=0.6)
    plt.legend(loc="best")
    out = RES_DIR / ("ndvi_trend_global.png" if "global" in results_csv else "ndvi_trend_annual.png")
    plt.tight_layout()
    plt.savefig(out, dpi=300)
    plt.close()
    print(f"✅ Gráfico guardado en {out}")
    return str(out)


# ------------------ 2) NDVI de un año, con franja ------------------
def plot_ndvi_year(year: int, results_csv: str | None = None) -> str | None:
    """
    Grafica NDVI de un año específico marcando la franja de floración.
    Por defecto usa resultados ANUALES, y si no existen, GLOBAL.
    """
    df = _load_ndvi()
    if df is None:
        return None

    if results_csv is None:
        # Primero anual (para ventana por año); si no, global
        a = PROC_DIR / "bloom_periods_annual.csv"
        g = PROC_DIR / "bloom_periods_global.csv"
        if a.exists():
            results_csv = str(a)
        elif g.exists():
            results_csv = str(g)
        else:
            print("⚠️ No hay resultados de floración (global/annual). Ejecuta el análisis primero.")
            return None

    bp = pd.read_csv(results_csv)
    row = bp[bp["year"] == year]
    dfy = df[df["date"].dt.year == year].copy()
    if dfy.empty:
        print(f"⚠️ No hay datos NDVI para el año {year}.")
        return None

    plt.figure(figsize=(12, 5))
    plt.plot(dfy["date"], dfy["NDVI"], color=C_NDVI, marker="o", linewidth=1.8, label="NDVI (MODIS)")
    plt.title(f"NDVI {year} y ventana de floración 🌿")
    plt.xlabel("Mes")
    plt.ylabel("NDVI")
    plt.grid(True, alpha=0.3, linestyle="--", linewidth=0.6)

    if not row.empty:
        b0 = pd.to_datetime(row.iloc[0].get("bloom_start"), errors="coerce")
        b1 = pd.to_datetime(row.iloc[0].get("bloom_end"), errors="coerce")
        if pd.notna(b0) and pd.notna(b1):
            plt.axvspan(b0, b1, color=C_BLOOM, alpha=0.18, label="Floración")

    # ticks por mes
    months = pd.date_range(f"{year}-01-01", f"{year}-12-31", freq="MS")
    plt.xticks(months, [m.strftime("%b") for m in months])

    plt.legend(loc="best")
    out = RES_DIR / f"ndvi_{year}.png"
    plt.tight_layout()
    plt.savefig(out, dpi=300)
    plt.close()
    print(f"✅ Gráfico guardado en {out}")
    return str(out)


# ------------------ 3) Serie multivariable 2015–2025 ------------------
def plot_features_multivariate(
    features_csv: str = FEATURES_CSV,
    title: str = "BloomWatch 🌿 | Serie multivariable mensual (2015–2025)"
) -> str:
    """
    Serie NDVI (MODIS), NDVI (S2), LST, SMAP y barras de precipitación (eje derecho).
    """
    df = _load_features()

    fig, ax1 = plt.subplots(figsize=(12, 4.8))

    # Eje izquierdo
    if "NDVI" in df.columns:
        ax1.plot(df["date"], df["NDVI"], color=C_NDVI, lw=1.8, label="NDVI (MODIS)")
    if "s2_ndvi" in df.columns:
        ax1.plot(df["date"], df["s2_ndvi"], color=C_S2, lw=1.5, ls="--", alpha=0.9, label="NDVI (S2)")
    if "LST_C" in df.columns:
        ax1.plot(df["date"], df["LST_C"], color=C_LST, lw=1.2, alpha=0.9, label="LST (°C)")
    if "soil_moisture" in df.columns:
        ax1.plot(df["date"], df["soil_moisture"], color=C_SMAP, lw=1, alpha=0.9, label="SMAP (m³/m³)")

    ax1.set_ylabel("Valor (unidades originales)")
    ax1.set_xlabel("Fecha")
    ax1.grid(alpha=0.25, linestyle="--", linewidth=0.6)

    # Eje derecho: precipitación en barras
    ax2 = None
    if "precip_mm" in df.columns:
        ax2 = ax1.twinx()
        ax2.bar(df["date"], df["precip_mm"], width=18, color=C_RAIN, alpha=0.35, label="Precipitación (mm/mes)")
        ax2.set_ylabel("Precipitación (mm/mes)", color=C_RAIN)
        ax2.tick_params(axis="y", labelcolor=C_RAIN)

    # Leyenda combinada
    h1, l1 = ax1.get_legend_handles_labels()
    if ax2:
        h2, l2 = ax2.get_legend_handles_labels()
        h1 += h2; l1 += l2
    ax1.legend(h1, l1, loc="upper left", frameon=True)

    ax1.set_title(title)
    fig.tight_layout()
    out = os.path.join(RES_DIR, "features_multivariate.png")
    fig.savefig(out, dpi=300)
    plt.close(fig)
    print(f"✅ Gráfico multivariable guardado en {out}")
    return out


# ------------------ 4) NDVI vs lluvia por año ------------------
def plot_ndvi_vs_rain_year(
    year: int,
    ndvi_csv: str = "data/raw/modis_ndvi_monthly.csv",
    rain_csv: str = "data/raw/gpm_precip_monthly.csv",
    s2_csv: str = "data/raw/sentinel2_ndvi_monthly.csv",
    bloom_csv: str | None = None,
) -> str:
    """
    NDVI (MODIS) y NDVI (S2) por meses del año con precipitación en barras (eje derecho)
    y ventana de floración sombreada si existe en bloom_csv.
    """
    # NDVI
    ndvi = pd.read_csv(ndvi_csv)
    ndvi["date"] = pd.to_datetime(ndvi["date"], errors="coerce")
    ndvi = ndvi.dropna(subset=["date"]).sort_values("date")
    if "NDVI" not in ndvi.columns:
        raise ValueError("El CSV de NDVI no tiene columna 'NDVI'.")
    ndvi["year"] = ndvi["date"].dt.year
    ndvi["month"] = ndvi["date"].dt.month

    # Lluvia
    rain = pd.read_csv(rain_csv)
    rain["date"] = pd.to_datetime(rain["date"], errors="coerce")
    rain = rain.dropna(subset=["date"]).sort_values("date")
    if "precip_mm" not in rain.columns:
        raise ValueError("El CSV de lluvia no tiene columna 'precip_mm'.")
    rain["year"] = rain["date"].dt.year
    rain["month"] = rain["date"].dt.month

    # Sentinel-2 (opcional)
    if os.path.exists(s2_csv):
        s2 = pd.read_csv(s2_csv)
        s2["date"] = pd.to_datetime(s2["date"], errors="coerce")
        s2 = s2.dropna(subset=["date"]).sort_values("date")
        s2["year"] = s2["date"].dt.year
        s2["month"] = s2["date"].dt.month
        if "s2_ndvi" not in s2.columns and "NDVI" in s2.columns:
            s2 = s2.rename(columns={"NDVI": "s2_ndvi"})
    else:
        s2 = pd.DataFrame(columns=["month", "s2_ndvi", "year"])

    # Frame base (1..12)
    d = pd.DataFrame({"month": range(1, 13)})
    d = d.merge(ndvi[ndvi["year"] == year][["month", "NDVI"]], on="month", how="left")
    d = d.merge(rain[rain["year"] == year][["month", "precip_mm"]], on="month", how="left")
    if not s2.empty:
        d = d.merge(s2[s2["year"] == year][["month", "s2_ndvi"]], on="month", how="left")

    # Plot
    fig, ax1 = plt.subplots(figsize=(10, 4.8))
    ax1.plot(d["month"], d["NDVI"], marker="o", lw=2, color=C_NDVI, label="NDVI (MODIS)")
    if "s2_ndvi" in d.columns:
        ax1.plot(d["month"], d["s2_ndvi"], marker="o", lw=1.6, ls="--",
                 color=C_S2, alpha=0.9, label="NDVI (S2)")
    ax1.set_xlabel("Mes")
    ax1.set_ylabel("NDVI")
    ax1.set_xticks(range(1, 13))
    ax1.set_xticklabels(["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"])
    ax1.grid(alpha=0.25, linestyle="--", linewidth=0.6)

    # Lluvia en barras
    ax2 = ax1.twinx()
    ax2.bar(d["month"], d["precip_mm"], width=0.6, color=C_RAIN, alpha=0.35, label="Precipitación (mm/mes)")
    ax2.set_ylabel("Precipitación (mm/mes)", color=C_RAIN)
    ax2.tick_params(axis="y", labelcolor=C_RAIN)

    # Franja de floración
    if bloom_csv and os.path.exists(bloom_csv):
        blooms = pd.read_csv(bloom_csv)
        if {"bloom_start", "bloom_end"}.issubset(blooms.columns):
            blooms["bloom_start"] = pd.to_datetime(blooms["bloom_start"], errors="coerce")
            blooms["bloom_end"]   = pd.to_datetime(blooms["bloom_end"],   errors="coerce")
            for _, r in blooms.iterrows():
                if (pd.notna(r["bloom_start"]) and r["bloom_start"].year == year) or \
                   (pd.notna(r["bloom_end"])   and r["bloom_end"].year   == year):
                    m0 = max(1,  r["bloom_start"].month if pd.notna(r["bloom_start"]) else 1)
                    m1 = min(12, r["bloom_end"].month   if pd.notna(r["bloom_end"])   else 12)
                    ax1.axvspan(m0, m1, color=C_BLOOM, alpha=0.18, label="Floración")
                    break

    # Leyenda combinada sin duplicados
    h1, l1 = ax1.get_legend_handles_labels()
    h2, l2 = ax2.get_legend_handles_labels()
    used = set(); H=[]; L=[]
    for h, l in list(zip(h1,l1)) + list(zip(h2,l2)):
        if l not in used:
            H.append(h); L.append(l); used.add(l)
    ax1.legend(H, L, loc="upper left", frameon=True)

    ax1.set_title(f"BloomWatch 🌿 | NDVI y lluvia en {year}")
    fig.tight_layout()
    out = os.path.join(RES_DIR, f"ndvi_rain_{year}.png")
    fig.savefig(out, dpi=300)
    plt.close(fig)
    print(f"✅ Gráfico NDVI-lluvia {year} guardado en {out}")
    return out


# --- Wrappers de compatibilidad para main.py (mantener nombres antiguos) ---
def plot_features_overview(out_path: str = "data/results/features_multivariate.png"):
    """Alias antiguo -> gráfico multivariable 2015–2025."""
    return plot_features_multivariate(features_csv=FEATURES_CSV, title="BloomWatch 🌿 | Serie multivariable mensual (2015–2025)")

def plot_features_year(year: int, out_path: str | None = None,
                       bloom_csv_path: str = "data/processed/bloom_periods_annual.csv"):
    """Alias antiguo -> NDVI vs lluvia por año (con franja de floración si existe)."""
    # Respetamos out_path y bloom_csv_path como en tu main.py
    return plot_ndvi_vs_rain_year(year, bloom_csv=bloom_csv_path)
