#!/bin/bash

# Installation & Startup Script for Music Discovery Map

echo "=== 1. Checking Node.js Installation ==="
if ! command -v node &> /dev/null
then
    echo "ERROR: Node.js is not installed. Please install Node.js (version 18+) to run this project."
    exit 1
fi
echo "✓ Node.js is installed: $(node -v)"

echo "=== 2. Installing Backend Server Dependencies ==="
cd server || exit
npm install
cd ..

echo "=== 3. Installing Frontend Client Dependencies ==="
cd client || exit
npm install
cd ..

echo "=== 4. Starting Backend and Frontend Concurrently ==="
if command -v npx &> /dev/null
then
    npx -y concurrently \
      --names "backend,frontend" \
      --prefix-colors "magenta,cyan" \
      "cd server && npm start" \
      "cd client && npm run dev"
else
    echo "Starting Server in the background..."
    cd server && npm start &
    SERVER_PID=$!
    cd ..
    
    # Ensure background server is terminated on script exit or interrupt (Ctrl+C)
    trap "echo 'Stopping backend server...'; kill $SERVER_PID 2>/dev/null; exit" INT TERM EXIT
    
    echo "Starting Client..."
    cd client && npm run dev
fi
