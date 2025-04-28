import time
import os
import platform

def shutdown_backend():
    # Wait for 1 second before shutting down
    time.sleep(1)

    # Check the operating system and execute the appropriate command to kill processes
    if platform.system() == "Windows":
        # Kill any process using port 5173 (Development frontend Vue server)
        os.system('for /f "tokens=5" %a in (\'netstat -aon ^| findstr LISTENING ^| findstr :5173\') do taskkill /PID %a /F')

        # Kill any process using port 5001 (Final app or Flask development backend)
        os.system('for /f "tokens=5" %a in (\'netstat -aon ^| findstr LISTENING ^| findstr :5001\') do taskkill /PID %a /F')
    else:
        # Kill any process using port 5173 (Development frontend Vue server)
        os.system("lsof -t -i:5173 | xargs kill")

        # Kill any process using port 5001 (Final app or Flask development backend)
        os.system("lsof -t -i:5001 | xargs kill")
