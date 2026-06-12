import asyncio
import sys
import os
from unittest.mock import MagicMock

# 1. Inject Mock Roberta Model Service before importing InferenceService
# This bypasses the heavy PyTorch/Transformer model loading to avoid memory and paging file issues.
class MockRobertaService:
    def predict_darkpattern(self, text):
        lower_text = text.lower()
        # Return positive prediction only for actual manipulative texts
        if any(w in lower_text for w in ["hurry", "only", "limited", "last chance", "no thanks", "hate saving money"]):
            return {"prediction": 1, "confidence": 0.998}
        return {"prediction": 0, "confidence": 0.95}

    def predict_phishing(self, text_or_url):
        lower = text_or_url.lower()
        # If it's a phishing site from our test cases, return positive
        if "verify-paypal-account-login.ru" in lower or "secure-banking-portal.xyz" in lower:
            return {"prediction": 1, "confidence": 0.99}
        # For standard login pages on trusted domains, return high confidence to test our heuristics/suppression
        if "google" in lower or "github" in lower or "paypal" in lower:
            return {"prediction": 1, "confidence": 0.999}
        return {"prediction": 0, "confidence": 0.50}

mock_module = MagicMock()
mock_module.roberta_service = MockRobertaService()
sys.modules["app.services.roberta_model"] = mock_module

# Add the current directory to python path to resolve 'app' imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.inference import InferenceService

