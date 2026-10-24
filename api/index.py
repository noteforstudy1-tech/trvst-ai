import os
import sys
from pathlib import Path

# Add project root to sys.path so app modules can be resolved
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.main import app
