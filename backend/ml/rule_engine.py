class RuleEngine:
    """
    A lightweight, fast rule-based engine to catch obvious dark patterns and phishing 
    before falling back to the ML model.
    """
    def __init__(self):
        # Common dark pattern keywords categorized
        self.dark_pattern_keywords = {
            "Urgency": ["hurry", "only a few left", "offer ends in", "act fast"],
            "Misdirection": ["no thanks, i prefer paying full price", "skip this exclusive offer"],
            "Social Proof": ["people are viewing this", "just bought this"],
            "Forced Action": ["must agree", "required to continue"]
        }
        
        # Common phishing keywords
        self.phishing_keywords = [
            "verify your account", "update your billing", "account suspended", 
            "login immediately", "claim your prize", "click here to secure"
        ]

    def analyze(self, text: str):
        """
        Analyzes text using rules and returns a dict with detections if found.
        Returns None if no rules match.
        """
        text_lower = text.lower()
        
        # Check for Dark Patterns
        for category, keywords in self.dark_pattern_keywords.items():
            for keyword in keywords:
                if keyword in text_lower:
                    return {
                        "is_dark_pattern": True,
                        "dark_pattern_class": 2, # High risk due to explicit match
                        "dark_pattern_conf": 0.95,
                        "is_phishing": False,
                        "phishing_conf": 0.0,
                        "category": category,
                        "explanation": f"Rule match: Contains language typical of '{category}' dark patterns."
                    }
                    
        # Check for Phishing
        for keyword in self.phishing_keywords:
            if keyword in text_lower:
                 return {
                    "is_dark_pattern": False,
                    "dark_pattern_class": 0,
                    "dark_pattern_conf": 0.0,
                    "is_phishing": True,
                    "phishing_conf": 0.95,
                    "category": "Social Engineering",
                    "explanation": "Rule match: Contains urgency/action verbs common in phishing attacks."
                }
                
        return None
