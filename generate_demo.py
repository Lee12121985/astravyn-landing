import requests
import time

url = "http://localhost:3001/api/generate-video"
prompt = "A futuristic cyberpunk city with neon lights and flying cars, cinematic 4k"

print(f"Generating video with prompt: '{prompt}'...")
try:
    res = requests.post(url, json={"prompt": prompt, "duration": 5}, timeout=300)
    if res.status_code == 200:
        print("Video generated successfully!")
        print(res.json())
    else:
        print(f"Failed: {res.text}")
except Exception as e:
    print(f"Error: {e}")
