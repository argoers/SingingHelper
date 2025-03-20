import time 
import os 

def shutdown_backend():
    time.sleep(1)

    os.system("lsof -t -i:5173 | xargs kill")
    os.system("lsof -t -i:5001 | xargs kill")