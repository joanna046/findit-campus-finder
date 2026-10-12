from contextlib import asynccontextmanager
from datetime import datetime
import os
import re
import secrets
import time
from typing import List, Optional

from fastapi import (
    Depends,
    FastAPI,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import or_
from sqlalchemy.orm import Session

from auth_utils import (
    create_access_token,
    get_current_user,
    hash_password,
    require_admin,
    verify_password,
)
from database import Base, engine, get_db
import models
from schemas import (
    ClaimCreate,
    ClaimResponse,
    ClaimStatusUpdate,
    ItemCreate,
    ItemResponse,
    ItemStatusUpdate,
    TokenResponse,
    UserLogin,
    UserRegister,
    UserResponse,
)

# Upload directory configuration
UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024  # 2MB limit
ALLOWED_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create any missing tables (safe to run on every start)
    try:
        Base.metadata.create_all(bind=engine)
        print("Database tables are ready.")
    except Exception as exc:
        print(f"WARNING: could not create database tables: {exc}")
    yield


app = FastAPI(
    title="FindIt API",
    description="Smart Campus Lost and Found Management System",
    version="1.0.0",
    lifespan=lifespan,
)

# Static file serving for uploaded item photos
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Helpers
# ============================================================================

def serialize_item(item: models.Item) -> dict:
    """Serialize an Item model to match both frontend and backend contracts."""
    reporter_name = item.owner.name if item.owner else "Campus Community"

    if isinstance(item.item_date, datetime):
        date_str = item.item_date.strftime("%Y-%m-%d")
        item_date_iso = item.item_date.isoformat()
    else:
        date_str = str(item.item_date)[:10] if item.item_date else ""
        item_date_iso = str(item.item_date) if item.item_date else ""

    if isinstance(item.created_at, datetime):
        created_at_iso = item.created_at.isoformat()
    else:
        created_at_iso = str(item.created_at) if item.created_at else ""

    type_str = item.report_type.upper() if item.report_type else "LOST"
    status_str = item.status.upper() if item.status else "OPEN"

    return {
        "id": str(item.id),
        "type": type_str,
        "title": item.title,
        "description": item.description,
        "category": item.category,
        "location": item.location,
        "date": date_str,
        "imageUrl": item.image_key,
        "status": status_str,
        "reporterId": str(item.user_id),
        "reporterName": reporter_name,
        "createdAt": created_at_iso,
        # Legacy/snake_case backward compatibility
        "report_type": item.report_type.lower() if item.report_type else "lost",
        "item_date": item_date_iso,
        "image_key": item.image_key,
        "user_id": item.user_id,
        "created_at": created_at_iso,
    }


def serialize_claim(claim: models.Claim) -> dict:
    """Serialize a Claim model to match both frontend and backend contracts."""
    claimant_name = claim.claimant.name if claim.claimant else "Student Claimant"
    status_str = claim.claim_status.upper() if claim.claim_status else "PENDING"

    if isinstance(claim.created_at, datetime):
        created_at_iso = claim.created_at.isoformat()
    else:
        created_at_iso = str(claim.created_at) if claim.created_at else ""

    return {
        "id": str(claim.id),
        "itemId": str(claim.item_id),
        "claimantId": str(claim.claimant_id),
        "claimantName": claimant_name,
        "message": claim.claim_message,
        "status": status_str,
        "createdAt": created_at_iso,
        # Legacy/snake_case backward compatibility
        "item_id": claim.item_id,
        "claimant_id": claim.claimant_id,
        "claim_message": claim.claim_message,
        "claim_status": claim.claim_status.lower() if claim.claim_status else "pending",
        "created_at": created_at_iso,
    }


def validate_image_bytes(chunk: bytes, mime_type: str) -> bool:
    """Verify magic bytes match the expected image MIME type."""
    if mime_type in ("image/jpeg", "image/jpg"):
        return chunk.startswith(b"\xff\xd8\xff")
    if mime_type == "image/png":
        return chunk.startswith(b"\x89PNG\r\n\x1a\n")
    if mime_type == "image/gif":
        return chunk.startswith(b"GIF87a") or chunk.startswith(b"GIF89a")
    if mime_type == "image/webp":
        return chunk.startswith(b"RIFF") and len(chunk) >= 12 and chunk[8:12] == b"WEBP"
    return False


# ============================================================================
# General & Health Endpoints
# ============================================================================

@app.get("/")
def home():
    return {
        "message": "Welcome to FindIt API!",
        "status": "running",
    }


@app.get("/api/health")
def health_check():
    return {"status": "healthy"}


# ============================================================================
# Authentication & Authorization Endpoints
# ============================================================================

@app.post("/api/auth/register", response_model=TokenResponse, status_code=201)
def register(
    user_data: UserRegister,
    db: Session = Depends(get_db),
):
    clean_email = user_data.email.strip().lower()
    existing = db.query(models.User).filter(models.User.email == clean_email).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="An account with this email address already exists.",
        )

    # Public registration strictly assigns the STUDENT role.
    new_user = models.User(
        name=user_data.name.strip(),
        email=clean_email,
        password_hash=hash_password(user_data.password),
        role="STUDENT",
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token(
        user_id=new_user.id,
        email=new_user.email,
        role=new_user.role,
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": new_user,
    }


@app.post("/api/auth/login", response_model=TokenResponse)
def login(
    login_data: UserLogin,
    db: Session = Depends(get_db),
):
    clean_email = login_data.email.strip().lower()
    user = db.query(models.User).filter(models.User.email == clean_email).first()

    if user is None or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="This account has been deactivated.",
        )

    token = create_access_token(
        user_id=user.id,
        email=user.email,
        role=user.role,
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user,
    }


