"""Utilities to train a bloom prediction model from the processed datasets."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List

import numpy as np
import pandas as pd
from numpy.typing import ArrayLike
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, mean_absolute_error, mean_squared_error, roc_auc_score
from sklearn.pipeline import Pipeline


@dataclass
class BloomPredictionResult:
    """Container with the trained model metadata and monthly predictions."""

    table: pd.DataFrame
    metadata: Dict[str, object]
    ndvi_forecast: pd.DataFrame

    @property
    def forecast_rows(self) -> pd.DataFrame:
        """Return the subset of rows associated with future forecasts."""

        mask = self.table["status"].isin(["forecast", "future"])
        return self.table.loc[mask].copy()


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


def _compute_monthly_climatology(df: pd.DataFrame, columns: Iterable[str]) -> pd.DataFrame:
    """Return mean value per month for the requested columns."""

    climatology = (
        df.groupby("month")[list(columns)]
        .mean(numeric_only=True)
        .reindex(range(1, 13))
    )
    return climatology


def _add_lag_features(series: ArrayLike, lags: Iterable[int]) -> Dict[int, float]:
    """Return a mapping lag -> value using the most recent observations."""

    values = list(series)
    lag_map: Dict[int, float] = {}
    for lag in lags:
        if len(values) >= lag:
            lag_map[lag] = float(values[-lag])
        elif values:
            lag_map[lag] = float(values[0])
        else:
            lag_map[lag] = 0.0
    return lag_map


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
    forecast_years: int = 3,
) -> BloomPredictionResult:
    """Train an advanced bloom predictor and forecast NDVI for upcoming years."""

    if not 0 < probability_threshold < 1:
        raise ValueError("El umbral de probabilidad debe estar entre 0 y 1.")
    if forecast_years <= 0:
        raise ValueError("El horizonte de pronóstico debe ser positivo.")

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
        classifier = HistGradientBoostingClassifier(max_depth=6, learning_rate=0.1, max_iter=400, random_state=42)
        model_name = "HistGradientBoostingClassifier"

    pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("clf", classifier),
        ]
    )

    X_train = train_df[feature_columns]
    pipeline.fit(X_train, y_train)

    # --- NDVI forecasting model -------------------------------------------------
    ndvi_lags = [1, 2, 12]
    lagged = df.copy()
    for lag in ndvi_lags:
        lagged[f"NDVI_lag_{lag}"] = lagged["NDVI"].shift(lag)

    reg_feature_columns = [
        "month_sin",
        "month_cos",
        "precip_mm",
        "LST_C",
        "soil_moisture",
        "s2_ndvi",
    ] + [f"NDVI_lag_{lag}" for lag in ndvi_lags]

    reg_train = lagged.dropna(subset=[f"NDVI_lag_{lag}" for lag in ndvi_lags]).copy()
    regressor = HistGradientBoostingRegressor(max_depth=6, learning_rate=0.08, max_iter=400, random_state=42)

    reg_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("reg", regressor),
        ]
    )

    if reg_train.empty:
        raise ValueError("No hay suficientes datos históricos para entrenar el modelo de NDVI.")

    reg_X = reg_train[reg_feature_columns]
    reg_y = reg_train["NDVI"].astype(float)
    reg_pipeline.fit(reg_X, reg_y)

    reg_train_pred = reg_pipeline.predict(reg_X)
    ndvi_rmse = float(np.sqrt(mean_squared_error(reg_y, reg_train_pred)))
    ndvi_mae = float(mean_absolute_error(reg_y, reg_train_pred))
    residual_std = float(np.std(reg_y - reg_train_pred, ddof=1)) if len(reg_y) > 1 else ndvi_rmse

    # --- Project future months --------------------------------------------------
    horizon_months = int(forecast_years * 12)
    last_date = df["date"].max()
    future_dates = pd.date_range(last_date + pd.offsets.MonthBegin(), periods=horizon_months, freq="MS")

    climatology_columns = ["precip_mm", "LST_C", "soil_moisture", "s2_ndvi"]
    climatology = _compute_monthly_climatology(df, climatology_columns)
    global_means = {
        col: float(df[col].dropna().mean()) if col in df.columns else 0.0
        for col in climatology_columns
    }

    ndvi_history = df["NDVI"].fillna(df["NDVI"].median()).tolist()
    if not ndvi_history:
        raise ValueError("No hay valores de NDVI disponibles para generar el pronóstico.")
    max_lag = max(ndvi_lags)
    if len(ndvi_history) < max_lag:
        ndvi_history = ([ndvi_history[0]] * (max_lag - len(ndvi_history))) + ndvi_history

    forecast_records = []
    forecast_rows = []

    for date in future_dates:
        month = int(date.month)
        month_sin = float(np.sin(2 * np.pi * month / 12.0))
        month_cos = float(np.cos(2 * np.pi * month / 12.0))

        lag_map = _add_lag_features(ndvi_history, ndvi_lags)

        base_features = {
            "date": date,
            "month": month,
            "month_sin": month_sin,
            "month_cos": month_cos,
        }

        for column in climatology_columns:
            value = climatology.at[month, column] if month in climatology.index else np.nan
            if np.isnan(value):
                value = global_means.get(column, 0.0)
            base_features[column] = float(value)

        for lag, value in lag_map.items():
            base_features[f"NDVI_lag_{lag}"] = value

        reg_features = pd.DataFrame([base_features])[reg_feature_columns]
        ndvi_pred = float(reg_pipeline.predict(reg_features)[0])
        ndvi_pred = float(np.clip(ndvi_pred, 0.0, 1.0))
        ndvi_history.append(ndvi_pred)

        forecast_rows.append(
            {
                **base_features,
                "NDVI": ndvi_pred,
                "LST_C": base_features.get("LST_C"),
                "precip_mm": base_features.get("precip_mm"),
                "soil_moisture": base_features.get("soil_moisture"),
                "s2_ndvi": base_features.get("s2_ndvi"),
                "label_available": False,
                "is_bloom": pd.NA,
                "status": "forecast",
            }
        )

        forecast_records.append(
            {
                "date": date,
                "ndvi": ndvi_pred,
                "lower": float(max(0.0, ndvi_pred - 1.96 * residual_std)) if residual_std else ndvi_pred,
                "upper": float(min(1.0, ndvi_pred + 1.96 * residual_std)) if residual_std else ndvi_pred,
                "source": "forecast",
            }
        )

    future_df = pd.DataFrame(forecast_rows)
    future_df["ndvi_source"] = "forecast"

    df["ndvi_source"] = "observed"

    combined = pd.concat([df, future_df], ignore_index=True, sort=False)
    combined["status"] = np.where(combined["label_available"], "historical", combined["status"].fillna("forecast"))

    X_all = combined[feature_columns]
    if hasattr(pipeline, "predict_proba"):
        proba = pipeline.predict_proba(X_all)[:, 1]
    else:
        proba = pipeline.predict(X_all)

    combined["probability"] = proba
    combined["predicted_label"] = (combined["probability"] >= probability_threshold).astype(int)

    metrics: Dict[str, float | None] = {
        "accuracy": None,
        "roc_auc": None,
        "ndvi_rmse": ndvi_rmse,
        "ndvi_mae": ndvi_mae,
    }

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

    ndvi_historical = df[["date", "NDVI"]].copy()
    ndvi_historical.rename(columns={"NDVI": "ndvi"}, inplace=True)
    ndvi_historical["lower"] = np.nan
    ndvi_historical["upper"] = np.nan
    ndvi_historical["source"] = "historical"

    ndvi_forecast = pd.DataFrame(forecast_records)
    ndvi_series = pd.concat([ndvi_historical, ndvi_forecast], ignore_index=True)
    ndvi_series.sort_values("date", inplace=True)

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
        "forecast": {
            "months": horizon_months,
            "start": future_dates[0].strftime("%Y-%m-%d") if len(future_dates) else None,
            "end": future_dates[-1].strftime("%Y-%m-%d") if len(future_dates) else None,
            "ndvi_model": "HistGradientBoostingRegressor",
            "ndvi_rmse": ndvi_rmse,
            "ndvi_mae": ndvi_mae,
        },
    }

    return BloomPredictionResult(table=combined, metadata=metadata, ndvi_forecast=ndvi_series)

