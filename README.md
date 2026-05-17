# Sentinel: AI-Powered Deception Detection Extension

Sentinel is a real-time deception detection pipeline designed to protect users from manipulative web design and malicious links. It consists of a Chrome extension (frontend) and a local FastAPI server (backend) that work together to identify and flag Dark Patterns and Phishing attempts.

## Architecture

The project is split into two main components:

### 1. Extension (Frontend)
A Chrome extension that acts as a real-time DOM scanner.
- Identifies interactive elements on the page (links, forms, buttons).
- Extracts text content and URLs.
- Sends batches of elements to the local backend for analysis.
- Dynamically injects visual alerts and tooltips into the webpage based on the backend's predictions.
- Bypasses the need for an external cloud server to maintain user privacy.

### 2. Backend (FastAPI + RoBERTa)
A high-performance local server that performs Machine Learning inference.
- **Framework**: Built with FastAPI for fast, asynchronous request handling.
- **Inference Service**: Loads two fine-tuned sequence classification models based on `roberta-base`.
  - **Dark Pattern Model**: Analyzes text to detect manipulative designs (e.g., false urgency, misdirection).
  - **Phishing Model**: Analyzes URLs and text to detect malicious or deceptive links.
- **Endpoint**: Exposes a `/analyze` POST route that receives batches of DOM elements, runs them through the models, and returns structured prediction results.

## Key Features Implemented

* **Dual RoBERTa Models**: Separated logic for Dark Pattern and Phishing detection using local fine-tuned weights and base tokenizers.
* **Strict Confidence Thresholds**: To ensure a high-quality user experience and prevent false positives on normal e-commerce text (like "Add item to cart"), predictions are only flagged if they meet strict confidence thresholds:
  * Dark Pattern Threshold: `> 0.995`
  * Phishing Threshold: `> 0.999`
* **Robust Schema Validation**: Uses Pydantic to enforce strict data structures (`DOMElement`, `AnalyzeRequest`, `PredictionResult`) between the extension and the backend, preventing runtime errors.
* **Smart Explanations**: Generates human-readable explanations based on which model triggered the alert and its confidence score.

## Setup & Running Locally

### Backend
1. Navigate to the `backend/` directory.
2. Activate your virtual environment (e.g., `source venv/Scripts/activate`).
3. Start the server using the run script:
   ```bash
   python run.py
   ```
   The backend will run on `http://localhost:8000` with hot-reloading enabled.

### Extension
1. Open Google Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `extension/` directory.

---
*Built for detecting and mitigating deceptive web practices in real-time.*
