#!/bin/bash
# Start Hummed — runs backend and frontend in parallel

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Starting Hummed..."
echo ""

# Start backend
echo "▶ Backend: http://localhost:8000"
cd "$SCRIPT_DIR/backend"
source venv/bin/activate
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

# Give backend a moment to start
sleep 2

# Start frontend
echo "▶ Frontend: http://localhost:5173"
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✓ Hummed is running"
echo "  Open http://localhost:5173 in your browser"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait and clean up on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" EXIT INT TERM
wait
