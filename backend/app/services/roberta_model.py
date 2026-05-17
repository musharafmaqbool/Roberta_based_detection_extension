import torch

from transformers import (
    RobertaTokenizer,
    RobertaForSequenceClassification
)


class RobertaInferenceService:

    def __init__(self):

        self.device = torch.device(
            "cuda" if torch.cuda.is_available() else "cpu"
        )

        print(f"[Roberta] Using device: {self.device}")

        # -----------------------------
        # DARK PATTERN MODEL
        # -----------------------------

        self.darkpattern_tokenizer = RobertaTokenizer.from_pretrained(
            "roberta-base"
        )

        self.darkpattern_model = RobertaForSequenceClassification.from_pretrained(
            "models/roberta_darkpattern_v2"
        ).to(self.device)

        self.darkpattern_model.eval()

        print("[Roberta] Dark Pattern model loaded.")

        # -----------------------------
        # PHISHING MODEL
        # -----------------------------

        self.phishing_tokenizer = RobertaTokenizer.from_pretrained(
            "roberta-base"
        )

        self.phishing_model = RobertaForSequenceClassification.from_pretrained(
            "models/roberta_phishing_model"
        ).to(self.device)

        self.phishing_model.eval()

        print("[Roberta] Phishing model loaded.")

    # ---------------------------------
    # DARK PATTERN PREDICTION
    # ---------------------------------

    def predict_darkpattern(self, text):

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