"""
Prophet-based forecasting engine for KIWASCO.
Supports: revenue, consumption, default_rate, nrw forecasting.
"""
from prophet import Prophet
from prophet.diagnostics import cross_validation, performance_metrics
import pandas as pd
import numpy as np
from datetime import date
from sqlalchemy.orm import Session
from app import models
import warnings
warnings.filterwarnings("ignore")

def get_historical_data(db: Session, zone_id: int, metric: str) -> pd.DataFrame:
    """Pull historical monthly aggregated data from DB for a zone."""
    bills_query = (
        db.query(
            models.Bill.bill_date,
            models.Bill.amount_paid,
            models.Bill.amount_billed,
            models.Bill.units_consumed,
            models.Bill.nrw_loss,
            models.Bill.status,
        )
        .join(models.Customer, models.Bill.customer_id == models.Customer.id)
        .filter(models.Customer.zone_id == zone_id)
        .all()
    )

    if not bills_query:
        return pd.DataFrame()

    df = pd.DataFrame(bills_query, columns=["bill_date", "amount_paid", "amount_billed",
                                             "units_consumed", "nrw_loss", "status"])
    df["bill_date"] = pd.to_datetime(df["bill_date"])
    df["month"] = df["bill_date"].dt.to_period("M").dt.to_timestamp()

    if metric == "revenue":
        monthly = df.groupby("month")["amount_paid"].sum().reset_index()
        monthly.columns = ["ds", "y"]
    elif metric == "consumption":
        monthly = df.groupby("month")["units_consumed"].sum().reset_index()
        monthly.columns = ["ds", "y"]
    elif metric == "nrw":
        monthly = df.groupby("month")["nrw_loss"].sum().reset_index()
        monthly.columns = ["ds", "y"]
    elif metric == "default_rate":
        def default_rate(g):
            total = len(g)
            defaulted = len(g[g["status"].isin(["unpaid", "partial"])])
            return (defaulted / total * 100) if total > 0 else 0
        monthly = df.groupby("month").apply(default_rate).reset_index()
        monthly.columns = ["ds", "y"]
    else:
        return pd.DataFrame()

    monthly = monthly.sort_values("ds").reset_index(drop=True)
    return monthly

def run_prophet_forecast(df: pd.DataFrame, periods: int = 6) -> dict:
    """Train Prophet and return forecast with uncertainty intervals."""
    if df.empty or len(df) < 6:
        return {}

    model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=False,
        daily_seasonality=False,
        changepoint_prior_scale=0.1,
        seasonality_prior_scale=5.0,
        interval_width=0.80,
    )
    # Add custom Kenya rainy season seasonality
    model.add_seasonality(name="long_rains", period=365.25, fourier_order=3)
    model.fit(df)

    future = model.make_future_dataframe(periods=periods, freq="MS")
    forecast = model.predict(future)

    # Only return future months
    future_fc = forecast[forecast["ds"] > df["ds"].max()].copy()
    historical_fc = forecast[forecast["ds"] <= df["ds"].max()].copy()

    # Compute accuracy metrics on in-sample predictions
    merged = df.merge(historical_fc[["ds", "yhat"]], on="ds", how="inner")
    if not merged.empty:
        mae = float(np.mean(np.abs(merged["y"] - merged["yhat"])))
        rmse = float(np.sqrt(np.mean((merged["y"] - merged["yhat"]) ** 2)))
    else:
        mae, rmse = None, None

    results = []
    for _, row in future_fc.iterrows():
        results.append({
            "forecast_month": row["ds"].date(),
            "predicted": max(0, round(float(row["yhat"]), 2)),
            "lower_bound": max(0, round(float(row["yhat_lower"]), 2)),
            "upper_bound": max(0, round(float(row["yhat_upper"]), 2)),
        })

    # Also return historical for chart overlaying
    historical_points = []
    for _, row in forecast.iterrows():
        if row["ds"] <= df["ds"].max():
            actual_row = df[df["ds"] == row["ds"]]
            actual = float(actual_row["y"].values[0]) if not actual_row.empty else None
            historical_points.append({
                "ds": row["ds"].strftime("%Y-%m-%d"),
                "yhat": max(0, round(float(row["yhat"]), 2)),
                "actual": actual,
            })

    return {
        "forecast": results,
        "historical": historical_points,
        "mae": mae,
        "rmse": rmse,
    }

def forecast_zone(db: Session, zone_id: int, metric: str, periods: int = 6) -> dict:
    df = get_historical_data(db, zone_id, metric)
    if df.empty:
        return {"error": "Insufficient data for forecasting", "forecast": [], "historical": []}
    result = run_prophet_forecast(df, periods)
    result["zone_id"] = zone_id
    result["metric"] = metric
    return result
