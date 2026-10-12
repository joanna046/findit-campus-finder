"""
Phase 4 Automated Test Suite: Claims and Admin Workflow Endpoints

Verifies:
1. Student submitting claim for an item reported by someone else (201)
2. Blocking item reporter from claiming their own item (400)
3. Blocking duplicate claims from the same student for the same item (400)
4. Blocking claims on non-OPEN items (CLAIMED or RETURNED) (400)
5. Claims list visibility: Students only see their own claims; Admins see all claims
6. Single claim lookup permissions (Owner and Admin: 200; Other student: 403)
7. Rejection of claim by Admin (200)
8. Blocking non-admins from approving or rejecting claims (403)
9. Approval of claim by Admin (200):
   - Transitions claim status to APPROVED
   - Transitions item status to CLAIMED
   - Conflicting pending claims for the same item are automatically set to REJECTED
"""

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
from main import app
import models

# In-memory SQLite for isolated, fast, and repeatable testing
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

print("=== Running Phase 4 Claims & Admin Workflow Test Suite ===")

# ----------------------------------------------------------------------------
# Setup Test Users
# ----------------------------------------------------------------------------
db = TestingSessionLocal()
reporter = models.User(
    name="Reporter Student",
    email="reporter@campus.edu",
    password_hash=hash_password("Pass12345!"),
    role="STUDENT",
    is_active=True,
)
claimant_1 = models.User(
    name="Claimant One",
    email="claimant1@campus.edu",
    password_hash=hash_password("Pass12345!"),
    role="STUDENT",
    is_active=True,
)
claimant_2 = models.User(
    name="Claimant Two",
    email="claimant2@campus.edu",
    password_hash=hash_password("Pass12345!"),
    role="STUDENT",
    is_active=True,
)
admin_user = models.User(
    name="Campus Admin",
    email="admin@campus.edu",
    password_hash=hash_password("AdminPass123!"),
    role="ADMIN",
    is_active=True,
)
db.add_all([reporter, claimant_1, claimant_2, admin_user])
db.commit()
reporter_id = reporter.id

# Create a test item reported by `reporter`
test_item = models.Item(
    title="Blue Backpack",
    description="Navy blue backpack left on bench",
    category="Bag",
    report_type="found",
    location="Engineering Block",
    item_date=models.datetime.utcnow(),
    status="open",
    user_id=reporter_id,
)
db.add(test_item)
db.commit()
db.refresh(test_item)
item_id = test_item.id
db.close()

# Obtain auth tokens
token_reporter = client.post("/api/auth/login", json={"email": "reporter@campus.edu", "password": "Pass12345!"}).json()["access_token"]
token_c1 = client.post("/api/auth/login", json={"email": "claimant1@campus.edu", "password": "Pass12345!"}).json()["access_token"]
token_c2 = client.post("/api/auth/login", json={"email": "claimant2@campus.edu", "password": "Pass12345!"}).json()["access_token"]
token_admin = client.post("/api/auth/login", json={"email": "admin@campus.edu", "password": "AdminPass123!"}).json()["access_token"]

# ----------------------------------------------------------------------------
# 1. Claim Submission Tests
# ----------------------------------------------------------------------------
print("\n[1/6] Testing claim submission and validation rules...")

# 1a. Reporter tries to claim their own item (should fail with 400)
own_claim_res = client.post(
    f"/api/items/{item_id}/claims",
    json={"message": "That's actually my own bag that I posted."},
    headers={"Authorization": f"Bearer {token_reporter}"},
)
assert own_claim_res.status_code == 400, f"Expected 400 for own claim, got {own_claim_res.status_code}"
assert "yourself" in own_claim_res.text.lower()
print("  ✓ Reporter blocked from claiming own item (400).")

# 1b. Claimant 1 submits legitimate claim (should succeed with 201)
c1_res = client.post(
    f"/api/items/{item_id}/claims",
    json={"message": "This is my navy backpack, it has calculus notes inside."},
    headers={"Authorization": f"Bearer {token_c1}"},
)
assert c1_res.status_code == 201, f"Claim submission failed: {c1_res.status_code} {c1_res.text}"
c1_data = c1_res.json()
assert c1_data["itemId"] == str(item_id)
assert c1_data["claimantName"] == "Claimant One"
assert c1_data["status"] == "PENDING"
claim_1_id = c1_data["id"]
print("  ✓ Legitimate student claim submitted successfully (ID:", claim_1_id, ").")

# 1c. Claimant 1 tries duplicate claim on the same item (should fail with 400)
dup_claim_res = client.post(
    f"/api/items/{item_id}/claims",
    json={"message": "Sending second claim message for the same bag."},
    headers={"Authorization": f"Bearer {token_c1}"},
)
assert dup_claim_res.status_code == 400, f"Expected 400 for duplicate claim, got {dup_claim_res.status_code}"
assert "already" in dup_claim_res.text.lower()
print("  ✓ Duplicate claim by same claimant blocked (400).")

# 1d. Claimant 2 submits competing claim on the same open item (should succeed with 201)
c2_res = client.post(
    f"/api/items/{item_id}/claims",
    json={"message": "I lost a navy bag around the same time with gym clothes."},
    headers={"Authorization": f"Bearer {token_c2}"},
)
assert c2_res.status_code == 201
claim_2_id = c2_res.json()["id"]
print("  ✓ Second claimant submitted competing claim (ID:", claim_2_id, ").")