@app.get("/api/auth/me", response_model=UserResponse)
def get_me(
    current_user: models.User = Depends(get_current_user),
):
    return current_user


@app.get("/api/admin/verify")
def verify_admin_access(
    admin_user: models.User = Depends(require_admin),
):
    return {
        "status": "authorized",
        "user_id": admin_user.id,
        "name": admin_user.name,
        "email": admin_user.email,
        "role": admin_user.role,
    }


# ============================================================================
# Image Upload Endpoint
# ============================================================================

@app.post("/api/upload")
async def upload_image(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
):
    """
    Secure image upload endpoint.
    Validates MIME type, file size (<= 2MB), magic bytes, and generates safe filenames.
    Prevents path traversal vulnerabilities.
    """
    content_type = (file.content_type or "").lower().strip()
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported image type. Allowed formats: JPEG, PNG, WebP, GIF.",
        )

    ext = ALLOWED_MIME_TYPES[content_type]

    # Read the first chunk to inspect magic bytes
    initial_chunk = await file.read(1024)
    if not initial_chunk or not validate_image_bytes(initial_chunk, content_type):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or corrupted image header.",
        )

    # Read remainder and enforce size boundary
    remaining = await file.read()
    total_bytes = initial_chunk + remaining
    if len(total_bytes) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image exceeds maximum allowed size of 2MB ({len(total_bytes)} bytes uploaded).",
        )

    # Generate a cryptographically randomized filename (never use client-supplied filename)
    safe_name = f"{secrets.token_hex(16)}_{int(time.time())}{ext}"
    dest_path = os.path.abspath(os.path.join(UPLOAD_DIR, safe_name))

    # Path traversal check: guarantee file resides within UPLOAD_DIR
    if os.path.commonpath([UPLOAD_DIR, dest_path]) != UPLOAD_DIR:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Illegal file destination path.",
        )

    with open(dest_path, "wb") as f:
        f.write(total_bytes)

    return {
        "url": f"/uploads/{safe_name}",
        "filename": safe_name,
    }


# ============================================================================
# Items Endpoints (CRUD & Search)
# ============================================================================

