"""
Forecasting engine for KIWASCO.
Uses Holt-Winters Exponential Smoothing (statsmodels) — lightweight,
reliable, and runs comfortably on free-tier hosting (< 100 MB RAM).

Supports: revenue, consumption, default_rate, nrw forecasting.
"""
import pandas as pd
import numpy as np
from datetime import date
from dateutil.relativedelta import relativedelta
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
    monthly = monthly.dropna()
    monthly["y"] = pd.to_numeric(monthly["y"], errors="coerce").fillna(0.0)
    return monthly


def run_forecast(df: pd.DataFrame, periods: int = 6) -> dict:
    """
    Train a Holt-Winters Exponential Smoothing model and return forecast
    with uncertainty intervals (estimated from in-sample residuals).
    """
    from statsmodels.tsa.holtwinters import ExponentialSmoothing

    if df.empty or len(df) < 6:
        return {"error": "Need at least 6 months of data to forecast."}

    # Prepare a clean time series
    ts = df.set_index("ds")["y"].asfreq("MS")
    ts = ts.fillna(method="ffill").fillna(0)

    n = len(ts)
    # Use seasonal_periods=12 if we have at least 2 full years, else trend-only
    use_seasonal = n >= 24

    try:
        if use_seasonal:
            model = ExponentialSmoothing(
                ts,
                trend="add",
                seasonal="add",
                seasonal_periods=12,
                initialization_method="estimated",
            ).fit(optimized=True)
        else:
            model = ExponentialSmoothing(
                ts,
                trend="add",
                seasonal=None,
                initialization_method="estimated",
            ).fit(optimized=True)
    except Exception as e:
        print(f"Holt-Winters fit failed: {e}")
        return {"error": f"Model fitting failed: {e}", "forecast": [], "historical": []}

    # In-sample fitted values for accuracy metrics
    fitted = model.fittedvalues
    residuals = ts - fitted
    residual_std = float(residuals.std()) if len(residuals) > 1 else 0.0

    # Compute accuracy metrics
    mae = float(np.mean(np.abs(residuals)))
    rmse = float(np.sqrt(np.mean(residuals ** 2)))

    # Forecast future periods
    forecast_values = model.forecast(periods)

    # Build forecast result rows with uncertainty bands
    z_80 = 1.28  # z-score for 80% prediction interval
    results = []
    for i, (dt, yhat) in enumerate(forecast_values.items()):
        # Widen uncertainty slightly for each step ahead
        step_std = residual_std * np.sqrt(1 + i * 0.1)
        results.append({
            "forecast_month": dt.date() if hasattr(dt, "date") else dt,
            "predicted": max(0, round(float(yhat), 2)),
            "lower_bound": max(0, round(float(yhat - z_80 * step_std), 2)),
            "upper_bound": max(0, round(float(yhat + z_80 * step_std), 2)),
        })

    # Historical data points (actual + model fit) for chart overlay
    historical_points = []
    for dt in ts.index:
        actual_val = float(ts[dt])
        fitted_val = float(fitted[dt]) if dt in fitted.index else actual_val
        historical_points.append({
            "ds": dt.strftime("%Y-%m-%d"),
            "yhat": max(0, round(fitted_val, 2)),
            "actual": round(actual_val, 2),
        })

    return {
        "forecast": results,
        "historical": historical_points,
        "mae": round(mae, 2),
        "rmse": round(rmse, 2),
    }


def forecast_zone(db: Session, zone_id: int, metric: str, periods: int = 6) -> dict:
    """Entry point called by the /api/forecasts/run endpoint."""
    df = get_historical_data(db, zone_id, metric)
    if df.empty:
        return {"error": "Insufficient data for forecasting", "forecast": [], "historical": []}
    result = run_forecast(df, periods)
    if "error" in result and "forecast" not in result:
        result["forecast"] = []
        result["historical"] = []
    result["zone_id"] = zone_id
    result["metric"] = metric
    return result
