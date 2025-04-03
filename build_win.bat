@echo off
cd frontend

call npm run build

if not exist deploy mkdir deploy

robocopy dist deploy\static /E
robocopy ..\backend\src deploy *.py

cd deploy
pyinstaller --onefile --noconsole --name "SingingHelper" ^
  --add-data "static;static" --add-data ".;." ^
  --workpath . --specpath . --distpath ..\.. app_build.py


cd ..
rmdir /s /q deploy
rmdir /s /q dist
cd ..