@app.get("/api/items")
def get_items(
    q: Optional[str] = Query(default=None, description="Search keyword in title or description"),
    category: Optional[str] = Query(default=None, description="Filter by item category"),
    location: Optional[str] = Query(default=None, description="Filter by location"),
    report_type: Optional[str] = Query(default=None, description="Filter by lost or found"),
    type: Optional[str] = Query(default=None, description="Frontend alias for report_type (LOST/FOUND)"),
    status: Optional[str] = Query(default=None, description="Filter by status (OPEN/CLAIMED/RETURNED)"),
    sort: Optional[str] = Query(default="recent", description="Sort order: recent, oldest, az"),
    db: Session = Depends(get_db),
):
    query = db.query(models.Item)

    # Keyword search across title and description
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                models.Item.title.ilike(term),
                models.Item.description.ilike(term),
            )
        )

    # Category filter
    if category and category.strip():
        query = query.filter(models.Item.category.ilike(category.strip()))

    # Location filter
    if location and location.strip():
        query = query.filter(models.Item.location.ilike(location.strip()))

    # Report type / item type (lost or found)
    effective_type = (report_type or type or "").lower().strip()
    if effective_type:
        if effective_type not in ("lost", "found"):
            raise HTTPException(
                status_code=400,
                detail="report_type must be 'lost' or 'found'",
            )
        query = query.filter(models.Item.report_type == effective_type)

    # Status filter
    if status and status.strip():
        query = query.filter(models.Item.status == status.strip().lower())

    # Sorting
    if sort == "az":
        query = query.order_by(models.Item.title.asc())
    elif sort == "oldest":
        query = query.order_by(models.Item.created_at.asc())
    else:  # default "recent"
        query = query.order_by(models.Item.created_at.desc())

    items = query.limit(200).all()
    return [serialize_item(item) for item in items]


@app.get("/api/items/{item_id}")
def get_item(
    item_id: int,
    db: Session = Depends(get_db),
):
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if item is None:
        raise HTTPException(
            status_code=404,
            detail="Item not found",
        )
    return serialize_item(item)


