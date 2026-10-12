"""
Authentication and Authorization Utilities for FindIt.

Implements industry-standard password hashing (bcrypt) and token signing (PyJWT)
with strict environment variable validation and role-based access control.
"""

from datetime import datetime, timedelta, timezone
import hashlib
import os
import secrets
from typing import Any, Dict, Optional

import bcrypt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from sqlalchemy.orm import Session

# Load .env relative to current file or working directory
_backend_env = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(_backend_env):
    load_dotenv(_backend_env)
load_dotenv()

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET_KEY is missing from environment. "
        "Please configure a 32+ character key in backend/.env."
    )
if len(JWT_SECRET_KEY) < 32:
    raise RuntimeError(
        "JWT_SECRET_KEY is insecure. It must be at least 32 characters long."
    )

JWT_ALGORITHM = "HS256"
DEFAULT_TOKEN_EXPIRATION_DAYS = 7
BCRYPT_ROUNDS = 12

security_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """Hash a password using bcrypt with 12 work rounds."""
    if not password:
        raise ValueError("Password cannot be empty.")
    salt = bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, stored_hash: str) -> bool:
    """
    Verify a plaintext password against a stored bcrypt (or fallback PBKDF2) hash.
    Uses constant-time comparison to protect against timing attacks.
    """
    if not password or not stored_hash:
        return False
    try:
        # Check standard bcrypt format ($2a$, $2b$, etc.)
        if stored_hash.startswith(("$2a$", "$2b$", "$2y$")):
            return bcrypt.checkpw(password.encode("utf-8"), stored_hash.encode("utf-8"))

        # Fallback verification for PBKDF2 salt$hash format
        if "$" in stored_hash:
            salt, key_hex = stored_hash.split("$", 1)
            key = hashlib.pbkdf2_hmac(
                "sha256",
                password.encode("utf-8"),
                salt.encode("utf-8"),
                100_000,
            )
            return secrets.compare_digest(key.hex(), key_hex)

        return False
    except Exception:
        return False


def create_access_token(
    user_id: int,
    email: str,
    role: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Generate a signed PyJWT token with subject, email, role, and expiration timestamp.
    """
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(days=DEFAULT_TOKEN_EXPIRATION_DAYS)
    )
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role.upper(),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decode and validate a PyJWT token.
    Raises HTTPException 401 if invalid or expired.
    """
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["exp", "sub"]},
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )


from database import get_db
import models


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
    db: Session = Depends(get_db),
) -> models.User:
    """
    FastAPI dependency that extracts and validates the Bearer token,
    then loads the active user from the database.
    """

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(credentials.credentials)
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = int(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed user ID in token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive.",
        )

    return user


def require_admin(
    current_user: Any = Depends(get_current_user),
) -> Any:
    """
    FastAPI dependency ensuring the authenticated user has the ADMIN role.
    """
    if str(current_user.role).upper() != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Administrator privileges required.",
        )
    return current_user
