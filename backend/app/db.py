from app.core.config import settings

try:
    from motor.motor_asyncio import AsyncIOMotorClient
    client = AsyncIOMotorClient(settings.mongo_uri) if settings.mongo_uri else None
except ImportError:
    client = None

db = client[settings.mongo_db] if client else None
# In-memory fallback is intended for local demo only.
users: dict[str, dict] = {}
analyses: dict[str, dict] = {}