@app.post("/api/items", status_code=201)
def create_item(
    item_data: ItemCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Normalize type: accepts "type" (frontend "LOST"/"FOUND") or "report_type"
    raw_type = (item_data.type or item_data.report_type or "lost").lower().strip()
    if raw_type not in ("lost", "found"):
        raise HTTPException(
            status_code=400,
            detail="Item type must be either 'lost' or 'found'.",
        )

    # Normalize date: accepts "date" (string YYYY-MM-DD) or "item_date" (datetime)
    final_date: datetime
    if item_data.item_date:
        final_date = item_data.item_date
    elif item_data.date:
        try:
            # Handle YYYY-MM-DD or ISO string
            date_clean = item_data.date.split("T")[0]
            final_date = datetime.strptime(date_clean, "%Y-%m-%d")
        except ValueError:
            final_date = datetime.utcnow()
    else:
        final_date = datetime.utcnow()

    image_key = item_data.imageUrl or item_data.image_key

    item = models.Item(
        title=item_data.title.strip(),
        description=item_data.description.strip(),
        category=item_data.category.strip(),
        report_type=raw_type,
        location=item_data.location.strip(),
        item_date=final_date,
        image_key=image_key,
        status="open",
        user_id=current_user.id,
    )

    db.add(item)
    db.commit()
    db.refresh(item)

    return serialize_item(item)


@app.patch("/api/items/{item_id}/status")
def update_item_status(
    item_id: int,
    status_update: ItemStatusUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found.")

    # Authorization check: only original reporter or Admin may update status
    is_owner = (item.user_id == current_user.id)
    is_admin = (str(current_user.role).upper() == "ADMIN")
    if not (is_owner or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to update this item's status.",
        )

    new_status = status_update.status.strip().lower()
    if new_status not in ("open", "claimed", "returned"):
        raise HTTPException(
            status_code=400,
            detail="Invalid status. Allowed values: OPEN, CLAIMED, RETURNED.",
        )

    item.status = new_status
    db.commit()
    db.refresh(item)
    return serialize_item(item)


@app.delete("/api/items/{item_id}")
def delete_item(
    item_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found.")

    # Authorization check: only original reporter or Admin may delete
    is_owner = (item.user_id == current_user.id)
    is_admin = (str(current_user.role).upper() == "ADMIN")
    if not (is_owner or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this item.",
        )

    # Remove associated claims first (foreign key integrity)
    db.query(models.Claim).filter(models.Claim.item_id == item.id).delete()
    db.delete(item)
    db.commit()

    return {"message": "Item deleted successfully.", "id": str(item_id)}


# ============================================================================
# Claims Endpoints
# ============================================================================

@app.post("/api/items/{item_id}/claims", status_code=201)
def create_claim(
    item_id: int,
    claim_data: ClaimCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Submit an ownership claim for an item.
    - User must be authenticated.
    - User cannot claim an item they reported themselves.
    - Item must be in OPEN status.
    - Duplicate claims by the same user for the same item are blocked.
    """
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found.")

    # Prevent owner from claiming their own item
    if item.user_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot submit a claim for an item you reported yourself.",
        )

    # Inappropriate item status check
    if item.status.lower() != "open":
        raise HTTPException(
            status_code=400,
            detail=f"This item is currently {item.status.upper()} and is no longer accepting claims.",
        )

    # Duplicate claim check
    existing_claim = db.query(models.Claim).filter(
        models.Claim.item_id == item_id,
        models.Claim.claimant_id == current_user.id,
    ).first()
    if existing_claim:
        raise HTTPException(
            status_code=400,
            detail="You have already submitted a claim for this item.",
        )

    new_claim = models.Claim(
        item_id=item.id,
        claimant_id=current_user.id,
        claim_message=claim_data.message.strip(),
        claim_status="pending",
    )
    db.add(new_claim)
    db.commit()
    db.refresh(new_claim)

    return serialize_claim(new_claim)


@app.get("/api/claims")
def get_claims(
    item_id: Optional[int] = Query(default=None, description="Filter claims by item ID"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List claims.
    - Administrators can view all claims.
    - Students are strictly restricted to viewing only their own claims.
    """
    is_admin = (str(current_user.role).upper() == "ADMIN")

    if is_admin:
        query = db.query(models.Claim)
    else:
        query = db.query(models.Claim).filter(models.Claim.claimant_id == current_user.id)

    if item_id is not None:
        query = query.filter(models.Claim.item_id == item_id)

    claims = query.order_by(models.Claim.created_at.desc()).all()
    return [serialize_claim(c) for c in claims]


@app.get("/api/claims/{claim_id}")
def get_claim(
    claim_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve details for a single claim with permission enforcement."""
    claim = db.query(models.Claim).filter(models.Claim.id == claim_id).first()
    if claim is None:
        raise HTTPException(status_code=404, detail="Claim not found.")

    is_admin = (str(current_user.role).upper() == "ADMIN")
    if not is_admin and claim.claimant_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this claim.",
        )

    return serialize_claim(claim)


@app.patch("/api/claims/{claim_id}/status")
def update_claim_status(
    claim_id: int,
    status_data: ClaimStatusUpdate,
    admin_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Approve or reject a claim.
    - Only administrators can perform this action.
    - Approving a claim transitions the item's status to CLAIMED and safely rejects conflicting pending claims.
    """
    claim = db.query(models.Claim).filter(models.Claim.id == claim_id).first()
    if claim is None:
        raise HTTPException(status_code=404, detail="Claim not found.")

    action = status_data.status.strip().upper()
    if action not in ("APPROVED", "REJECTED"):
        raise HTTPException(
            status_code=400,
            detail="Invalid status. Allowed values: APPROVED or REJECTED.",
        )

    if action == "APPROVED":
        claim.claim_status = "approved"

        # Update associated item to CLAIMED
        item = db.query(models.Item).filter(models.Item.id == claim.item_id).first()
        if item:
            item.status = "claimed"

        # Safely resolve conflicting pending claims for the same item
        conflicting_claims = db.query(models.Claim).filter(
            models.Claim.item_id == claim.item_id,
            models.Claim.id != claim.id,
            models.Claim.claim_status == "pending",
        ).all()
        for other in conflicting_claims:
            other.claim_status = "rejected"

    elif action == "REJECTED":
        claim.claim_status = "rejected"

    db.commit()
    db.refresh(claim)

    return serialize_claim(claim)
