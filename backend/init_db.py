
import os
import sys

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(__file__))

from database import Base, engine
import models

print("Creating FindIt database tables (non-destructive: CREATE TABLE IF NOT EXISTS)...")

Base.metadata.create_all(bind=engine)

print("Success! Database tables are ready.")
print("Tables: users, items, claims")
