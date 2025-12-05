# backend/server.py
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import os, requests, logging, base64, uuid

# =============================
#  LOAD ENVIRONMENT VARIABLES
# =============================
load_dotenv()

FAL_KEY = os.environ.get("FAL_KEY")
FAL_IMAGE_ENDPOINT = os.environ.get("FAL_IMAGE_ENDPOINT") or "https://queue.fal.run/fal-ai/fast-sdxl"
FAL_VIDEO_ENDPOINT = os.environ.get("FAL_VIDEO_ENDPOINT") or "https://queue.fal.run/fal-ai/kling-video/v1/standard/text-to-video"
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", 3001))

if not FAL_KEY:
    raise RuntimeError("Missing FAL_KEY in backend/.env")

# =============================
#  FOLDERS SETUP
# =============================
BASE_DIR = os.path.dirname(__file__)

# Unified output directory
output_dir = os.path.join(BASE_DIR, "output")
os.makedirs(output_dir, exist_ok=True)

# =============================
#  FLASK APP
# =============================
app = Flask(__name__, static_url_path="/output", static_folder="output")
CORS(app)

logging.basicConfig(level=logging.INFO)


# =============================
#  HELPERS
# =============================
def save_base64_file(b64data, out_dir, ext="png"):
    """Save base64 data to disk and return filename."""
    filename = f"{uuid.uuid4().hex[:10]}.{ext}"
    out_path = os.path.join(out_dir, filename)
    with open(out_path, "wb") as f:
        f.write(base64.b64decode(b64data))
    return filename


def fal_headers():
    return {
        "Authorization": f"Key {FAL_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "AstravynBackend/1.0",
    }


# =============================
#  IMAGE GENERATION
# =============================
@app.route("/api/generate", methods=["POST"])
def generate_image():
    payload = request.get_json() or {}
    prompt = payload.get("prompt")
    size = payload.get("size", "512x512")
    count = int(payload.get("count", 1))
    user_id = request.headers.get("X-User-ID")

    if user_id:
        logging.info(f"Request from User ID: {user_id}")


    if not prompt:
        return jsonify({"error": "Missing prompt"}), 400

    body = {"prompt": prompt, "size": size, "n": count}
    logging.info(f"Requesting images from {FAL_IMAGE_ENDPOINT}")

    resp = requests.post(
        FAL_IMAGE_ENDPOINT, json=body, headers=fal_headers(), timeout=120
    )

    if resp.status_code != 200:
        return jsonify(
            {"error": "Image provider error", "code": resp.status_code, "details": resp.text}
        ), 500

    try:
        data = resp.json()
    except Exception as e:
        logging.exception("Invalid JSON from image provider")
        return jsonify({"error": "Invalid JSON", "details": str(e)}), 500

    images_out = []
    for item in data.get("data", []):
        if isinstance(item, dict):
            if item.get("url"):
                images_out.append(item["url"])
            elif item.get("b64") or item.get("b64_json"):
                b64 = item.get("b64") or item.get("b64_json")
                fname = save_base64_file(b64, output_dir, ext="png")
                images_out.append(f"/output/{fname}")
        else:
            images_out.append(str(item))

    return jsonify({"images": images_out})


# =============================
#  VIDEO GENERATION
# =============================
@app.route("/api/generate-video", methods=["POST"])
def generate_video():
    payload = request.get_json() or {}
    prompt = payload.get("prompt")
    duration = payload.get("duration")
    user_id = request.headers.get("X-User-ID")

    if user_id:
        logging.info(f"Video Request from User ID: {user_id}")

    if not prompt:
        return jsonify({"error": "Missing prompt"}), 400

    body = {"prompt": prompt}
    if duration:
        body["duration"] = duration

    logging.info(f"Requesting videos from {FAL_VIDEO_ENDPOINT}")

    resp = requests.post(
        FAL_VIDEO_ENDPOINT, json=body, headers=fal_headers(), timeout=300
    )

    if resp.status_code != 200:
        return jsonify(
            {"error": "Video provider error", "code": resp.status_code, "details": resp.text}
        ), 500

    try:
        data = resp.json()
    except Exception as e:
        logging.exception("Invalid JSON from video provider")
        return jsonify({"error": "Invalid JSON", "details": str(e)}), 500

    videos_out = []
    for item in data.get("data", []):
        if isinstance(item, dict):
            if item.get("url"):
                videos_out.append(item["url"])
            elif item.get("b64") or item.get("b64_json"):
                b64 = item.get("b64") or item.get("b64_json")
                fname = save_base64_file(b64, output_dir, ext="mp4")
                videos_out.append(f"/output/{fname}")
        else:
            videos_out.append(str(item))

    return jsonify({"videos": videos_out})


# =============================
#  LIBRARY
# =============================
@app.route("/api/library")
def get_library():
    """List all files in the output directory."""
    files = []
    if os.path.exists(output_dir):
        for f in os.listdir(output_dir):
            if f.lower().endswith(('.png', '.jpg', '.jpeg', '.mp4', '.gif')):
                files.append(f"/output/{f}")
    # Sort by newest first (optional, based on modification time if needed, but simple list for now)
    return jsonify({"files": files})


# serve saved files (unified)
@app.route("/output/<path:filename>")
def serve_saved_file(filename):
    return send_from_directory(output_dir, filename)


# =============================
#  HEALTH CHECK
# =============================
@app.route("/")
def index():
    return jsonify({"status": "ok", "message": "Astravyn Backend Running"})


# =============================
#  MAIN ENTRY
# =============================
if __name__ == "__main__":
    print(f"\nStarting Astravyn Backend on http://{HOST}:{PORT}")
    app.run(host=HOST, port=PORT, debug=True)
