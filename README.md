# KIWASCO Sales & Revenue Forecasting System

An AI-powered digital transformation project for the **Kisumu Water & Sewerage Company (KIWASCO)**. This system provides actionable insights into water demand, revenue collection, and non-revenue water (NRW) losses using Facebook (Meta) Prophet machine learning models.

![KIWASCO Dashboard](https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=1200)

## 🚀 Features

- **Executive Dashboard**: Real-time performance metrics, revenue trends, and zone-wise collection tracking.
- **AI Forecasting Engine**: Predictive analytics for Sales, Demand, NRW, and Defaulter Rates (3–12 months horizon).
- **Billing & Revenue Analytics**: Detailed tracking of billed vs. collected revenue with gap analysis.
- **Customer Analytics**: Comprehensive customer records, active/inactive status, and defaulter risk tiering.
- **Service Zone Profiles**: Geographical performance breakdown, population density, and revenue targets.
- **Report Generation**: Annual summaries with professional Excel exports using `openpyxl`.
- **Advanced Security**: Secure JWT authentication with Role-Based Access Control (Admin, Analyst, Viewer).

## 🛠️ Technology Stack

- **Frontend**: React 18, Vite, Recharts (Data Viz), Lucide React (Icons), React Router 6.
- **Backend**: Python 3.11, FastAPI, SQLAlchemy (ORM), PostgreSQL.
- **AI/ML**: Facebook Prophet (Time-series forecasting model), Pandas, NumPy.
- **Deployment**: Render (Blueprint/Infrastructure-as-Code).

## 📂 Project Structure

```text
├── backend/
│   ├── app/
│   │   ├── ml/             # Prophet model logic & data generator
│   │   ├── routers/        # FastAPI endpoints
│   │   ├── models.py       # SQL Alchemy database models
│   │   ├── main.py         # App entry point & setup endpoints
│   ├── seed.py             # Database initialization script
│   └── requirements.txt    # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── pages/          # React components for each module
│   │   ├── api/            # Axios client services
│   │   ├── index.css       # Custom design system (Vanilla CSS)
│   ├── package.json        # Frontend dependencies
│   └── vite.config.js
├── render.yaml             # Render deployment configuration
└── README.md
```

## ⚙️ Setup & Installation

### 1. Prerequisite: Database Setup
The system requires a PostgreSQL database. On Render, this is automatically provisioned via the `render.yaml` blueprint.

### 2. Local Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
# Run the local server
uvicorn app.main:app --reload
```

### 3. Local Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## ☁️ Deployment (Cloud)

1. **GitHub**: Push this repository to your GitHub account.
2. **Render**: 
   - Log in to your Render dashboard.
   - Click **New** -> **Blueprint**.
   - Connect this repository.
   - Render will automatically create the Postgres DB, FastAPI backend, and React static frontend.
3. **Seeding (Crucial)**:
   - Once the services are active, go to the **Login Page** of your live app.
   - Click the **"Setup Cloud DB"** button in the Demo Accounts section.
   - This will populate the database with 3 years of billing history and the demo accounts.

## 🔑 Demo Access

| Role | Username | Password |
| :--- | :--- | :--- |
| **Admin** | `admin` | `admin1234` |
| **Analyst** | `analyst` | `analyst1234` |
| **Viewer** | `viewer` | `viewer1234` |

---

Developed as a Digital Transformation Solution for KIWASCO.