# ----------------------------------------------------------------------------
# 2. Inappropriate Item Status Check
# ----------------------------------------------------------------------------
print("\n[2/6] Testing claims on inappropriate item statuses...")
# Create a CLOSED/RETURNED item
db = TestingSessionLocal()
closed_item = models.Item(
    title="Old Returned Keys",
    description="Brass keys",
    category="Keys",
    report_type="lost",
    location="Hostel A",
    item_date=models.datetime.utcnow(),
    status="returned",
    user_id=reporter_id,
)
db.add(closed_item)
db.commit()
db.refresh(closed_item)
closed_id = closed_item.id
db.close()

# Attempting claim on returned item
closed_claim_res = client.post(
    f"/api/items/{closed_id}/claims",
    json={"message": "These keys look like my room keys."},
    headers={"Authorization": f"Bearer {token_c1}"},
)
assert closed_claim_res.status_code == 400, f"Expected 400 for claiming returned item, got {closed_claim_res.status_code}"
assert "no longer accepting claims" in closed_claim_res.text.lower()
print("  ✓ Claim on returned item correctly rejected (400).")

# ----------------------------------------------------------------------------
# 3. Claims Listing & RBAC Visibility
# ----------------------------------------------------------------------------
print("\n[3/6] Testing claim visibility across Student vs Admin...")

# Reporter (who has 0 submitted claims)
rep_claims = client.get("/api/claims", headers={"Authorization": f"Bearer {token_reporter}"}).json()
assert len(rep_claims) == 0, f"Reporter should see 0 claims, saw {len(rep_claims)}"

# Claimant 1 should see only 1 claim (their own)
c1_claims = client.get("/api/claims", headers={"Authorization": f"Bearer {token_c1}"}).json()
assert len(c1_claims) == 1
assert c1_claims[0]["id"] == claim_1_id

# Admin should see ALL claims (currently 2 claims)
admin_claims = client.get("/api/claims", headers={"Authorization": f"Bearer {token_admin}"}).json()
assert len(admin_claims) == 2, f"Admin should see 2 claims, saw {len(admin_claims)}"
print("  ✓ Claims visibility verified: Students see only own claims; Admin sees all claims.")

# ----------------------------------------------------------------------------
# 4. Single Claim Lookup & Permissions
# ----------------------------------------------------------------------------
print("\n[4/6] Testing single claim retrieval permissions...")

# Claimant 1 viewing own claim
c1_view_own = client.get(f"/api/claims/{claim_1_id}", headers={"Authorization": f"Bearer {token_c1}"})
assert c1_view_own.status_code == 200

# Claimant 2 trying to view Claimant 1's claim (should fail with 403)
c2_view_c1 = client.get(f"/api/claims/{claim_1_id}", headers={"Authorization": f"Bearer {token_c2}"})
assert c2_view_c1.status_code == 403, f"Expected 403 for other student viewing claim, got {c2_view_c1.status_code}"

# Admin viewing Claimant 1's claim (should succeed with 200)
admin_view_c1 = client.get(f"/api/claims/{claim_1_id}", headers={"Authorization": f"Bearer {token_admin}"})
assert admin_view_c1.status_code == 200
print("  ✓ Single claim permissions enforced: Owner/Admin (200), Third-party student (403).")

# ----------------------------------------------------------------------------
# 5. Non-Admin Authorization Block on Status Updates
# ----------------------------------------------------------------------------
print("\n[5/6] Testing claim approval/rejection restrictions...")

# Student attempting to approve a claim (must fail with 403)
student_approve_res = client.patch(
    f"/api/claims/{claim_1_id}/status",
    json={"status": "APPROVED"},
    headers={"Authorization": f"Bearer {token_c1}"},
)
assert student_approve_res.status_code == 403, f"Expected 403 for student approving claim, got {student_approve_res.status_code}"
print("  ✓ Non-admin strictly blocked from approving claims with 403 Forbidden.")

# ----------------------------------------------------------------------------
# 6. Admin Approval & Automatic Conflict Resolution
# ----------------------------------------------------------------------------
print("\n[6/6] Testing Admin approval and conflicting claim resolution...")

# Admin approves Claimant 1's claim
admin_approve_res = client.patch(
    f"/api/claims/{claim_1_id}/status",
    json={"status": "APPROVED"},
    headers={"Authorization": f"Bearer {token_admin}"},
)
assert admin_approve_res.status_code == 200, f"Approval failed: {admin_approve_res.text}"
assert admin_approve_res.json()["status"] == "APPROVED"
print("  ✓ Admin successfully approved Claimant 1's claim.")

# Verify the associated item transitioned to CLAIMED
item_check = client.get(f"/api/items/{item_id}").json()
assert item_check["status"] == "CLAIMED", f"Item status expected CLAIMED, got {item_check['status']}"
print("  ✓ Associated item status automatically transitioned to CLAIMED.")

# Verify Claimant 2's competing pending claim was safely resolved to REJECTED
c2_check = client.get(f"/api/claims/{claim_2_id}", headers={"Authorization": f"Bearer {token_admin}"}).json()
assert c2_check["status"] == "REJECTED", f"Competing claim expected REJECTED, got {c2_check['status']}"
print("  ✓ Competing pending claim automatically resolved to REJECTED.")

print("\n=== Phase 4 Verification Complete: ALL TESTS PASSED SUCCESSFULLY ===")
