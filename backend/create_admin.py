"""
Secure Administrator Account Setup Utility for FindIt.

This script allows initializing or promoting an administrator account securely.
It does NOT contain hardcoded credentials or passwords.

Usage:
  Interactive:
    python backend/create_admin.py

  Non-interactive (via environment variables):
    ADMIN_NAME="Campus Admin" ADMIN_EMAIL="admin@campus.edu" ADMIN_PASSWORD="your-secure-password" python backend/create_admin.py
"""

import getpass
import os
import sys

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(__file__))

from auth_utils import hash_password
from database import SessionLocal
import models


def setup_admin():
    name = os.getenv("ADMIN_NAME")
    email = os.getenv("ADMIN_EMAIL")
    password = os.getenv("ADMIN_PASSWORD")

    if not email:
        try:
            email = input("Enter admin email: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nAborted.")
            sys.exit(1)

    if not email or "@" not in email:
        print("Error: Valid email address is required.")
        sys.exit(1)

    if not name:
        try:
            name = input("Enter admin full name [System Admin]: ").strip() or "System Admin"
        except (KeyboardInterrupt, EOFError):
            print("\nAborted.")
            sys.exit(1)

    if not password:
        try:
            password = getpass.getpass("Enter admin password (min 8 chars): ").strip()
            confirm = getpass.getpass("Confirm admin password: ").strip()
            if password != confirm:
                print("Error: Passwords do not match.")
                sys.exit(1)
        except (KeyboardInterrupt, EOFError):
            print("\nAborted.")
            sys.exit(1)

    if len(password) < 8:
        print("Error: Password must be at least 8 characters long.")
        sys.exit(1)

    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.email == email).first()
        hashed = hash_password(password)

        if user:
            print(f"Existing user found for {email}. Updating to ADMIN role...")
            user.role = "ADMIN"
            user.password_hash = hashed
            if name:
                user.name = name
            user.is_active = True
        else:
            print(f"Creating new ADMIN user for {email}...")
            user = models.User(
                name=name,
                email=email,
                password_hash=hashed,
                role="ADMIN",
                is_active=True,
            )
            db.add(user)

        db.commit()
        db.refresh(user)
        print(f"Success! Admin user ID {user.id} ({user.email}) is ready with role '{user.role}'.")
    except Exception as e:
        db.rollback()
        print(f"Database error during admin setup: {e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    setup_admin()
