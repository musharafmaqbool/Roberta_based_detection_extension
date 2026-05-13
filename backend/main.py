from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.schemas import AnalyzeRequest, AnalyzeResponse, PredictionResult
from ml.detection_engine import DetectionEngine
import uvicorn

app = FastAPI(
    title="Deception Detection API",
    description="Real-time analysis for Dark Patterns and Phishing using Rule-based and RoBERTa models."
)

# Enable CORS for the extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to the extension ID
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize engine
engine = DetectionEngine()

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_elements(request: AnalyzeRequest):
    """
    Receives a batch of DOM elements, processes them, and returns predictions.
    """
    results = []
    total_risk = 0.0
    
    for element in request.elements:
        # Skip empty text
        if not element.text or len(element.text.strip()) == 0:
            continue
            
        prediction = engine.analyze_element(element.text)
        
        # Calculate risk contribution
        risk_score = 0
        if prediction["is_dark_pattern"]:
            risk_score += prediction["dark_pattern_conf"]
        if prediction["is_phishing"]:
            risk_score += prediction["phishing_conf"] * 1.5 # Phishing has higher risk weight
            
        total_risk += risk_score

        # If flagged, add to results
        if prediction["is_dark_pattern"] or prediction["is_phishing"]:
            result = PredictionResult(
                id=element.id,
                **prediction
            )
            results.append(result)

    # Normalize risk score (simple heuristic for MVP)
    overall_risk = min(10.0, total_risk)

    return AnalyzeResponse(
        results=results,
        overall_risk_score=round(overall_risk, 1)
    )

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
