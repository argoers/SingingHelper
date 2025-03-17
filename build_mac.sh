#!/bin/bash

# Move into the frontend directory
cd frontend

# Build Vue frontend
echo "Building Vue frontend..."
npm run build

# Move back to the root directory
cd ..

# Ensure deploy folder exists
mkdir -p deploy/static

# Copy Vue build output to deploy/static
echo "Copying frontend build to deploy/static..."
cp -r frontend/dist/* deploy/static/

# Copy backend Python files to deploy
echo "Copying backend files..."
cp backend/src/*.py deploy/

# Change directory to deploy
cd deploy

# Build the executable with PyInstaller
echo "Building executable..."
pyinstaller --onefile --windowed \
  --add-data "static:static" --add-data ".:." \
  --workpath . --specpath . --distpath .. app.py

# Move back to the root directory
cd ..

# Delete deploy folder
echo "Cleaning up deploy folder..."
rm -rf deploy
rm -rf frontend/dist

echo "Build completed successfully!"
