import io
from uuid import uuid4
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app


def png_bytes():
    stream = io.BytesIO()
    Image.new("RGB", (64, 64), (20, 130, 70)).save(stream, format="PNG")
    return stream.getvalue()


def register(client, name="Test Person"):
    email = f"{uuid4().hex}@example.com"
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "strong-password-123", "full_name": name},
    )
    assert response.status_code == 200
    return email, response.json()["access_token"]


def test_auth_and_protected_profile():
    with TestClient(app) as client:
        email, token = register(client)
        headers = {"Authorization": f"Bearer {token}"}
        assert client.get("/api/v1/auth/me", headers=headers).status_code == 200
        assert client.get("/api/v1/auth/me").status_code == 401
        assert client.post(
            "/api/v1/auth/login", json={"email": email, "password": "wrong-password"}
        ).status_code == 401


def test_scan_history_pdf_and_owner_access():
    with TestClient(app) as client:
        _, token = register(client, "Scan Owner")
        headers = {"Authorization": f"Bearer {token}"}
        scan = client.post(
            "/api/v1/analyze",
            headers=headers,
            files={"image": ("sample.png", png_bytes(), "image/png")},
        )
        assert scan.status_code == 200, scan.text
        result = scan.json()
        assert result["mode"] == "demo"
        assert len(result["components"]) == 2
        assert client.get(f"/api/v1/analyses/{result['id']}", headers=headers).status_code == 200
        pdf = client.get(f"/api/v1/analyses/{result['id']}/report.pdf", headers=headers)
        assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
        _, other_token = register(client, "Other User")
        other_headers = {"Authorization": f"Bearer {other_token}"}
        assert client.get(
            f"/api/v1/analyses/{result['id']}", headers=other_headers
        ).status_code == 404
        assert client.delete(f"/api/v1/analyses/{result['id']}", headers=headers).status_code == 200


def test_reject_invalid_image_content_type():
    with TestClient(app) as client:
        _, token = register(client)
        response = client.post(
            "/api/v1/analyze",
            headers={"Authorization": f"Bearer {token}"},
            files={"image": ("notes.txt", b"not an image", "text/plain")},
        )
        assert response.status_code == 415
