import uvicorn
import os
import sys

# Ensure the backend directory is in the python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    print("Starting Sentinel FastAPI Backend...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
