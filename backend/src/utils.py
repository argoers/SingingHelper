import time
import os

def shutdown_backend():
    # Wait for 1 second before shutting down
    time.sleep(1)

    # Kill any process using port 5173 (Development frontend Vite server)
    os.system("lsof -t -i:5173 | xargs kill")

    # Kill any process using port 5001 (Final app or Flask development backend)
    os.system("lsof -t -i:5001 | xargs kill")
