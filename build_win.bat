@echo off
cd frontend

:: Build the frontend
call npm run build

:: Create directory where frontend and backend will be merged
if not exist deploy mkdir deploy

robocopy dist deploy\static /E
robocopy ..\backend\src deploy *.py
copy frontend\public\favicon.ico deploy\favicon.ico

cd deploy

:: Create the app
pyinstaller --onefile --noconsole --name "SingingHelper" ^
  --add-data "static;static" --add-data ".;." ^
  --icon "favicon.ico" ^
  --workpath . --specpath . --distpath ..\.. app_build.py


:: Remove unnecessary files
cd ..
rmdir /s /q deploy
rmdir /s /q dist
cd ..