async def run_tests():
    print("[TEST] Starting Automated Hybrid Pipeline Tests...\n")
    service = InferenceService()

    # Define test cases covering both Phishing and Dark Patterns
    test_cases = [
        # --- PHISHING TEST CASES ---
        {
            "name": "Legitimate Google Sign-in page",
            "element": {
                "id": "google-login-input",
                "text": "Sign in to your Google Account. Enter your email or password.",
                "url": "https://accounts.google.com/signin/v2/identifier"
            },
            "expected_phishing": False,
            "expected_risk": "None"
        },
        {
            "name": "Legitimate GitHub Login page",
            "element": {
                "id": "github-pass-input",
                "text": "Password. Forgot password?",
                "url": "https://github.com/login"
            },
            "expected_phishing": False,
            "expected_risk": "None"
        },
        {
            "name": "Legitimate PayPal Login page",
            "element": {
                "id": "paypal-login-btn",
                "text": "Log In to your PayPal account securely",
                "url": "https://www.paypal.com/signin"
            },
            "expected_phishing": False,
            "expected_risk": "None"
        },
        {
            "name": "Phishing Brand Spoofing (PayPal typo)",
            "element": {
                "id": "phish-paypal",
                "text": "Log in to your PayPal account to resolve issues",
                "url": "https://verify-paypal-account-login.ru/signin"
            },
            "expected_phishing": True,
            "expected_risk": "High Risk"
        },
        {
            "name": "Phishing Urgency + Credentials on suspicious TLD",
            "element": {
                "id": "phish-urgency",
                "text": "URGENT ACTION REQUIRED: Verify your password immediately to prevent account suspension.",
                "url": "http://secure-banking-portal.xyz/verify"
            },
            "expected_phishing": True,
            "expected_risk": "High Risk"
        },
        {
            "name": "Standard non-phishing content",
            "element": {
                "id": "safe-paragraph",
                "text": "Welcome to our blog. Read the latest updates about AI and machine learning here.",
                "url": "https://medium.com/blog/ai-updates"
            },
            "expected_phishing": False,
            "expected_risk": "None"
        },

        # --- DARK PATTERN TEST CASES ---
        {
            "name": "Safe UI Keyword: Followers",
            "element": {
                "id": "followers-link",
                "text": "Followers",
                "url": "https://github.com/musharafmaqbool"
            },
            "expected_phishing": False,
            "expected_dark_pattern": False,
            "expected_explanation": "Safe UI navigation element."
        },
        {
            "name": "Safe UI Keyword: Repositories",
            "element": {
                "id": "repos-link",
                "text": "Repositories",
                "url": "https://github.com/musharafmaqbool?tab=repositories"
            },
            "expected_phishing": False,
            "expected_dark_pattern": False,
            "expected_explanation": "Safe UI navigation element."
        },
        {
            "name": "Statistic Metric Pattern: 1.2k followers",
            "element": {
                "id": "followers-count",
                "text": "1.2k followers",
                "url": "https://github.com/musharafmaqbool"
            },
            "expected_phishing": False,
            "expected_dark_pattern": False,
            "expected_explanation": "Safe UI navigation element."
        },
        {
            "name": "Statistic Metric Pattern: 12 Repositories",
            "element": {
                "id": "repos-count",
                "text": "12 Repositories",
                "url": "https://github.com/musharafmaqbool"
            },
            "expected_phishing": False,
            "expected_dark_pattern": False,
            "expected_explanation": "Safe UI navigation element."
        },
        {
            "name": "Navigation Structural Tag: nav",
            "element": {
                "id": "menu-nav",
                "text": "Overview",
                "url": "https://github.com/musharafmaqbool",
                "tagName": "nav"
            },
            "expected_phishing": False,
            "expected_dark_pattern": False,
            "expected_explanation": "Safe UI navigation element."
        },
        {
            "name": "Manipulative Dark Pattern: Urgency/Scarcity Tactic",
            "element": {
                "id": "urgency-tactic",
                "text": "Hurry! Only 2 items left in stock! Act fast!",
                "url": "https://suspicious-store.com/checkout"
            },
            "expected_phishing": False,
            "expected_dark_pattern": True
        },
        {
            "name": "Manipulative Dark Pattern: Confirmshaming Language",
            "element": {
                "id": "confirmshame",
                "text": "No thanks, I hate saving money.",
                "url": "https://suspicious-store.com/checkout"
            },
            "expected_phishing": False,
            "expected_dark_pattern": True
        }
    ]

    failed = 0
    for case in test_cases:
        print(f"Testing Case: {case['name']}")
        print(f" - Text: \"{case['element'].get('text', '')}\"")
        print(f" - URL:  {case['element'].get('url', '')}")
        if 'tagName' in case['element']:
            print(f" - Tag:  <{case['element']['tagName']}>")
        
        result = await service.analyze_element(case['element'])
        
        pred_phishing = result["is_phishing"]
        pred_dark_pattern = result["is_dark_pattern"]
        pred_risk = result["phishing_risk_level"]
        pred_conf = result["phishing_conf"]
        explanation = result["explanation"]
        
        print(f" - Result: is_phishing={pred_phishing}, is_dark_pattern={pred_dark_pattern}, Risk Level={pred_risk}")
        print(f" - Explanation: \"{explanation}\"")
        
        is_pass = True
        
        # Verify Phishing expectation
        if "expected_phishing" in case:
            if pred_phishing != case["expected_phishing"]:
                print(f"   [FAIL] Expected phishing={case['expected_phishing']}, but got {pred_phishing}")
                is_pass = False
                
        # Verify Dark Pattern expectation
        if "expected_dark_pattern" in case:
            if pred_dark_pattern != case["expected_dark_pattern"]:
                print(f"   [FAIL] Expected dark pattern={case['expected_dark_pattern']}, but got {pred_dark_pattern}")
                is_pass = False
                
        # Verify Explanation expectation
        if "expected_explanation" in case:
            if explanation != case["expected_explanation"]:
                print(f"   [FAIL] Expected explanation='{case['expected_explanation']}', but got '{explanation}'")
                is_pass = False

        if is_pass:
            print(" PASS\n")
        else:
            failed += 1
            print(" FAIL\n")

    print("=" * 50)
    if failed == 0:
        print("All test cases PASSED successfully! The pipeline operates with full precision.")
    else:
        print(f"{failed} test case(s) FAILED. Please review the pipeline logic.")
    print("=" * 50)
    
    if failed > 0:
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(run_tests())
