#!/usr/bin/env bash
set -e

# TRVST AI - One-Click Launcher for Team Spider Hackathon Project
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================================="
echo "   TRVST AI — Intelligent Brand Governance Platform"
echo "   Team Spider | Hackathon MVP"
echo "=========================================================="

# Check Python3
if ! command -v python3 &>/dev/null; then
    echo "❌ Python 3 is required but not found."
    exit 1
fi

# Check or create virtual environment
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
    ./venv/bin/pip install --upgrade pip
    ./venv/bin/pip install -r requirements.txt
else
    echo "✅ Virtual environment detected."
fi

# Determine available port
PORT=8000
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️ Port 8000 is in use, checking port 8080..."
    PORT=8080
    if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null ; then
        PORT=8888
    fi
fi

echo "🚀 Starting TRVST AI server on http://127.0.0.1:$PORT..."

# Auto-open browser in background on macOS
(sleep 1.5 && open "http://127.0.0.1:$PORT" 2>/dev/null || true) &

# Run server
export PYTHONPATH="$SCRIPT_DIR"
./venv/bin/uvicorn app.main:app --host 127.0.0.1 --port "$PORT" --reload
