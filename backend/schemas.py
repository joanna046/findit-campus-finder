from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


# ============================================================================
# User & Authentication Schemas
# ============================================================================

class UserRegister(BaseModel):
    """
    Public registration schema.
    Public registration strictly assigns the STUDENT role on the server.
    """
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128, description="Password must be at least 8 characters")


class UserLogin(BaseModel):
    """Credentials for authentication."""
    email: EmailStr
    password: str = Field(min_length=1)


class UserResponse(BaseModel):
    """Public user profile data."""
    id: int
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    """Bearer token authentication response."""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ============================================================================
# Item Schemas
# ============================================================================

class ItemCreate(BaseModel):
    """
    Schema for reporting a lost or found item.
    Supports both frontend naming (type, date, imageUrl) and backend naming (report_type, item_date, image_key).
    """
    title: str = Field(min_length=2, max_length=200)
    description: str = Field(min_length=5)
    category: str = Field(min_length=2, max_length=100)
    location: str = Field(min_length=2, max_length=200)

    # Type / report_type (case-insensitive: "LOST" / "lost" or "FOUND" / "found")
    type: Optional[str] = None
    report_type: Optional[str] = None

    # Date / item_date (ISO string or datetime)
    date: Optional[str] = None
    item_date: Optional[datetime] = None

    # Image URL / image key
    imageUrl: Optional[str] = None
    image_key: Optional[str] = None


class ItemStatusUpdate(BaseModel):
    """Schema for updating the status of an item."""
    status: str = Field(description="New item status: OPEN, CLAIMED, or RETURNED")


class ItemResponse(BaseModel):
    """
    Full item response matching frontend types and backward-compatible with backend.
    """
    id: str
    type: str
    title: str
    description: str
    category: str
    location: str
    date: str
    imageUrl: Optional[str] = None
    status: str
    reporterId: str
    reporterName: str
    createdAt: str

    # Backward compatibility fields
    report_type: Optional[str] = None
    item_date: Optional[str] = None
    image_key: Optional[str] = None
    created_at: Optional[str] = None

    model_config = {"from_attributes": True}


# ============================================================================
# Claim Schemas
# ============================================================================

class ClaimCreate(BaseModel):
    """Schema for submitting an ownership claim on an item."""
    message: str = Field(min_length=5, max_length=1000, description="Proof or message explaining ownership")


class ClaimStatusUpdate(BaseModel):
    """Schema for approving or rejecting a claim (Admin only)."""
    status: str = Field(description="New claim status: APPROVED or REJECTED")


class ClaimResponse(BaseModel):
    """Claim response matching frontend Claim type."""
    id: str
    itemId: str
    claimantId: str
    claimantName: str
    message: str
    status: str
    createdAt: str

    # Backward compatibility fields
    item_id: Optional[int] = None
    claimant_id: Optional[int] = None
    claim_message: Optional[str] = None
    claim_status: Optional[str] = None
    created_at: Optional[str] = None

    model_config = {"from_attributes": True}
