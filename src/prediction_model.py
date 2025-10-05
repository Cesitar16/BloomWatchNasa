"""Utilities to train a bloom prediction model from the processed datasets."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List

import numpy as np
import pandas as pd
from sklearn.dummy import DummyClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


@dataclass
class BloomPredictionResult:
    """Container with the trained model metadata and monthly predictions."""

    table: pd.DataFrame
    metadata: Dict[str, object]

    @property
    def forecast_rows(self) -> pd.DataFrame:
        """Return the subset of rows without historical bloom labels."""

        return self.table.loc[~self.table["label_available"]].copy()


def _load_csv(path: Path, *, parse_dates: List[str]) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"No se encontró el archivo requerido: {path}")
    return pd.read_csv(path, parse_dates=parse_dates)


def _prepare_features(df: pd.DataFrame) -> List[str]:
    """Create additional temporal features and return feature column names."""

    df["month"] = df["date"].dt.month
    df["month_sin"] = np.sin(2 * np.pi * df["month"] / 12.0)
    df["month_cos"] = np.cos(2 * np.pi * df["month"] / 12.0)

    feature_columns = [
        "NDVI",
        "LST_C",
        "precip_mm",
        "soil_moisture",
        "s2_ndvi",
        "month_sin",
        "month_cos",
    ]

    for column in feature_columns:
        if column not in df.columns:
            df[column] = np.nan

    # Replace columns that are entirely NaN so downstream imputers can operate.
    for column in feature_columns:
        if df[column].notna().sum() == 0:
            df[column] = 0.0

    return feature_columns


def _attach_labels(features: pd.DataFrame, bloom_periods: pd.DataFrame) -> pd.DataFrame:
    """Add bloom labels to the monthly feature table."""

    df = features.copy()
    df["year"] = df["date"].dt.year
    df["is_bloom"] = 0
    df["label_available"] = False

    for _, row in bloom_periods.iterrows():
        year = int(row["year"])
        mask_year = df["year"] == year
        if not mask_year.any():
            continue

        df.loc[mask_year, "label_available"] = True
        start = pd.to_datetime(row["bloom_start"])
        end = pd.to_datetime(row["bloom_end"])
        mask_bloom = (df["date"] >= start) & (df["date"] <= end)
        df.loc[mask_bloom, "is_bloom"] = 1

    df.loc[~df["label_available"], "is_bloom"] = pd.NA
    df["label_available"] = df["label_available"].astype(bool)

    return df


def train_bloom_predictor(
    *,
    features_csv: str = "data/processed/features_monthly.csv",
    bloom_periods_csv: str = "data/processed/bloom_periods_annual.csv",
    probability_threshold: float = 0.5,
) -> BloomPredictionResult:
    """Train a simple classifier to estimate bloom probability per month."""

    if not 0 < probability_threshold < 1:
        raise ValueError("El umbral de probabilidad debe estar entre 0 y 1.")

    features_path = Path(features_csv)
    bloom_path = Path(bloom_periods_csv)

    features = _load_csv(features_path, parse_dates=["date"])
    if features.empty:
        raise ValueError("La tabla de características está vacía. Ejecuta la opción 7 del menú primero.")

    bloom_periods = _load_csv(
        bloom_path, parse_dates=["bloom_start", "bloom_end"]
    )
    if bloom_periods.empty:
        raise ValueError(
            "No hay periodos de floración calculados. Ejecuta el análisis antes de entrenar el modelo."
        )

    df = _attach_labels(features, bloom_periods)
    feature_columns = _prepare_features(df)

    train_df = df[df["label_available"]].copy()
    if train_df.empty:
        raise ValueError(
            "No se encontraron etiquetas históricas de floración para entrenar el modelo."
        )

    y_train = train_df["is_bloom"].astype(int)

    unique_labels = y_train.unique()
    if len(unique_labels) < 2:
        classifier = DummyClassifier(strategy="constant", constant=int(unique_labels[0]))
        model_name = "DummyClassifier"
    else:
        classifier = LogisticRegression(max_iter=1000, class_weight="balanced", random_state=42)
        model_name = "LogisticRegression"

    pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            ("clf", classifier),
        ]
    )

    X_train = train_df[feature_columns]
    pipeline.fit(X_train, y_train)

    X_all = df[feature_columns]
    if hasattr(pipeline, "predict_proba"):
        proba = pipeline.predict_proba(X_all)[:, 1]
    else:
        # Some dummy classifiers without predict_proba fall back to predictions.
        proba = pipeline.predict(X_all)

    df["probability"] = proba
    df["predicted_label"] = (df["probability"] >= probability_threshold).astype(int)
    df["status"] = np.where(df["label_available"], "historical", "forecast")

    metrics: Dict[str, float | None] = {"accuracy": None, "roc_auc": None}
    try:
        proba_train = pipeline.predict_proba(X_train)[:, 1]
        y_pred_train = (proba_train >= probability_threshold).astype(int)
        metrics["accuracy"] = float(accuracy_score(y_train, y_pred_train))
        if len(unique_labels) >= 2:
            metrics["roc_auc"] = float(roc_auc_score(y_train, proba_train))
    except Exception:
        pass

    training_start = train_df["date"].min()
    training_end = train_df["date"].max()

    metadata = {
        "model": model_name,
        "feature_columns": feature_columns,
        "threshold": probability_threshold,
        "training_samples": int(len(train_df)),
        "positive_rate": float(y_train.mean()) if len(train_df) else None,
        "metrics": metrics,
        "training_range": {
            "start": training_start.strftime("%Y-%m-%d") if pd.notna(training_start) else None,
            "end": training_end.strftime("%Y-%m-%d") if pd.notna(training_end) else None,
        },
    }

    return BloomPredictionResult(table=df, metadata=metadata)

