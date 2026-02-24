# Video Analytics Workspace

This repository contains a FastAPI backend and a React/Vite frontend for video person-count analytics.

## Project structure

- `backend/`: upload, processing, analytics APIs, and generated artifacts
- `frontend/`: dashboard and upload UI

## Prerequisites

- Python 3.10+
- Node.js 18+
- npm

## Run both services from repo root

Install frontend dependencies first:

```bash
cd frontend
npm install
cd ..
```

Start backend + frontend together:

```bash
npm run full
```

Default URLs:

- Frontend (workspace script): `http://localhost:5173`
- Backend API: `http://localhost:8000`

## Run services separately

Backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Default frontend dev URL (direct frontend command): `http://localhost:8080`

## Notes

- Generated files are written to `backend/uploads/` and `backend/outputs/`.
- Dashboard behavior:
  - `Total Videos` always shows overall processed-video count.
  - Other analytics are shown after selecting a video via `View`.
