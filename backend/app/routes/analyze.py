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
    predictions_list = []
    
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
        predictions_list.append(prediction)

        # Add to results if there is an active dark pattern, high-risk, or medium-risk phishing
        if prediction["is_dark_pattern"] or prediction["is_phishing"] or prediction["phishing_risk_level"] == "Medium Risk":
            result = PredictionResult(
                **prediction
            )
            results.append(result)

    # Recalibrate risk score using dampened union scaling
    import math

    dp_sum = sum(p["dark_pattern_conf"] for p in predictions_list if p["is_dark_pattern"])
    phish_high_conf = max((p["phishing_conf"] for p in predictions_list if p["is_phishing"] and p["phishing_risk_level"] == "High Risk"), default=0.0)
    phish_med_sum = sum(p["phishing_conf"] for p in predictions_list if p["is_phishing"] and p["phishing_risk_level"] == "Medium Risk")
    phish_low_sum = sum(p["phishing_conf"] for p in predictions_list if p["is_phishing"] and p["phishing_risk_level"] == "Low Risk")

    # 1. Dark Pattern Risk Calibration
    if dp_sum > 0:
        if dp_sum <= 1.0:
            dp_risk = 3.5 * dp_sum
        else:
            dp_risk = 3.5 + 2.2 * math.log(dp_sum)
    else:
        dp_risk = 0.0

    # 2. Phishing Risk Calibration
    if phish_high_conf > 0:
        phish_risk = 6.5 + 1.5 * phish_high_conf
    elif phish_med_sum > 0:
        phish_risk = 4.0 + 1.5 * phish_med_sum
    elif phish_low_sum > 0:
        phish_risk = 1.5 + 1.0 * phish_low_sum
    else:
        phish_risk = 0.0

    # 3. Dampened Union combination for combined threats
    if phish_risk > 0 and dp_risk > 0:
        raw_score = phish_risk + (10.0 - phish_risk) * (1.0 - math.exp(-dp_risk / 3.0))
    else:
        raw_score = max(phish_risk, dp_risk)

    # 4. Strict Clamping logic
    is_phish_severe = any(p["is_phishing"] and p["phishing_risk_level"] == "High Risk" and p["phishing_conf"] > 0.995 for p in predictions_list)
    severe_count = sum(1 for p in predictions_list if (p["is_phishing"] and p["phishing_risk_level"] == "High Risk") or (p["is_dark_pattern"] and p["dark_pattern_conf"] >= 0.95))
    
    can_be_10 = is_phish_severe and severe_count >= 2

    if can_be_10:
        overall_risk = min(10.0, raw_score)
    else:
        overall_risk = min(9.8, raw_score)
    
    logger.info(f"Analysis complete. Found {len(results)} issues. Overall Risk: {overall_risk:.1f}")

    return AnalyzeResponse(
        results=results,
        overall_risk_score=round(overall_risk, 1)
    )

