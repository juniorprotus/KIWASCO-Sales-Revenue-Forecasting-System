"""
Synthetic data generator for KIWASCO billing system.
Models real-world patterns: seasonal demand, zone demographics, default rates.
"""
import random
import math
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
import pandas as pd
import numpy as np

# ── KIWASCO zone definitions ──────────────────────────────────────────────────
ZONES = [
    {"name": "Kisumu Central",  "population": 85000, "area_sqkm": 12.4, "target_revenue": 4_200_000},
    {"name": "Kondele",         "population": 62000, "area_sqkm": 9.8,  "target_revenue": 2_800_000},
    {"name": "Manyatta",        "population": 78000, "area_sqkm": 11.2, "target_revenue": 3_500_000},
    {"name": "Nyalenda",        "population": 55000, "area_sqkm": 8.5,  "target_revenue": 2_200_000},
    {"name": "Mamboleo",        "population": 41000, "area_sqkm": 15.3, "target_revenue": 1_900_000},
    {"name": "Riat",            "population": 29000, "area_sqkm": 22.1, "target_revenue": 1_100_000},
    {"name": "Kajulu",          "population": 24000, "area_sqkm": 18.7, "target_revenue": 950_000},
]

# Tariff tiers (KES per cubic meter)
TARIFF_TIERS = {
    "domestic":      [(0, 6, 50), (6, 20, 65), (20, float("inf"), 85)],
    "commercial":    [(0, 50, 90), (50, float("inf"), 110)],
    "industrial":    [(0, float("inf"), 130)],
    "institutional": [(0, float("inf"), 95)],
}

# Seasonal multipliers for Kisumu (Jan-Dec)
# Long rains: Mar-May (high demand), Short rains: Oct-Nov, Dry: Jun-Sep & Dec-Feb
SEASONAL_MULTIPLIERS = [0.88, 0.85, 1.18, 1.25, 1.20, 0.92, 0.88, 0.85, 0.90, 1.05, 1.08, 0.90]

# Default rate by zone (higher in lower-income areas)
ZONE_DEFAULT_RATES = {
    "Kisumu Central": 0.12,
    "Kondele":        0.22,
    "Manyatta":       0.19,
    "Nyalenda":       0.28,
    "Mamboleo":       0.24,
    "Riat":           0.20,
    "Kajulu":         0.18,
}

# NRW loss rate by zone
ZONE_NRW_RATES = {
    "Kisumu Central": 0.20,
    "Kondele":        0.32,
    "Manyatta":       0.28,
    "Nyalenda":       0.38,
    "Mamboleo":       0.30,
    "Riat":           0.25,
    "Kajulu":         0.22,
}

CUSTOMER_TYPE_DIST = {"domestic": 0.78, "commercial": 0.13, "industrial": 0.03, "institutional": 0.06}
BASE_CONSUMPTION = {"domestic": 14.0, "commercial": 55.0, "industrial": 280.0, "institutional": 120.0}

def calculate_bill(units: float, ctype: str) -> float:
    tiers = TARIFF_TIERS.get(ctype, TARIFF_TIERS["domestic"])
    total = 0.0
    for lo, hi, rate in tiers:
        if units <= lo:
            break
        billable = min(units, hi) - lo
        total += billable * rate
    # Add 16% VAT
    return round(total * 1.16, 2)

def generate_customers(zone_id: int, zone_name: str, count: int):
    customers = []
    for i in range(1, count + 1):
        ctype = random.choices(
            list(CUSTOMER_TYPE_DIST.keys()),
            weights=list(CUSTOMER_TYPE_DIST.values())
        )[0]
        acc_no = f"KWS{zone_id:02d}{i:04d}"
        meter_no = f"MTR{zone_id:02d}{i:04d}"
        conn_date = date(2015, 1, 1) + timedelta(days=random.randint(0, 3000))
        customers.append({
            "zone_id": zone_id,
            "account_no": acc_no,
            "name": f"Customer {acc_no}",
            "customer_type": ctype,
            "meter_no": meter_no,
            "phone": f"07{random.randint(10000000, 99999999)}",
            "address": f"{zone_name} Area {random.randint(1,50)}",
            "connection_date": conn_date,
            "is_active": random.random() > 0.05,
        })
    return customers

def generate_bills(customer_id: int, zone_name: str, ctype: str, start_month: date, months: int):
    bills = []
    base = BASE_CONSUMPTION.get(ctype, 14.0)
    default_rate = ZONE_DEFAULT_RATES.get(zone_name, 0.20)
    nrw_rate = ZONE_NRW_RATES.get(zone_name, 0.25)

    current = start_month
    for _ in range(months):
        # Seasonal + random noise
        seasonal = SEASONAL_MULTIPLIERS[current.month - 1]
        # Trend: 2% annual growth
        years_elapsed = (current - date(2022, 1, 1)).days / 365.25
        trend = 1 + 0.02 * years_elapsed
        noise = random.gauss(1.0, 0.08)

        units = max(1.0, base * seasonal * trend * noise)
        amount_billed = calculate_bill(units, ctype)
        nrw = round(units * nrw_rate * random.gauss(1.0, 0.05), 2)

        # Payment behaviour
        is_defaulter = random.random() < default_rate
        if is_defaulter:
            partial = random.random() < 0.4  # 40% of defaulters pay partial
            if partial:
                amount_paid = round(amount_billed * random.uniform(0.1, 0.6), 2)
                status = "partial"
            else:
                amount_paid = 0.0
                status = "unpaid"
            payment_date = None
        else:
            amount_paid = amount_billed
            status = "paid"
            days_to_pay = random.randint(1, 28)
            payment_date = current + timedelta(days=days_to_pay)

        bills.append({
            "customer_id": customer_id,
            "units_consumed": round(units, 2),
            "amount_billed": amount_billed,
            "amount_paid": amount_paid,
            "bill_date": current,
            "due_date": current + timedelta(days=21),
            "payment_date": payment_date,
            "status": status,
            "nrw_loss": nrw,
        })
        current = current + relativedelta(months=1)
    return bills

def get_zone_customer_count(zone_name: str, population: int) -> int:
    """Approx 1 connection per 5.2 people (KIWASCO avg)."""
    return int(population / 5.2)
