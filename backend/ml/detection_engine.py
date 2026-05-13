from .rule_engine import RuleEngine
from .roberta_model import RobertaDeceptionModel

class DetectionEngine:
    """
    Hybrid detection engine combining lightweight rules with deep learning ML.
    """
    def __init__(self):
        self.rule_engine = RuleEngine()
        # Initialize ML model placeholder (will download bart-large-mnli on first run)
        # To avoid blocking the server startup for a long time, we instantiate it here.
        self.ml_model = RobertaDeceptionModel()

    def analyze_element(self, text: str):
        """
        Runs hybrid analysis on a single text string.
        1. Rule-based check (fast)
        2. ML-based check (slower, deep semantic analysis)
        """
        # 1. Fast Rule-Based Detection
        rule_result = self.rule_engine.analyze(text)
        if rule_result:
            return rule_result

        # 2. Fallback to ML Model
        ml_result = self.ml_model.predict(text)
        return ml_result
