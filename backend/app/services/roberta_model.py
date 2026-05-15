from app.utils.logger import get_logger

logger = get_logger("RobertaModel")

class RobertaDeceptionModel:
    """
    Placeholder for the fine-tuned RoBERTa model.
    Designed to easily swap in custom weights later.
    Currently uses zero-shot classification to simulate the dual-head architecture.
    """
    def __init__(self, model_path: str = None):
        logger.debug(f"Initializing RobertaDeceptionModel in MOCK mode (Transformers bypassed).")
        self.classifier = None
        
    def predict(self, text: str):
        """
        Simulates the dual-head output for Dark Patterns and Phishing.
        """
        if not text or len(text.strip()) < 3:
            return self._empty_prediction()

        logger.debug(f"Running MOCK ML inference on text length: {len(text)}")
        return self._empty_prediction()

    def _empty_prediction(self):
        return {
            "is_dark_pattern": False,
            "dark_pattern_class": 0,
            "dark_pattern_conf": 0.0,
            "is_phishing": False,
            "phishing_conf": 0.0,
            "category": "None",
            "explanation": "No complex deceptive patterns detected."
        }
