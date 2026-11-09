from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
import io

from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr, Field
from PIL import Image
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from app.core.config import settings
from app.core.security import hash_password, verify_password, create_token
from app.api.deps import current_user
from app.db import users, analyses, db
from app.services.vision import analyze_with_gemini, demo_analysis
from app.services.material_engine import DATA, MATERIALS, assess_component, recovery_scenarios, recommendations
from app.services.weight import estimate_weight


@asynccontextmanager
async def lifespan(app: FastAPI):
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    if db is not None:
        await db.users.create_index("email", unique=True)
        await db.analyses.create_index([("user_email", 1), ("created_at", -1)])
    yield


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=2, max_length=80)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


@app.get("/api/v1/health")
async def health():
    return {
        "status": "ok",
        "mode": "live" if settings.gemini_api_key else "demo",
        "database": "mongodb" if db is not None else "in-memory demo",
    }


@app.post("/api/v1/auth/register")
async def register(body: RegisterIn):
    email = str(body.email).lower()
    existing = await db.users.find_one({"email": email}) if db is not None else users.get(email)
    if existing:
        raise HTTPException(409, "Email already registered")
    user = {
        "id": str(uuid4()),
        "email": email,
        "full_name": body.full_name,
        "password_hash": hash_password(body.password),
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if db is not None:
        await db.users.insert_one(user.copy())
    users[email] = user
    return {
        "access_token": create_token(email),
        "token_type": "bearer",
        "user": {"id": user["id"], "email": email, "full_name": body.full_name},
    }


@app.post("/api/v1/auth/login")
async def login(body: LoginIn):
    email = str(body.email).lower()
    user = await db.users.find_one({"email": email}) if db is not None else users.get(email)
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Incorrect email or password")
    users[email] = user
    return {
        "access_token": create_token(email),
        "token_type": "bearer",
        "user": {"id": user["id"], "email": email, "full_name": user["full_name"]},
    }


@app.get("/api/v1/auth/me")
async def me(user=Depends(current_user)):
    return {key: user[key] for key in ("id", "email", "full_name", "role")}


@app.post("/api/v1/analyze")
async def analyze(
    image: UploadFile = File(...),
    measured_weight_g: float | None = Form(None),
    user=Depends(current_user),
):
    allowed = {"image/jpeg", "image/png", "image/webp"}
    if image.content_type not in allowed:
        raise HTTPException(415, "Upload a JPEG, PNG or WebP image")
    raw = await image.read()
    if not raw or len(raw) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413 if raw else 400, "Image is empty or exceeds the upload limit")
    try:
        picture = Image.open(io.BytesIO(raw))
        picture.verify()
    except Exception:
        raise HTTPException(400, "Uploaded file is not a valid image")
    try:
        vision = await analyze_with_gemini(raw, image.content_type) if settings.gemini_api_key else demo_analysis()
    except Exception as exc:
        raise HTTPException(502, f"AI analysis failed; no demo result substituted: {type(exc).__name__}")

    components = [assess_component(component) for component in vision["components"]]
    weight = estimate_weight(vision["product_name"], measured_weight_g)
    recovery = recovery_scenarios(components, weight["expected_g"])
    product_recommendations = recommendations(recovery)
    record = {
        "id": str(uuid4()),
        "user_email": user["email"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "filename": image.filename,
        "product": vision,
        "components": components,
        "weight": weight,
        "recovery": recovery,
        "recommendations": product_recommendations,
        "mode": "live" if settings.gemini_api_key else "demo",
    }
    if db is not None:
        await db.analyses.insert_one(record.copy())
    analyses[record["id"]] = record
    return {key: value for key, value in record.items() if key != "user_email"}


@app.get("/api/v1/analyses")
async def list_analyses(user=Depends(current_user)):
    items = [item for item in analyses.values() if item["user_email"] == user["email"]]
    if db is not None:
        items = await db.analyses.find(
            {"user_email": user["email"]}, {"_id": 0}
        ).sort("created_at", -1).limit(100).to_list(100)
    items.sort(key=lambda item: item["created_at"], reverse=True)
    return [
        {
            "id": item["id"],
            "product_name": item["product"]["product_name"],
            "created_at": item["created_at"],
            "mode": item["mode"],
        }
        for item in items
    ]


@app.get("/api/v1/analyses/{analysis_id}")
async def get_analysis(analysis_id: str, user=Depends(current_user)):
    item = analyses.get(analysis_id)
    if item is None and db is not None:
        item = await db.analyses.find_one(
            {"id": analysis_id, "user_email": user["email"]}, {"_id": 0}
        )
    if not item or item["user_email"] != user["email"]:
        raise HTTPException(404, "Analysis not found")
    return {key: value for key, value in item.items() if key != "user_email"}


@app.delete("/api/v1/analyses/{analysis_id}")
async def delete_analysis(analysis_id: str, user=Depends(current_user)):
    item = analyses.get(analysis_id)
    if item and item["user_email"] == user["email"]:
        del analyses[analysis_id]
        if db is not None:
            await db.analyses.delete_one({"id": analysis_id, "user_email": user["email"]})
    elif db is not None:
        result = await db.analyses.delete_one({"id": analysis_id, "user_email": user["email"]})
        if not result.deleted_count:
            raise HTTPException(404, "Analysis not found")
    else:
        raise HTTPException(404, "Analysis not found")
    return {"deleted": True}


@app.get("/api/v1/materials")
async def materials(q: str | None = None):
    query = (q or "").lower()
    return [
        material for material in DATA
        if not query or query in (material["id"] + material["name"] + material["family"]).lower()
    ]


@app.get("/api/v1/dashboard/summary")
async def dashboard(user=Depends(current_user)):
    items = [item for item in analyses.values() if item["user_email"] == user["email"]]
    if db is not None:
        items = await db.analyses.find(
            {"user_email": user["email"]}, {"_id": 0}
        ).to_list(500)
    return {
        "total_scans": len(items),
        "live_scans": sum(item["mode"] == "live" for item in items),
        "demo_scans": sum(item["mode"] == "demo" for item in items),
        "recent_scans": [
            {
                "id": item["id"],
                "product_name": item["product"]["product_name"],
                "created_at": item["created_at"],
            }
            for item in sorted(items, key=lambda item: item["created_at"], reverse=True)[:5]
        ],
    }


@app.get("/api/v1/recommendations/{analysis_id}")
async def get_recommendations(analysis_id: str, user=Depends(current_user)):
    item = await get_analysis(analysis_id, user)
    return item["recommendations"]


@app.get("/api/v1/analyses/{analysis_id}/report.pdf")
async def report(analysis_id: str, user=Depends(current_user)):
    item = await get_analysis(analysis_id, user)
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    page_width, page_height = A4
    y = page_height - 48

    def line(text: str, size: int = 10):
        nonlocal y
        pdf.setFont("Helvetica", size)
        pdf.drawString(42, y, str(text)[:110])
        y -= 16
        if y < 55:
            pdf.showPage()
            y = page_height - 48

    line("EcoVision AI — Waste Analysis Report", 16)
    line(f"Product: {item['product']['product_name']}", 12)
    line(f"Mode: {item['mode'].upper()} | Created: {item['created_at']}")
    line("Components", 12)
    for component in item["components"]:
        material = MATERIALS.get(component["material_id"], {})
        line(
            f"- {component['component_name']}: {component['material_id']} "
            f"({material.get('recycling_status', 'unknown')})"
        )
        line(f"  {component.get('technical_explanation', '')}")
    line("Weight estimate", 12)
    line(str(item["weight"]))
    line("Recovery scenarios", 12)
    for entry in item["recovery"]:
        line(
            f"{entry['component_name']}: expected {entry['expected_g']} g; "
            f"range {entry['conservative_g']}–{entry['optimistic_g']} g"
        )
    line("Limitations", 12)
    line(item["product"].get("limitations", "Visual material identification is not laboratory verification."))
    pdf.save()
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=ecovision-{analysis_id}.pdf"},
    )


@app.get("/api/v1/admin/status")
async def admin_status(user=Depends(current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    return {
        "users": len(users),
        "analyses": len(analyses),
        "gemini_configured": bool(settings.gemini_api_key),
        "mongodb_configured": db is not None,
    }
