#!/bin/bash
# Bash script for building and packaging the SingingHelper app for macOS

cd frontend
# Enter the 'frontend' directory

# Create an iconset folder where resized icons will be stored
mkdir -p favicon.iconset

# Convert favicon.ico into a base PNG file
sips -s format png public/favicon.ico --out favicon.png
# 'sips' is a macOS tool for image processing

# Create resized PNGs needed for macOS app icons
sips -z 16 16 favicon.png --out favicon.iconset/icon_16x16.png
sips -z 32 32 favicon.png --out favicon.iconset/icon_16x16@2x.png
sips -z 32 32 favicon.png --out favicon.iconset/icon_32x32.png
sips -z 64 64 favicon.png --out favicon.iconset/icon_32x32@2x.png
sips -z 128 128 favicon.png --out favicon.iconset/icon_128x128.png
sips -z 256 256 favicon.png --out favicon.iconset/icon_128x128@2x.png
sips -z 256 256 favicon.png --out favicon.iconset/icon_256x256.png
sips -z 512 512 favicon.png --out favicon.iconset/icon_256x256@2x.png
sips -z 512 512 favicon.png --out favicon.iconset/icon_512x512.png

# Duplicate largest icon for @2x version (retina display)
cp favicon.iconset/icon_512x512.png favicon.iconset/icon_512x512@2x.png

# Create a .icns file (macOS icon format) from the iconset
iconutil -c icns favicon.iconset

# Build the frontend project with npm
npm run build
# Produces production-ready files into 'frontend/dist'

# Move back to the project root directory
cd ..

# Create a deploy folder structure
mkdir -p deploy/static

# Copy built frontend files into deploy/static
cp -r frontend/dist/* deploy/static/

# Copy backend Python files into deploy
cp backend/src/*.py deploy/

# Copy the generated macOS icon into deploy
cp frontend/favicon.icns deploy/

cd deploy
# Move into the deploy folder to build the executable

# Build the executable (macOS app) using PyInstaller
pyinstaller --onefile --windowed --name "SingingHelper" \
  --add-data "static:static" --add-data ".:." \
  --icon "favicon.icns" \
  --workpath . --specpath . --distpath .. app_build.py
# --onefile: bundle into single executable
# --windowed: no terminal window (GUI app)
# --add-data: bundle additional files/folders
# --icon: set custom macOS app icon

# Move back to project root
cd ..

# Add microphone permission description to the app Info.plist
/usr/libexec/PlistBuddy -c "Add :NSMicrophoneUsageDescription string 'Need microphone access for uploading audio'" SingingHelper.app/Contents/Info.plist
# Required by macOS privacy rules to ask for microphone access

# Code sign the app (needed for microphone access and to remove quarantine)
codesign --force --deep --sign - SingingHelper.app

# Clean up temporary and build files
rm -rf deploy            # Remove the deploy folder
rm -rf frontend/dist     # Remove frontend build files
rm -rf frontend/favicon.iconset  # Remove temporary iconset
rm -f frontend/favicon.png       # Remove temporary PNG
rm -f frontend/favicon.icns      # Remove generated ICNS
rm -f SingingHelper               # Remove temporary executable
