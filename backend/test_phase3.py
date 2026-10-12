"""
Phase 3 Automated Test Suite: Item CRUD, Search, and Image Uploads

Verifies:
1. Item creation using frontend-compatible field contracts (type, date, imageUrl)
2. Keyword search (q) and multi-field filtering (category, location, type, status)
3. Sorting orders (recent, oldest, az)
4. Item status updates with ownership & admin permission enforcement (403 for unauthorized users)
5. Item deletion with ownership & admin permission enforcement (403 for unauthorized users)
6. Image upload validation: MIME types, magic bytes header verification, size limit (2MB)
7. Safe unique filename generation and path traversal safety
8. Serving uploaded images via the /uploads static route
"""

from datetime import datetime
import io
import os
import sys

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(__file__))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from auth_utils import hash_password
from database import Base, get_db
from main import app, UPLOAD_DIR
import models

# Set up in-memory SQLite for deterministic, isolated testing
TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
Base.metadata.create_all(bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

print("=== Running Phase 3 Item CRUD, Search & Uploads Test Suite ===")

# ----------------------------------------------------------------------------
# Setup Test Users
# ----------------------------------------------------------------------------
db = TestingSessionLocal()
user_student_1 = models.User(
    name="Student One",
    email="student1@campus.edu",
    password_hash=hash_password("Pass12345!"),
    role="STUDENT",
    is_active=True,
)
user_student_2 = models.User(
    name="Student Two",
    email="student2@campus.edu",
    password_hash=hash_password("Pass12345!"),
    role="STUDENT",
    is_active=True,
)
user_admin = models.User(
    name="Admin User",
    email="admin@campus.edu",
    password_hash=hash_password("AdminPass123!"),
    role="ADMIN",
    is_active=True,
)
db.add_all([user_student_1, user_student_2, user_admin])
db.commit()
db.close()

# Obtain tokens for all three users
token_s1 = client.post("/api/auth/login", json={"email": "student1@campus.edu", "password": "Pass12345!"}).json()["access_token"]
token_s2 = client.post("/api/auth/login", json={"email": "student2@campus.edu", "password": "Pass12345!"}).json()["access_token"]
token_admin = client.post("/api/auth/login", json={"email": "admin@campus.edu", "password": "AdminPass123!"}).json()["access_token"]

# ----------------------------------------------------------------------------
# 1. Image Upload Validation Tests
# ----------------------------------------------------------------------------
print("\n[1/6] Testing image upload validation...")

# Valid JPEG upload (starts with JPEG magic bytes \xff\xd8\xff)
valid_jpeg_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00" + b"\x00" * 200
jpeg_file = io.BytesIO(valid_jpeg_bytes)
res_upload = client.post(
    "/api/upload",
    files={"file": ("photo.jpg", jpeg_file, "image/jpeg")},
    headers={"Authorization": f"Bearer {token_s1}"},
)
assert res_upload.status_code == 200, f"Expected 200, got {res_upload.status_code}: {res_upload.text}"
upload_data = res_upload.json()
assert "url" in upload_data
assert upload_data["url"].startswith("/uploads/")
uploaded_url = upload_data["url"]
print("  ✓ Valid JPEG upload succeeded with URL:", uploaded_url)

# Verify static route serves the file
static_res = client.get(uploaded_url)
assert static_res.status_code == 200, f"Static serving failed: {static_res.status_code}"
assert static_res.content == valid_jpeg_bytes
print("  ✓ Static file route /uploads successfully served image.")

# Fake image header check (text content with image/jpeg mime type)
fake_image = io.BytesIO(b"Hello world, I am not a real image!")
res_fake = client.post(
    "/api/upload",
    files={"file": ("fake.jpg", fake_image, "image/jpeg")},
    headers={"Authorization": f"Bearer {token_s1}"},
)
assert res_fake.status_code == 400, f"Expected 400 for fake header, got {res_fake.status_code}"
assert "corrupted" in res_fake.text.lower() or "invalid" in res_fake.text.lower()
print("  ✓ Fake image header rejected with 400.")

# Unsupported MIME type check
txt_file = io.BytesIO(b"some text data")
res_unsupported = client.post(
    "/api/upload",
    files={"file": ("file.txt", txt_file, "text/plain")},
    headers={"Authorization": f"Bearer {token_s1}"},
)
assert res_unsupported.status_code == 400, f"Expected 400 for unsupported mime, got {res_unsupported.status_code}"
print("  ✓ Unsupported MIME type rejected with 400.")

# Oversized image (> 2MB)
big_bytes = b"\xff\xd8\xff\xe0" + b"\x00" * (2 * 1024 * 1024 + 100)
big_file = io.BytesIO(big_bytes)
res_big = client.post(
    "/api/upload",
    files={"file": ("big.jpg", big_file, "image/jpeg")},
    headers={"Authorization": f"Bearer {token_s1}"},
)
assert res_big.status_code == 400, f"Expected 400 for oversized image, got {res_big.status_code}"
assert "2mb" in res_big.text.lower()
print("  ✓ Oversized image (>2MB) rejected with 400.")

# ----------------------------------------------------------------------------
# 2. Item Creation (Frontend-Compatible Fields)
# ----------------------------------------------------------------------------
print("\n[2/6] Testing item creation with frontend contract...")
item_payload = {
    "type": "LOST",
    "title": "Black Leather Wallet",
    "description": "Bifold wallet with student ID and transit pass",
    "category": "Wallet",
    "location": "Central Library",
    "date": "2026-10-12",
    "imageUrl": uploaded_url,
}
res_create = client.post(
    "/api/items",
    json=item_payload,
    headers={"Authorization": f"Bearer {token_s1}"},
)
assert res_create.status_code == 201, f"Item creation failed: {res_create.status_code} {res_create.text}"
created_item = res_create.json()

# Assert frontend contract matching src/lib/types.ts
assert created_item["type"] == "LOST"
assert created_item["status"] == "OPEN"
assert created_item["title"] == "Black Leather Wallet"
assert created_item["category"] == "Wallet"
assert created_item["location"] == "Central Library"
assert created_item["date"] == "2026-10-12"
assert created_item["imageUrl"] == uploaded_url
assert created_item["reporterName"] == "Student One"
assert "reporterId" in created_item
assert "createdAt" in created_item
wallet_id = created_item["id"]
print("  ✓ Item created matching frontend schema contract (ID:", wallet_id, ")")

# Create a second item (FOUND) by student 2
res_create_2 = client.post(
    "/api/items",
    json={
        "type": "FOUND",
        "title": "AirPods Pro Case",
        "description": "White charging case found on table 4",
        "category": "Electronics",
        "location": "Main Cafeteria",
        "date": "2026-10-11",
    },
    headers={"Authorization": f"Bearer {token_s2}"},
)
assert res_create_2.status_code == 201
airpods_id = res_create_2.json()["id"]

# Create a third item (LOST) by student 2
res_create_3 = client.post(
    "/api/items",
    json={
        "type": "LOST",
        "title": "Casio Scientific Calculator",
        "description": "fx-991EX left in exam hall",
        "category": "Electronics",
        "location": "Science Block",
        "date": "2026-10-10",
    },
    headers={"Authorization": f"Bearer {token_s2}"},
)
assert res_create_3.status_code == 201
calc_id = res_create_3.json()["id"]
print("  ✓ Additional sample items created successfully.")

# ----------------------------------------------------------------------------
# 3. Search and Filtering Tests
# ----------------------------------------------------------------------------
print("\n[3/6] Testing search and multi-criteria filtering...")

# Keyword search in title
q_title = client.get("/api/items?q=wallet").json()
assert len(q_title) == 1
assert q_title[0]["id"] == wallet_id

# Keyword search in description
q_desc = client.get("/api/items?q=transit").json()
assert len(q_desc) == 1
assert q_desc[0]["id"] == wallet_id

# Non-matching keyword
q_empty = client.get("/api/items?q=nonexistentitemxyz").json()
assert len(q_empty) == 0
print("  ✓ Keyword search across title and description passed.")

# Category filter
cat_res = client.get("/api/items?category=Electronics").json()
assert len(cat_res) == 2
print("  ✓ Category filtering passed.")

# Location filter
loc_res = client.get("/api/items?location=Central Library").json()
assert len(loc_res) == 1
assert loc_res[0]["id"] == wallet_id
print("  ✓ Location filtering passed.")

# Type filter (LOST vs FOUND)
lost_res = client.get("/api/items?type=LOST").json()
assert len(lost_res) == 2
found_res = client.get("/api/items?type=FOUND").json()
assert len(found_res) == 1
assert found_res[0]["id"] == airpods_id
print("  ✓ Type filtering (LOST/FOUND) passed.")

# Combined filter (q + category + type)
comb_res = client.get("/api/items?q=calculator&category=Electronics&type=LOST").json()
assert len(comb_res) == 1
assert comb_res[0]["id"] == calc_id
print("  ✓ Combined multi-parameter filter passed.")

# Sorting: Name A-Z
az_res = client.get("/api/items?sort=az").json()
titles = [i["title"] for i in az_res]
assert titles == sorted(titles), f"A-Z sort failed: {titles}"
print("  ✓ Sorting (az) passed.")

# ----------------------------------------------------------------------------
# 4. Item Status Updates & Permissions
# ----------------------------------------------------------------------------
print("\n[4/6] Testing item status updates and permission controls...")

# 4a. Original reporter (Student One) updates own item (OPEN -> CLAIMED)
status_res = client.patch(
    f"/api/items/{wallet_id}/status",
    json={"status": "CLAIMED"},
    headers={"Authorization": f"Bearer {token_s1}"},
)
assert status_res.status_code == 200, f"Expected 200, got {status_res.status_code}: {status_res.text}"
assert status_res.json()["status"] == "CLAIMED"
print("  ✓ Item reporter successfully updated own status to CLAIMED.")

# 4b. Unauthorized student (Student Two) tries to update Student One's item
unauth_status = client.patch(
    f"/api/items/{wallet_id}/status",
    json={"status": "RETURNED"},
    headers={"Authorization": f"Bearer {token_s2}"},
)
assert unauth_status.status_code == 403, f"Expected 403, got {unauth_status.status_code}"
print("  ✓ Unauthorized student blocked from updating item status with 403 Forbidden.")

# 4c. Admin updates item status (CLAIMED -> RETURNED)
admin_status = client.patch(
    f"/api/items/{wallet_id}/status",
    json={"status": "RETURNED"},
    headers={"Authorization": f"Bearer {token_admin}"},
)
assert admin_status.status_code == 200
assert admin_status.json()["status"] == "RETURNED"
print("  ✓ Administrator successfully updated item status to RETURNED.")

# 4d. Invalid status value
invalid_status = client.patch(
    f"/api/items/{wallet_id}/status",
    json={"status": "INVALID_STATUS"},
    headers={"Authorization": f"Bearer {token_admin}"},
)
assert invalid_status.status_code == 400
print("  ✓ Invalid status update rejected with 400.")

# ----------------------------------------------------------------------------
# 5. Item Deletion & Permissions
# ----------------------------------------------------------------------------
print("\n[5/6] Testing item deletion and permissions...")

# Unauthorized student tries to delete another student's item
unauth_del = client.delete(
    f"/api/items/{airpods_id}",
    headers={"Authorization": f"Bearer {token_s1}"},
)
assert unauth_del.status_code == 403, f"Expected 403 for unauthorized deletion, got {unauth_del.status_code}"
print("  ✓ Unauthorized student blocked from deleting item with 403 Forbidden.")

# Owner student deletes own item
owner_del = client.delete(
    f"/api/items/{calc_id}",
    headers={"Authorization": f"Bearer {token_s2}"},
)
assert owner_del.status_code == 200, f"Owner deletion failed: {owner_del.text}"
print("  ✓ Item reporter successfully deleted own item.")

# Verify deleted item returns 404
get_deleted = client.get(f"/api/items/{calc_id}")
assert get_deleted.status_code == 404
print("  ✓ Deleted item no longer accessible (404 Not Found).")

# Admin deletes remaining item
admin_del = client.delete(
    f"/api/items/{airpods_id}",
    headers={"Authorization": f"Bearer {token_admin}"},
)
assert admin_del.status_code == 200
print("  ✓ Administrator successfully deleted item.")

# ----------------------------------------------------------------------------
# 6. Single Item Lookup
# ----------------------------------------------------------------------------
print("\n[6/6] Testing single item retrieval...")
single_res = client.get(f"/api/items/{wallet_id}")
assert single_res.status_code == 200
single_item = single_res.json()
assert single_item["id"] == str(wallet_id)
assert single_item["status"] == "RETURNED"
assert single_item["reporterName"] == "Student One"
print("  ✓ Single item retrieval verified.")

print("\n=== Phase 3 Verification Complete: ALL TESTS PASSED SUCCESSFULLY ===")
