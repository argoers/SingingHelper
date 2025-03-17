@echo off
cd frontend
:: Build Vue frontend
echo Building Vue frontend...
call npm run build

:: Ensure deploy folder exists
if not exist deploy mkdir deploy

:: Copy Vue build output to deploy/static
echo Copying frontend build to deploy/static...
robocopy dist deploy\static /E

:: Copy backend Python files to deploy
echo Copying backend files...
robocopy ..\backend\src deploy *.py

:: Change directory to deploy
cd deploy

:: Build the executable with PyInstaller
echo Building executable...
pyinstaller --onefile --noconsole --name "SingingHelper" ^
  --add-data "static;static" --add-data ".;." ^
  --workpath . --specpath . --distpath ..\.. app_build.py

:: Go back to the root directory
cd ..

:: Delete deploy folder
echo Cleaning up deploy folder...
rmdir /s /q deploy
rmdir /s /q frontend\dist

cd ..

echo Build completed successfully!
