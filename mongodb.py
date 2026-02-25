import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")

client = AsyncIOMotorClient(MONGO_URI)
# Use a specific database name
db = client.ainewsplatform

# Collections
users_collection = db.get_collection("users")
articles_collection = db.get_collection("articles")
metrics_collection = db.get_collection("metrics")

# Helper map to stringify ObjectIDs
def item_helper(item) -> dict:
    if not item:
        return None
    item["id"] = str(item["_id"])
    del item["_id"]
    return item
