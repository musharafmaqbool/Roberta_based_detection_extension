from fastapi import APIRouter, Depends
from app.models.schemas import AnalyzeRequest, AnalyzeResponse, PredictionResult
from app.services.inference import InferenceService
from app.utils.logger import get_logger

logger = get_logger("AnalyzeRoute")

router = APIRouter()

# Dependency injection for the service
# Ensures we only initialize the ML models once
_inference_service = None

def get_inference_service():
    global _inference_service
    if _inference_service is None:
        _inference_service = InferenceService()
    return _inference_service

@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_elements(request: AnalyzeRequest, service: InferenceService = Depends(get_inference_service)):
    """
    Receives a batch of DOM elements, processes them asynchronously, and returns predictions.
    """
    logger.info(f"Received /analyze request with {len(request.elements)} elements.")
    results = []
    total_risk = 0.0
    
    for element in request.elements:
        # Skip empty text
        if not element.text or len(element.text.strip()) == 0:
            continue
            
        prediction = await service.analyze_element(
            {
                "id": element.id,
                "text": element.text,
                "url": element.url
            }
        )
        
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
                **prediction
            )
            results.append(result)

    # Normalize risk score (simple heuristic for MVP)
    overall_risk = min(10.0, total_risk)
    
    logger.info(f"Analysis complete. Found {len(results)} issues. Overall Risk: {overall_risk:.1f}")

    return AnalyzeResponse(
        results=results,
        overall_risk_score=round(overall_risk, 1)
    )
