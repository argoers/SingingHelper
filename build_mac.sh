#!/bin/bash

cd frontend

# Create an iconset folder
mkdir -p favicon.iconset

# Convert .ico into different sizes
sips -s format png public/favicon.ico --out favicon.png

# Create resized PNGs (needed sizes for Mac icons)
sips -z 16 16 favicon.png --out favicon.iconset/icon_16x16.png
sips -z 32 32 favicon.png --out favicon.iconset/icon_16x16@2x.png
sips -z 32 32 favicon.png --out favicon.iconset/icon_32x32.png
sips -z 64 64 favicon.png --out favicon.iconset/icon_32x32@2x.png
sips -z 128 128 favicon.png --out favicon.iconset/icon_128x128.png
sips -z 256 256 favicon.png --out favicon.iconset/icon_128x128@2x.png
sips -z 256 256 favicon.png --out favicon.iconset/icon_256x256.png
sips -z 512 512 favicon.png --out favicon.iconset/icon_256x256@2x.png
sips -z 512 512 favicon.png --out favicon.iconset/icon_512x512.png
cp favicon.iconset/icon_512x512.png favicon.iconset/icon_512x512@2x.png

# Build ICNS
iconutil -c icns favicon.iconset

# Build the frontend
npm run build

# Create directory where frontend and backend will be merged
cd ..
mkdir -p deploy/static

cp -r frontend/dist/* deploy/static/
cp backend/src/*.py deploy/
cp frontend/favicon.icns deploy/

cd deploy

# Create the app
pyinstaller --onefile --windowed --name "SingingHelper" \
  --add-data "static:static" --add-data ".:." \
  --icon "favicon.icns" \
  --workpath . --specpath . --distpath .. app_build.py


# Add microphone permission to the app
cd ..
/usr/libexec/PlistBuddy -c "Add :NSMicrophoneUsageDescription string 'Need microphone access for uploading audio'" SingingHelper.app/Contents/Info.plist
codesign --force --deep --sign - SingingHelper.app

# Remove unnecessary files
rm -rf deploy
rm -rf frontend/dist
rm -rf frontend/favicon.iconset
rm -f frontend/favicon.png
rm -f frontend/favicon.icns
rm -f SingingHelper