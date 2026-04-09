#!/usr/bin/env bash
set -e

echo "=== Starting Render Build Process ==="

# Install root dependencies
echo "Installing root dependencies..."
npm install

# Build backend
echo "Building backend..."
cd backend
npm install
npm run build
cd ..

# Build frontend
echo "Building frontend..."
cd frontend
npm install
npm run build
cd ..

echo "=== Build Complete ==="
