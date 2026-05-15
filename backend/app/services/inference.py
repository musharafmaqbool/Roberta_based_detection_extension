from app.services.rule_engine import RuleEngine
from app.services.roberta_model import RobertaDeceptionModel
from app.utils.logger import get_logger
import asyncio

logger = get_logger("InferenceService")

class InferenceService:
    """
    Coordinates between the fast RuleEngine and the slower RobertaDeceptionModel.
    Designed to support async inference pipelines and model swapping.
    """
    def __init__(self):
        logger.info("Initializing InferenceService...")
        self.rule_engine = RuleEngine()
        
        # Load the ML model. In a true prod environment, this might be loaded
        # lazily or injected, but we initialize it here for now.
        try:
            self.ml_model = RobertaDeceptionModel()
            self.use_ml = True
        except Exception as e:
            logger.error(f"Failed to load ML model, falling back to rules only. Error: {e}")
            self.use_ml = False

    async def analyze_element(self, text: str) -> dict:
        """
        Analyzes a single element's text.
        First tries the fast rule engine. If no match, falls back to the ML model.
        """
        # 1. Fast path: Rule-based detection
        rule_result = self.rule_engine.analyze(text)
        if rule_result:
            return rule_result
            
        # 2. Slow path: ML Inference (if available)
        if self.use_ml:
            try:
                logger.debug("Delegating to ML model inference...")
                loop = asyncio.get_running_loop()
                ml_result = await asyncio.wait_for(
                    loop.run_in_executor(None, self.ml_model.predict, text),
                    timeout=5.0
                )
                logger.debug("ML model inference completed successfully.")
                return ml_result
            except asyncio.TimeoutError:
                logger.error("❌ ML inference timed out after 5.0 seconds.")
            except Exception as e:
                logger.error(f"❌ ML inference failed with error: {e}")
            
        # 3. Fallback: No detection
        return {
            "is_dark_pattern": False,
            "dark_pattern_class": 0,
            "dark_pattern_conf": 0.0,
            "is_phishing": False,
            "phishing_conf": 0.0,
            "category": "None",
            "explanation": "No deceptive patterns detected."
        }
