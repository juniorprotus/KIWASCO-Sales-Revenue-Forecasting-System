# KIWASCO Sales & Revenue Forecasting System

An AI-powered digital transformation project for the Kisumu Water & Sewerage Company (KIWASCO). This system provides actionable insights into water demand, revenue collection, and non-revenue water (NRW) losses using Facebook (Meta) Prophet machine learning models.

## 🚀 Why This Project Exists
This project was built to transition KIWASCO from reactive to proactive operations. By leveraging historical billing and consumption data, the system predicts future demand, detects anomalies, and forecasts revenue collection.

## 🛠️ Tech Stack
- **Frontend**: React (Vite)
- **Backend**: Python (FastAPI)
- **Database**: SQLite (100% Free, Local, No Configuration Required)
- **Machine Learning**: Meta Prophet
- **Hosting**: Pre-configured for Render (Free Tier)

---

## 💻 How to Run Locally

Because this project is designed to be **completely free** with zero credit card requirements, the backend uses a local SQLite database file (`kiwasco.db`). This means you don't have to install PostgreSQL or configure any complex database connections!

### 1. Start the Backend
The backend powers all the data, Prophet Machine Learning forecasts, and the API.
```bash
cd backend
uv venv --python 3.11
uv pip install -r requirements.txt

# Generate the initial data
uv run python seed.py

# Start the server
uv run uvicorn app.main:app --reload
```
*The backend will now be running on `http://localhost:8000`*

### 2. Start the Frontend
The frontend is the beautiful React user interface. **Note:** You must have Node.js installed to run the frontend locally.
```bash
cd frontend
npm install
npm run dev
```
*The frontend will now be running on `http://localhost:5173` (or whatever port Vite gives you)*

---

## ☁️ How to Host for Free (Render)

This repository includes a `render.yaml` file pre-configured to host both your frontend and backend on Render's free tier. 

1. Push this repository to your GitHub account.
2. Create an account on [Render.com](https://render.com).
3. Click "New" -> "Blueprint".
4. Connect your GitHub repository.
5. Render will automatically read the `render.yaml` file, install Python, install Node.js, and host both the API and the React frontend completely for free!

*(Note: On Render's free tier, the SQLite database resets on every new code deployment. To fix this, the backend automatically runs `seed.py` to regenerate the KIWASCO demonstration data for the dashboard every time it boots!)*
