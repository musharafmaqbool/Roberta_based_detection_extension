import torch
from transformers import (
    RobertaTokenizer,
    RobertaForSequenceClassification
)
from app.utils.logger import get_logger

logger = get_logger("RobertaModel")
logger.info("🔍 [Roberta] Entering roberta_model.py")

class RobertaInferenceService:
    def __init__(self):
        self.device = torch.device(
            "cuda" if torch.cuda.is_available() else "cpu"
        )
        logger.info(f"🖥️ [Roberta] Initializing RobertaInferenceService on device: {self.device}")
        
        self.darkpattern_tokenizer = None
        self.darkpattern_model = None
        self.phishing_tokenizer = None
        self.phishing_model = None

    def _init_darkpattern_model(self):
        if self.darkpattern_model is None:
            logger.info("🧠 [Roberta] Dark Pattern model loading started...")
            self.darkpattern_tokenizer = RobertaTokenizer.from_pretrained(
                "roberta-base"
            )
            self.darkpattern_model = RobertaForSequenceClassification.from_pretrained(
                "models/roberta_darkpattern_v2"
            ).to(self.device)
            self.darkpattern_model.eval()
            logger.info("✅ [Roberta] Dark Pattern model loading completed.")

    def _init_phishing_model(self):
        if self.phishing_model is None:
            logger.info("🧠 [Roberta] Phishing model loading started...")
            self.phishing_tokenizer = RobertaTokenizer.from_pretrained(
                "roberta-base"
            )
            self.phishing_model = RobertaForSequenceClassification.from_pretrained(
                "models/roberta_phishing_model"
            ).to(self.device)
            self.phishing_model.eval()
            logger.info("✅ [Roberta] Phishing model loading completed.")

    # ---------------------------------
    # DARK PATTERN PREDICTION
    # ---------------------------------
    def predict_darkpattern(self, text):
        self._init_darkpattern_model()
        
        inputs = self.darkpattern_tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            padding=True,
            max_length=128
        ).to(self.device)

        with torch.no_grad():
            outputs = self.darkpattern_model(**inputs)

        probs = torch.softmax(outputs.logits, dim=1)
        prediction = torch.argmax(probs, dim=1).item()
        confidence = probs[0][prediction].item()

        return {
            "prediction": prediction,
            "confidence": confidence
        }

    # ---------------------------------
    # PHISHING PREDICTION
    # ---------------------------------
    def predict_phishing(self, text):
        self._init_phishing_model()
        
        inputs = self.phishing_tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            padding=True,
            max_length=128
        ).to(self.device)

        with torch.no_grad():
            outputs = self.phishing_model(**inputs)

        probs = torch.softmax(outputs.logits, dim=1)
        prediction = torch.argmax(probs, dim=1).item()
        confidence = probs[0][prediction].item()

        return {
            "prediction": prediction,
            "confidence": confidence
        }

roberta_service = RobertaInferenceService()