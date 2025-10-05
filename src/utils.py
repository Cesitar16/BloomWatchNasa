# src/utils.py
from __future__ import annotations
import os
import pandas as pd

def ensure_monthly_date(df: pd.DataFrame, date_col: str = "date") -> pd.DataFrame:
    """
    Fuerza la columna 'date' a datetime mensual (primer día de mes).
    Acepta strings o datetimes.
    """
    if date_col not in df.columns:
        raise ValueError(f"No existe columna '{date_col}'.")

    # parse robusto
    df[date_col] = pd.to_datetime(df[date_col], errors="coerce", utc=False)
    # normalizar a mes (primer día)
    df[date_col] = df[date_col].dt.to_period("M").dt.to_timestamp()
    return df

def load_month_csv(path: str, value_cols_map: dict[str, str]) -> pd.DataFrame:
    """
    Carga un CSV mensual con columna 'date' y renombra columnas de valor siguiendo value_cols_map.
    value_cols_map: {col_en_csv: nombre_estandar}
    Retorna solo ['date', ...columnas estandar...], sin duplicados y ordenado.
    """
    if not os.path.exists(path):
        raise FileNotFoundError(path)

    df = pd.read_csv(path)
    df = ensure_monthly_date(df, "date")

    # Renombrar columnas solicitadas si existen
    rename_dict = {k: v for k, v in value_cols_map.items() if k in df.columns}
    df = df.rename(columns=rename_dict)

    # Filtrar solo columnas de interés
    keep = ["date"] + list(rename_dict.values())
    df = df.loc[:, [c for c in keep if c in df.columns]]

    # Eliminar duplicados, ordenar
    df = df.drop_duplicates(subset=["date"]).sort_values("date").reset_index(drop=True)
    return df
