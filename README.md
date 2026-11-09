# EcoVision AI

**Turning Waste into Intelligent Recovery Opportunities.**

A full-stack waste-image analysis prototype with React + TypeScript and FastAPI. It combines optional Gemini Vision, deterministic material rules, recovery calculations, optional YOLO object detection, authentication, scan history, and PDF reporting.

> Demo mode uses synthetic fixture data and is labelled. Live model outputs are visual inference, not laboratory material verification. Generic YOLO weights identify object classes, not chemical composition. Photo-only weight estimates are uncertain; a measured weight is preferred.

## Features

- JWT registration/login with Argon2 password hashing
- JPEG/PNG/WebP upload validation
- Gemini Vision integration with structured response validation
- Reference knowledge for PET, HDPE, LDPE, PVC, PP, PS, aluminium, steel, copper, glass, paper, cardboard, textiles, rubber, wood and mixed e-waste
- Component-level recycling assessment
- Measured-weight support and transparent mass-balance scenarios
- Indicative recycled-product pathways and processing requirements
- Scan history, dashboard summary, per-user authorization and PDF export
- Optional OpenCV + YOLO adapter; no claim of chemical composition detection
- Responsive React dashboard, scanner, results, history and material explorer

## Structure

```text
frontend/                 React, TypeScript, Vite, Tailwind
backend/app/api/          FastAPI auth dependencies
backend/app/core/         Settings and security
backend/app/services/     Gemini, OpenCV/YOLO, materials and weight
backend/app/data/         Material reference JSON
backend/tests/            Backend tests
docker-compose.yml        MongoDB + API + frontend
```

## Run locally

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Set a strong SECRET_KEY. Set GEMINI_API_KEY for live image analysis.
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Set `VITE_API_URL` to override the default API URL.

### Docker

```bash
cp backend/.env.example backend/.env
# Edit backend/.env and set a strong SECRET_KEY and optional GEMINI_API_KEY.
docker compose up --build
```

## Environment

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | JWT signing secret; replace the development value |
| `GEMINI_API_KEY` | Enables live Gemini Vision; server-side only |
| `GEMINI_MODEL` | Gemini model name |
| `MONGO_URI` | Optional MongoDB connection string; unset uses in-memory demo storage |
| `MONGO_DB` | Database name |
| `MAX_UPLOAD_MB` | Upload limit |
| `UPLOAD_DIR` | Upload directory |

## API

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/analyze`
- `GET /api/v1/analyses`
- `GET /api/v1/analyses/{id}`
- `DELETE /api/v1/analyses/{id}`
- `GET /api/v1/materials?q=`
- `GET /api/v1/dashboard/summary`
- `GET /api/v1/recommendations/{id}`
- `GET /api/v1/analyses/{id}/report.pdf`
- `GET /api/v1/health`

## Tests

```bash
cd backend
pip install -r requirements.txt
pytest -q
```

## Limitations and production hardening

This is a demonstrable baseline, not a certified industrial recycling system. Localize material rules to municipal collection and processor specifications. Recommendations are indicative, not commercial feasibility guarantees. Material percentages inferred by Gemini are not independently verified. Environmental impacts are not fabricated where defensible lifecycle factors are missing. Before public production deployment, add refresh-token rotation, rate limiting, audit-event persistence, malware scanning, object storage, retention controls, admin CRUD, trained domain-specific segmentation, and database-only access across workers.
