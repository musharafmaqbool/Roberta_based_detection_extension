import torch
from transformers import pipeline

class RobertaDeceptionModel:
    """
    Placeholder for the fine-tuned RoBERTa model.
    Designed to easily swap in custom weights later.
    Currently uses zero-shot classification to simulate the dual-head architecture.
    """
    def __init__(self, model_path: str = None):
        self.device = 0 if torch.cuda.is_available() else -1
        
        # In a real scenario, you would load your custom model here:
        # self.model = CustomRobertaDualHead.from_pretrained(model_path)
        # self.tokenizer = RobertaTokenizer.from_pretrained(model_path)
        
        # For now, using a zero-shot classifier as a placeholder to simulate ML inference
        print("Loading placeholder RoBERTa model (zero-shot classifier)...")
        self.classifier = pipeline(
            "zero-shot-classification",
            model="facebook/bart-large-mnli", # Lightweight placeholder
            device=self.device
        )
        print("Model loaded.")

    def predict(self, text: str):
        """
        Simulates the dual-head output for Dark Patterns and Phishing.
        """
        if not text or len(text.strip()) < 3:
            return self._empty_prediction()

        # Simulate Head 1: Dark Pattern Classification
        dp_labels = ["manipulative", "misleading", "urgent", "normal text"]
        dp_result = self.classifier(text, dp_labels)
        top_dp_label = dp_result['labels'][0]
        dp_conf = dp_result['scores'][0]

        is_dark_pattern = top_dp_label in ["manipulative", "misleading", "urgent"] and dp_conf > 0.6
        dp_class = 2 if is_dark_pattern and dp_conf > 0.8 else (1 if is_dark_pattern else 0)
        
        # Simulate Head 2: Phishing Classification
        ph_labels = ["phishing or scam", "safe content"]
        ph_result = self.classifier(text, ph_labels)
        is_phishing = ph_result['labels'][0] == "phishing or scam" and ph_result['scores'][0] > 0.6
        ph_conf = ph_result['scores'][0]

        # Generate explanation
        explanation = "ML Model found semantic similarities to deceptive language." if (is_dark_pattern or is_phishing) else "Text appears benign."
        category = "ML Detected" if (is_dark_pattern or is_phishing) else "Safe"

        return {
            "is_dark_pattern": is_dark_pattern,
            "dark_pattern_class": dp_class,
            "dark_pattern_conf": round(dp_conf, 2),
            "is_phishing": is_phishing,
            "phishing_conf": round(ph_conf, 2),
            "category": category,
            "explanation": explanation
        }

    def _empty_prediction(self):
        return {
            "is_dark_pattern": False,
            "dark_pattern_class": 0,
            "dark_pattern_conf": 0.0,
            "is_phishing": False,
            "phishing_conf": 0.0,
            "category": "None",
            "explanation": "Text too short for analysis."
        }
