from app.services.roberta_model import roberta_service


class InferenceService:

    async def analyze_element(self, element):

        text = element.get("text", "")
        url = element.get("url", "")

        # -----------------------------
        # DARK PATTERN INFERENCE
        # -----------------------------

        darkpattern_result = roberta_service.predict_darkpattern(text)

        # -----------------------------
        # PHISHING INFERENCE
        # -----------------------------

        phishing_input = url if url else text

        phishing_result = roberta_service.predict_phishing(
            phishing_input
        )

        # -----------------------------
        # BUILD RESPONSE
        # -----------------------------

        dark_pattern_threshold = 0.995
        phishing_threshold = 0.999

        is_dark_pattern = (
            darkpattern_result["prediction"] == 1
            and darkpattern_result["confidence"] > dark_pattern_threshold
        )

        is_phishing = (
            phishing_result["prediction"] == 1
            and phishing_result["confidence"] > phishing_threshold
        )

        return {
            "id": element.get("id"),

            "is_dark_pattern": is_dark_pattern,

            "dark_pattern_conf":
                round(darkpattern_result["confidence"], 4),

            "dark_pattern_class":
                1 if is_dark_pattern else 0,

            "is_phishing": is_phishing,

            "phishing_conf":
                round(phishing_result["confidence"], 4),

            "category":
                "dark_pattern"
                if is_dark_pattern
                else (
                    "phishing"
                    if is_phishing
                    else "safe"
                ),

            "explanation":
                self.generate_explanation(
                    is_dark_pattern,
                    is_phishing,
                    darkpattern_result["confidence"],
                    phishing_result["confidence"]
                )
        }

    def generate_explanation(
        self,
        is_dark_pattern,
        is_phishing,
        darkpattern_conf,
        phishing_conf
    ):

        if is_dark_pattern:
            return (
                f"Dark pattern detected "
                f"(confidence: "
                f"{darkpattern_conf:.2f})"
            )

        if is_phishing:
            return (
                f"Potential phishing detected "
                f"(confidence: "
                f"{phishing_conf:.2f})"
            )

        return "Element appears safe."


inference_service = InferenceService()