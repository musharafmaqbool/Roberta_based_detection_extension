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
                "tagName": element.tagName,
                "url": element.url
            }
        )
        
        # Calculate risk contribution considering domain trust, heuristics, and risk level
        risk_score = 0
        if prediction["is_dark_pattern"]:
            # Dark pattern contribution
            risk_score += prediction["dark_pattern_conf"]
            
        # Phishing risk bands contribution
        if prediction["phishing_risk_level"] == "High Risk":
            # High risk phishing gets a high risk weight
            risk_score += prediction["phishing_conf"] * 2.0
        elif prediction["phishing_risk_level"] == "Medium Risk":
            # Medium risk phishing gets moderate weight
            risk_score += prediction["phishing_conf"] * 0.8
        elif prediction["phishing_risk_level"] == "Low Risk":
            # Low risk phishing gets minimal weight
            risk_score += prediction["phishing_conf"] * 0.2
            
        total_risk += risk_score

        # Add to results if there is an active dark pattern, high-risk, or medium-risk phishing
        if prediction["is_dark_pattern"] or prediction["is_phishing"] or prediction["phishing_risk_level"] == "Medium Risk":
            result = PredictionResult(
                **prediction
            )
            results.append(result)

    # Normalize risk score (capped at 10.0)
    overall_risk = min(10.0, total_risk)
    
    logger.info(f"Analysis complete. Found {len(results)} issues. Overall Risk: {overall_risk:.1f}")

    return AnalyzeResponse(
        results=results,
        overall_risk_score=round(overall_risk, 1)
    )

