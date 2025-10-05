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
