import re
import logging
from urllib.parse import urlparse
from app.services.roberta_model import roberta_service
from app.utils.logger import get_logger

logger = get_logger("PhishingInference")

class InferenceService:
    def __init__(self):
        # 1. Trusted Domains Whitelist
        self.TRUSTED_DOMAINS = {
            "google.com",
            "github.com",
            "paypal.com",
            "amazon.com",
            "microsoft.com",
            "linkedin.com",
            "openai.com",
            "apple.com",
            "facebook.com",
            "netflix.com",
            "twitter.com",
            "x.com",
            "yahoo.com",
            "live.com",
            "outlook.com",
            "zoom.us",
            "dropbox.com",
            "salesforce.com"
        }

        # 2. Suspicious TLDs commonly used in phishing campaigns
        self.SUSPICIOUS_TLDS = {
            "xyz", "top", "free", "click", "club", "ru", "cc", "info", 
            "work", "fit", "biz", "gq", "cf", "ml", "ga", "buzz", "win"
        }

        # 3. Phishing Indicators: Urgency Language & Credential Harvesting phrases
        self.URGENCY_PHRASES = [
            "verify immediately",
            "account suspended",
            "urgent action required",
            "confirm identity",
            "claim reward now",
            "login to secure account",
            "immediate action",
            "unauthorized login",
            "action required",
            "security alert",
            "suspended immediately",
            "suspend your account",
            "confirm your passcode",
            "session expired",
            "verify your identity"
        ]

        self.CREDENTIAL_KEYWORDS = [
            "password",
            "login",
            "sign in",
            "verify",
            "account",
            "credential",
            "secure",
            "bank",
            "ssn",
            "passcode",
            "otp",
            "credit card",
            "billing",
            "username",
            "passphrase"
        ]

        # 4. Dark Pattern Safe UI elements & Preprocessing Gate indicators
        self.SAFE_UI_KEYWORDS = {
            "repositories",
            "followers",
            "following",
            "stars",
            "projects",
            "packages",
            "overview",
            "dashboard",
            "settings",
            "notifications",
            "profile",
            "messages",
            "pull requests",
            "issues",
            "commits",
            "actions"
        }

        self.MANIPULATIVE_INDICATORS = [
            "hurry",
            "only",
            "limited",
            "last chance",
            "act now",
            "buy now",
            "claim reward",
            "exclusive offer",
            "save money",
            "before it's gone",
            "offer ends",
            "don't miss out",
            "deal expires",
            "low stock",
            "no thanks",
            "hate saving money",
            "prefer paying full price",
            "prefer paying full"
        ]

    def _extract_domain(self, url: str) -> str:
        """
        Safely extracts the clean lowercased domain from a URL.
        """
        if not url:
            return ""
        try:
            parsed = urlparse(url)
            netloc = parsed.netloc.lower()
            if ":" in netloc:
                netloc = netloc.split(":")[0]
            if netloc.startswith("www."):
                netloc = netloc[4:]
            return netloc
        except Exception as e:
            logger.error(f"Error parsing URL {url}: {e}")
            return ""

    def _is_trusted_domain(self, domain: str) -> bool:
        """
        Checks if the domain or its parent domain is in the trusted whitelist.
        """
        if not domain:
            return False
        return domain in self.TRUSTED_DOMAINS or any(domain.endswith(f".{td}") for td in self.TRUSTED_DOMAINS)

    def _analyze_url_reputation(self, domain: str) -> dict:
        """
        Performs heuristic reputation scans on the domain name.
        Catches brand spoofing, suspicious TLDs, excessive hyphens, and IP domains.
        """
        if not domain:
            return {
                "suspicious_tld": False,
                "excessive_hyphens": False,
                "is_ip_based": False,
                "spoofed_brand": False
            }

        # 1. Check if IP address
        ip_pattern = r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$'
        is_ip = bool(re.match(ip_pattern, domain))

        # 2. Check for suspicious TLD
        parts = domain.split(".")
        tld = parts[-1] if len(parts) > 1 else ""
        suspicious_tld = tld in self.SUSPICIOUS_TLDS

        # 3. Check for excessive hyphens (common in spoofed domains like verify-paypal-login.xyz)
        excessive_hyphens = domain.count("-") >= 2

        # 4. Check for brand spoofing (e.g., paypal-secure-update.com containing 'paypal' on untrusted domain)
        spoofed_brand = False
        domain_tokens = re.split(r'[-.]', domain)
        for trusted in self.TRUSTED_DOMAINS:
            brand_name = trusted.split(".")[0]
            # If the brand name is very short (like 'x'), require exact match in tokens
            if len(brand_name) <= 2:
                if any(token == brand_name for token in domain_tokens):
                    if not self._is_trusted_domain(domain):
                        spoofed_brand = True
                        break
            else:
                # For longer brands, check if it's a substring of any token
                if any(brand_name in token for token in domain_tokens):
                    if not self._is_trusted_domain(domain):
                        spoofed_brand = True
                        break


        return {
            "suspicious_tld": suspicious_tld,
            "excessive_hyphens": excessive_hyphens,
            "is_ip_based": is_ip,
            "spoofed_brand": spoofed_brand
        }

    async def analyze_element(self, element):
        text = element.get("text", "")
        url = element.get("url", "")
        element_id = element.get("id")
        tag_name = element.get("tagName", "").strip().lower()

        # -----------------------------
        # DARK PATTERN INFERENCE & HEURISTIC GATING
        # -----------------------------
        lower_text = text.strip().lower()
        is_dark_pattern = False
        darkpattern_result = {"prediction": 0, "confidence": 0.0}
        dark_pattern_explanation = None

        # Heuristic 1: Short text check (< 4 chars)
        if len(lower_text) < 4:
            logger.info(f"[Dark Pattern] Skipped short text: '{text}' (< 4 chars)")
            dark_pattern_explanation = "Safe UI navigation element."
            
        # Heuristic 2: Exact safe UI navigation keyword match
        elif lower_text in self.SAFE_UI_KEYWORDS:
            logger.info(f"[Dark Pattern] Skipped safe UI keyword match: '{text}'")
            dark_pattern_explanation = "Safe UI navigation element."
            
        # Heuristic 3: Navigation/menu structural elements (nav, header, footer, menu, aside)
        elif tag_name in ["nav", "header", "footer", "menu", "aside"]:
            logger.info(f"[Dark Pattern] Skipped structural navigation tag: <{tag_name}> for text: '{text}'")
            dark_pattern_explanation = "Safe UI navigation element."
            
        # Heuristic 4: Statistic, profile metrics, counters check
        elif re.match(r'^\s*[\d,.]+[km]?\s*(followers|following|stars|forks|repositories|contributions|commits|views|members|watchers|projects|packages|issues|pull requests|actions|discussions)?\s*$', lower_text):
            logger.info(f"[Dark Pattern] Skipped profile statistic/counter pattern: '{text}'")
            dark_pattern_explanation = "Safe UI navigation element."
            
        # Heuristic 5: Preprocessing gate check for manipulative triggers
        elif not any(indicator in lower_text for indicator in self.MANIPULATIVE_INDICATORS):
            logger.info(f"[Dark Pattern] Preprocessing gate skip: No manipulative indicator in text: '{text}'")
            
        else:
            # Run the RoBERTa dark pattern sequence classification model
            darkpattern_result = roberta_service.predict_darkpattern(text)
            dark_pattern_threshold = 0.995
            is_dark_pattern = (
                darkpattern_result["prediction"] == 1
                and darkpattern_result["confidence"] >= dark_pattern_threshold
            )
            if is_dark_pattern:
                logger.warning(f"[Dark Pattern] High confidence dark pattern detected! Confidence: {darkpattern_result['confidence']:.4f}")


        # -----------------------------
        # DOMAIN ANALYSIS
        # -----------------------------
        domain = self._extract_domain(url)
        is_trusted = self._is_trusted_domain(domain)
        reputation = self._analyze_url_reputation(domain)

        is_suspicious_domain = (
            reputation["suspicious_tld"] or
            reputation["excessive_hyphens"] or
            reputation["is_ip_based"] or
            reputation["spoofed_brand"]
        )

        if is_trusted:
            logger.info(f"[Phishing Detection] Trusted domain detected: {domain}. Phishing sensitivity reduced.")

        # -----------------------------
        # HEURISTICS MATCHING
        # -----------------------------
        lower_text = text.lower()
        has_urgency = any(phrase in lower_text for phrase in self.URGENCY_PHRASES)
        has_credential = any(keyword in lower_text for keyword in self.CREDENTIAL_KEYWORDS)

        # -----------------------------
        # PHISHING PREDICTION TRIGGERS
        # -----------------------------
        # Check if text or URL contains phishing words
        combined_text = f"{text} {url}".lower()
        contains_phishing_keywords = any(
            keyword in combined_text for keyword in self.CREDENTIAL_KEYWORDS
        )

        should_check_phishing = contains_phishing_keywords or is_suspicious_domain

        # Initialize phishing values
        phishing_result = {"prediction": 0, "confidence": 0.0}
        phishing_risk_level = "None"
        is_phishing = False
        explanation_tag = "safe"

        # Adaptive Threshold & Decision Pipeline
        if should_check_phishing:
            # Check if we can safely skip inference on trusted domain
            if is_trusted and not has_urgency and not is_suspicious_domain:
                logger.info(
                    f"[Phishing Detection] Phishing scan skipped for trusted domain: {domain} "
                    f"(Standard credential field '{text}' with no urgency or spoofing detected)."
                )
                phishing_risk_level = "None"
                is_phishing = False
                explanation_tag = "trusted_domain_safe"
            else:
                # Run the RoBERTa phishing model
                # The model takes url as primary context if present, fallback to text
                phishing_input = url if url else text
                phishing_result = roberta_service.predict_phishing(phishing_input)
                
                raw_pred = phishing_result["prediction"]
                raw_conf = phishing_result["confidence"]

                # -----------------------------
                # HYBRID CLASSIFICATION RULES
                # -----------------------------
                if is_trusted:
                    # Stricter threshold on trusted domains
                    trusted_threshold = 0.999
                    if raw_pred == 1 and raw_conf >= trusted_threshold:
                        # Even on trusted domains, extremely high confidence + urgency raises alert
                        if has_urgency:
                            is_phishing = True
                            phishing_risk_level = "High Risk"
                            explanation_tag = "trusted_domain_phish_urgency"
                            logger.warning(
                                f"[Phishing Detection] High confidence phishing detected on TRUSTED domain {domain}! "
                                f"Confidence: {raw_conf:.4f}, Urgency detected."
                            )
                        else:
                            is_phishing = False
                            phishing_risk_level = "Low Risk"
                            explanation_tag = "trusted_domain_low_risk"
                            logger.info(
                                f"[Phishing Detection] High ML prediction on trusted domain {domain} but suppressed "
                                f"(No urgency detected. Credential fields alone do not trigger)."
                            )
                    else:
                        is_phishing = False
                        phishing_risk_level = "None"
                        explanation_tag = "trusted_domain_safe"
                else:
                    # Untrusted Domain Classification
                    default_threshold = 0.95

                    # Rule A: Brand spoofing detected (e.g. microsoft-verify.xyz) - Critical Indicator
                    if reputation["spoofed_brand"] and raw_pred == 1 and raw_conf >= 0.80:
                        is_phishing = True
                        phishing_risk_level = "High Risk"
                        explanation_tag = "spoofed_brand"
                        # Boost confidence score artificially for UI representation of critical threat
                        phishing_result["confidence"] = max(raw_conf, 0.99)
                        logger.warning(
                            f"[Phishing Detection] Hybrid phishing rule triggered: Brand spoofing on {domain}! "
                            f"ML confidence: {raw_conf:.4f}"
                        )
                    
                    # Rule B: Suspicious Domain + Credential/Urgency Keywords
                    elif is_suspicious_domain and raw_pred == 1 and raw_conf >= 0.85 and (has_urgency or has_credential):
                        is_phishing = True
                        phishing_risk_level = "High Risk"
                        explanation_tag = "suspicious_domain_hybrid"
                        phishing_result["confidence"] = max(raw_conf, 0.98)
                        logger.warning(
                            f"[Phishing Detection] Hybrid phishing rule triggered: Suspicious domain + text heuristics on {domain}! "
                            f"ML confidence: {raw_conf:.4f}"
                        )

                    # Rule C: General Urgency + Credentials combo on normal untrusted domain
                    elif raw_pred == 1 and raw_conf >= 0.88 and has_urgency and has_credential:
                        is_phishing = True
                        phishing_risk_level = "High Risk"
                        explanation_tag = "urgency_credentials_hybrid"
                        phishing_result["confidence"] = max(raw_conf, 0.96)
                        logger.warning(
                            f"[Phishing Detection] Hybrid phishing rule triggered: Urgency + Credential harvest combo on {domain}! "
                            f"ML confidence: {raw_conf:.4f}"
                        )

                    # Rule D: Direct High Confidence ML Match
                    elif raw_pred == 1 and raw_conf >= default_threshold:
                        is_phishing = True
                        phishing_risk_level = "High Risk"
                        explanation_tag = "high_confidence_ml"
                        logger.warning(
                            f"[Phishing Detection] High confidence phishing detected on {domain}! "
                            f"Confidence: {raw_conf:.4f}"
                        )

                    # Rule E: Moderate confidence without urgency (Medium Risk, no visual highlight)
                    elif raw_pred == 1 and raw_conf >= 0.80:
                        is_phishing = False
                        phishing_risk_level = "Medium Risk"
                        explanation_tag = "medium_risk"
                        logger.info(
                            f"[Phishing Detection] Medium Risk phishing logged on {domain} (Confidence: {raw_conf:.4f}). "
                            f"Not visually highlighted."
                        )

                    # Rule F: Low confidence
                    elif raw_pred == 1 and raw_conf >= 0.50:
                        is_phishing = False
                        phishing_risk_level = "Low Risk"
                        explanation_tag = "low_risk"
                    else:
                        is_phishing = False
                        phishing_risk_level = "None"
        else:
            # No keywords or domain triggers
            phishing_risk_level = "None"
            is_phishing = False

        # Set overall category
        if is_phishing:
            category = "phishing"
        elif is_dark_pattern:
            category = "dark_pattern"
        else:
            category = "safe"

        # Generate explanation based on hybrid rules and tags
        explanation = self.generate_custom_explanation(
            text=text,
            category=category,
            darkpattern_conf=darkpattern_result["confidence"],
            phishing_conf=phishing_result["confidence"],
            explanation_tag=explanation_tag,
            reputation=reputation,
            has_urgency=has_urgency,
            has_credential=has_credential,
            dark_pattern_explanation=dark_pattern_explanation
        )

        return {
            "id": element_id,
            "text": text,
            "is_dark_pattern": is_dark_pattern,
            "dark_pattern_conf": round(darkpattern_result["confidence"], 4),
            "dark_pattern_class": 1 if is_dark_pattern else 0,
            "is_phishing": is_phishing,
            "phishing_conf": round(phishing_result["confidence"], 4),
            "phishing_risk_level": phishing_risk_level,
            "category": category,
            "explanation": explanation
        }

    def generate_custom_explanation(
        self,
        text,
        category,
        darkpattern_conf,
        phishing_conf,
        explanation_tag,
        reputation,
        has_urgency,
        has_credential,
        dark_pattern_explanation=None
    ):
        """
        Generates advanced, research-oriented threat explanations.
        """
        # 1. Dark Pattern
        if category == "dark_pattern":
            lower_text = text.lower()
            if "only" in lower_text or "last chance" in lower_text or "limited" in lower_text:
                return f"Urgency/scarcity tactic detected (confidence: {darkpattern_conf:.2f})"
            if "hate saving money" in lower_text or "no thanks" in lower_text:
                return f"Confirmshaming language detected (confidence: {darkpattern_conf:.2f})"
            return f"Manipulative interface pattern detected (confidence: {darkpattern_conf:.2f})"

        # 2. Phishing
        if category == "phishing":
            if explanation_tag == "spoofed_brand":
                return "Potential domain spoofing attempt detected"
            if explanation_tag == "trusted_domain_phish_urgency":
                return "Suspicious urgency-based pattern on trusted domain"
            if explanation_tag == "suspicious_domain_hybrid":
                if has_urgency:
                    return "Urgency-based social engineering detected on suspicious domain"
                return "Credential harvesting indicators identified on suspicious domain"
            if explanation_tag == "urgency_credentials_hybrid":
                return "Urgency-based social engineering + credential harvesting detected"
            if has_credential:
                return "Credential harvesting indicators identified"
            if has_urgency:
                return "Urgency-based social engineering detected"
            if reputation.get("suspicious_tld") or reputation.get("excessive_hyphens"):
                return "Suspicious authentication workflow identified on untrusted domain"
            return f"Potential phishing activity detected (confidence: {phishing_conf:.2f})"

        # 3. Safe / Reduced Sensitivity explanations
        if category == "safe" and dark_pattern_explanation:
            return dark_pattern_explanation
        if explanation_tag == "trusted_domain_safe":
            return "Trusted domain detected - phishing sensitivity reduced"
        if explanation_tag == "trusted_domain_low_risk":
            return "Trusted domain verified. Phishing sensitivity reduced."
        if explanation_tag == "medium_risk":
            return "Suspicious elements noted (Medium Risk)"
        if explanation_tag == "low_risk":
            return "Standard login component (Low Risk)"

        return "Element appears safe."


inference_service = InferenceService()
