#!/bin/bash

cd frontend

npm run build

cd ..
mkdir -p deploy/static

cp -r frontend/dist/* deploy/static/
cp backend/src/*.py deploy/

cd deploy

pyinstaller --onefile --windowed --name "SingingHelper" \
  --add-data "static:static" --add-data ".:." \
  --workpath . --specpath . --distpath .. app_build.py


cd ..
/usr/libexec/PlistBuddy -c "Add :NSMicrophoneUsageDescription string 'Need microphone access for uploading audio'" SingingHelper.app/Contents/Info.plist
codesign --force --deep --sign - SingingHelper.app

rm -rf deploy
rm -rf frontend/dist
