#!/bin/bash
# Navigate to backend folder and run Flask
echo "Starting Flask backend..."
./backend/src/dist/backend.app/Contents/MacOS/backend &
sleep 1
# Navigate to frontend folder and start Vue
echo "Starting Vue frontend..."
pwd
cd frontend
pwd
npm run dev
sleep 5

echo "Both frontend and backend are running."