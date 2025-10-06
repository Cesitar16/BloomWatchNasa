"""Pydantic models for the BloomWatch API."""
from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class BloomAnalysisRequest(BaseModel):
    """Parameters for running the bloom season analysis."""

    mode: Literal["global", "annual"] = Field(
        "global",
        description="Analysis mode to use when computing bloom periods.",
    )


class DatasetListItem(BaseModel):
    """Metadata about an available dataset on disk."""

    name: str
    path: str
    kind: Literal["raw", "processed"]
    rows: Optional[int] = None


class TimeSeriesPoint(BaseModel):
    """Single observation for the combined NDVI/precipitation chart."""

    date: str
    ndvi: Optional[float] = Field(None, description="Monthly NDVI value.")
    precipitation_mm: Optional[float] = Field(
        None, description="Monthly accumulated precipitation (mm)."
    )


class BloomSummary(BaseModel):
    """Aggregated bloom information ready for the dashboard."""

    year: int
    bloom_start: str
    bloom_end: str
    duration_days: int


class RainNdviCorrelation(BaseModel):
    """Correlation entry for a precipitation lag."""

    lag_months: int
    r_pearson: Optional[float]
    n_pairs: int


class CorrelationRequest(BaseModel):
    """Parameters to recompute the rain → NDVI correlation."""

    max_lag: int = Field(
        2,
        ge=0,
        le=12,
        description="Maximum number of months to lag the precipitation series.",
    )
    features_csv: str = Field(
        "data/processed/features_monthly.csv",
        description="Path to the master features table.",
    )


class AOIGeometry(BaseModel):
    """GeoJSON-style representation of the AOI polygon."""

    type: Literal["Feature"] = "Feature"
    properties: dict = Field(default_factory=dict)
    geometry: dict


class ApiError(BaseModel):
    """Standardized error payload."""

    detail: str


class MenuParameter(BaseModel):
    """Describe a parameter accepted by a CLI menu option."""

    name: str
    required: bool = False
    description: Optional[str] = None


class MenuOption(BaseModel):
    """Expose CLI menu options through the API."""

    key: str
    label: str
    description: str
    parameters: List[MenuParameter] = Field(default_factory=list)


class PlotRequest(BaseModel):
    """Parameters required to reproduce plots from src/visualization.py."""

    plot: Literal["ndvi_trend", "ndvi_year", "features_overview", "ndvi_rain_year"]
    year: Optional[int] = Field(
        None,
        ge=2000,
        le=2100,
        description="Año objetivo para gráficos anuales.",
    )
    results_csv: Optional[str] = Field(
        None,
        description="Ruta opcional a un CSV de resultados de floración ya calculado.",
    )


class PlotItem(BaseModel):
    """Metadata about a generated plot stored in data/results."""

    name: str
    plot_type: Literal[
        "ndvi_trend",
        "ndvi_year",
        "features_overview",
        "ndvi_rain_year",
        "ndvi_forecast",
    ]
    path: str
    url: str
    generated_at: Optional[str] = Field(
        None, description="Marca de tiempo ISO 8601 de la última modificación."
    )
    year: Optional[int] = Field(
        None,
        description="Año asociado al gráfico cuando aplica.",
    )


class PredictionMetrics(BaseModel):
    """Training metrics reported by the bloom prediction model."""

    accuracy: Optional[float] = Field(
        None, ge=0, le=1, description="Exactitud en los datos de entrenamiento."
    )
    roc_auc: Optional[float] = Field(
        None, ge=0, le=1, description="Área bajo la curva ROC en entrenamiento."
    )
    positive_rate: Optional[float] = Field(
        None, ge=0, le=1, description="Proporción de meses en floración en el conjunto de entrenamiento."
    )
    ndvi_rmse: Optional[float] = Field(
        None, ge=0, description="RMSE del modelo de pronóstico NDVI sobre el historial."
    )
    ndvi_mae: Optional[float] = Field(
        None, ge=0, description="MAE del modelo de pronóstico NDVI sobre el historial."
    )


class BloomPredictionPoint(BaseModel):
    """Probability estimate for a specific month."""

    date: str
    probability: float = Field(..., ge=0, le=1)
    predicted: bool
    status: Literal["historical", "forecast"]
    ndvi: Optional[float] = Field(None, description="NDVI mensual utilizado para la predicción.")
    ndvi_source: Optional[Literal["observed", "forecast"]] = Field(
        None, description="Origen del NDVI utilizado para la predicción."
    )
    precipitation_mm: Optional[float] = Field(None, description="Precipitación mensual acumulada.")
    lst_c: Optional[float] = Field(None, description="Temperatura superficial promedio (°C).")
    soil_moisture: Optional[float] = Field(
        None, description="Contenido de humedad del suelo (fracción)."
    )
    sentinel_ndvi: Optional[float] = Field(
        None, description="NDVI derivado de Sentinel-2 cuando está disponible."
    )
    label: Optional[int] = Field(
        None,
        ge=0,
        le=1,
        description="Etiqueta histórica (1 si floración, 0 si no, None cuando no existe).",
    )


class NDVIForecastPoint(BaseModel):
    """Serie mensual de NDVI observada y pronosticada."""

    date: str
    ndvi: float = Field(..., ge=0, le=1)
    lower: Optional[float] = Field(
        None, ge=0, le=1, description="Límite inferior del intervalo de confianza."
    )
    upper: Optional[float] = Field(
        None, ge=0, le=1, description="Límite superior del intervalo de confianza."
    )
    source: Literal["historical", "forecast"]


class ForecastSummary(BaseModel):
    """Datos descriptivos del horizonte de pronóstico."""

    months: int
    start: Optional[str]
    end: Optional[str]
    ndvi_model: Optional[str]
    ndvi_rmse: Optional[float]
    ndvi_mae: Optional[float]


class ForecastPlot(BaseModel):
    """Metadatos del gráfico de pronóstico NDVI generado en disco."""

    path: str
    url: str


class BloomPredictionResponse(BaseModel):
    """Complete payload returned by the bloom prediction endpoint."""

    model: str
    feature_columns: List[str]
    threshold: float = Field(..., ge=0, le=1)
    training_samples: int
    training_range: Optional[dict] = Field(
        None, description="Rango temporal utilizado para entrenar el modelo."
    )
    metrics: PredictionMetrics
    predictions: List[BloomPredictionPoint]
    forecast: Optional[ForecastSummary] = None
    ndvi_forecast: List[NDVIForecastPoint] = Field(
        default_factory=list, description="Serie mensual NDVI histórico + pronóstico."
    )
    ndvi_forecast_plot: Optional[ForecastPlot] = None
