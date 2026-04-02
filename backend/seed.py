"""
seed.py — Populate KIWASCO database with synthetic billing data.
Run: python seed.py

Generates:
  - 7 zones
  - ~2,600 customers
  - ~36 months of billing history (Jan 2022 – Dec 2024)
  - 1 admin + 2 demo users
  - System alerts
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from datetime import date
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app import models
from app.database import Base
from app.auth import get_password_hash
from app.ml.data_generator import (
    ZONES, generate_customers, generate_bills,
    get_zone_customer_count,
)

Base.metadata.create_all(bind=engine)

START_DATE = date(2022, 1, 1)
END_DATE   = date(2025, 1, 1)  # exclusive

def months_between(start: date, end: date) -> int:
    delta = relativedelta(end, start)
    return delta.years * 12 + delta.months

def seed():
    db: Session = SessionLocal()
    try:
        # ── Guard: skip if already seeded ─────────────────────────────────
        if db.query(models.Zone).count() > 0:
            print("✅ Database already seeded — skipping.")
            return

        print("🌱 Seeding KIWASCO database...")

        # ── Zones ─────────────────────────────────────────────────────────
        zone_objs = []
        for zd in ZONES:
            z = models.Zone(**zd)
            db.add(z)
            zone_objs.append(z)
        db.flush()
        print(f"  ✔ {len(zone_objs)} zones created")

        # ── Users ─────────────────────────────────────────────────────────
        users = [
            models.User(
                username="admin", email="admin@kiwasco.go.ke",
                full_name="KIWASCO Administrator",
                hashed_password=get_password_hash("admin1234"),
                role="admin", is_active=True,
            ),
            models.User(
                username="analyst", email="analyst@kiwasco.go.ke",
                full_name="Revenue Analyst",
                hashed_password=get_password_hash("analyst1234"),
                role="analyst", is_active=True,
            ),
            models.User(
                username="viewer", email="viewer@kiwasco.go.ke",
                full_name="Management Viewer",
                hashed_password=get_password_hash("viewer1234"),
                role="viewer", is_active=True,
            ),
        ]
        for u in users:
            db.add(u)
        print(f"  ✔ {len(users)} users created")

        # ── Customers + Bills ─────────────────────────────────────────────
        months = months_between(START_DATE, END_DATE)
        total_bills = 0
        total_customers = 0

        for zone in zone_objs:
            count = get_zone_customer_count(zone.name, zone.population)
            # Cap for performance during seeding
            count = min(count, 150)
            customer_dicts = generate_customers(zone.id, zone.name, count)

            for cd in customer_dicts:
                conn_date = cd.pop("connection_date", START_DATE)
                c = models.Customer(**cd, connection_date=conn_date)
                db.add(c)
                db.flush()

                bill_dicts = generate_bills(
                    c.id, zone.name, c.customer_type.value,
                    start_month=START_DATE, months=months,
                )
                for bd in bill_dicts:
                    db.add(models.Bill(**bd))
                total_bills += len(bill_dicts)
            total_customers += count
            print(f"    → {zone.name}: {count} customers, {count * months} bills")

        print(f"  ✔ {total_customers} customers, {total_bills} bills created")

        # ── Alerts ────────────────────────────────────────────────────────
        alerts_data = [
            {"zone_id": None, "message": "System initialized with synthetic KIWASCO billing data.",
             "threshold_type": "info", "severity": "info"},
            {"zone_id": zone_objs[3].id, "message": f"{zone_objs[3].name}: NRW rate exceeds 35% threshold. Pipe inspection recommended.",
             "threshold_type": "high_nrw", "severity": "critical"},
            {"zone_id": zone_objs[1].id, "message": f"{zone_objs[1].name}: Default rate above 20% for 3 consecutive months.",
             "threshold_type": "defaulter_surge", "severity": "warning"},
            {"zone_id": zone_objs[4].id, "message": f"{zone_objs[4].name}: Revenue collection below 70% of monthly target.",
             "threshold_type": "revenue_drop", "severity": "warning"},
            {"zone_id": zone_objs[0].id, "message": f"{zone_objs[0].name}: Demand projected to exceed supply capacity by Q3 2025.",
             "threshold_type": "capacity_risk", "severity": "critical"},
        ]
        for ad in alerts_data:
            db.add(models.Alert(**ad))

        db.commit()
        print("\n✅ Seeding complete!")
        print("\n📋 Login credentials:")
        print("   Admin:   username=admin    password=admin1234")
        print("   Analyst: username=analyst  password=analyst1234")
        print("   Viewer:  username=viewer   password=viewer1234")

    except Exception as e:
        db.rollback()
        print(f"❌ Seed failed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed()
