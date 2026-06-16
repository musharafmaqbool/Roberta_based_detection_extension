from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import analyze
from app.utils.logger import get_logger

logger = get_logger("Main")

app = FastAPI(
    title="Deception Detection API",
    description="Real-time analysis for Dark Patterns and Phishing using Rule-based and RoBERTa models.",
    version="1.0.0"
)

# Enable CORS for the extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to the extension ID
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(analyze.router, tags=["Analysis"])

@app.on_event("startup")
async def startup_event():
    logger.info("FastAPI Server starting up. Initializing resources...")
    logger.info("🚀 [Main] FastAPI startup complete.")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("FastAPI Server shutting down. Cleaning up...")
