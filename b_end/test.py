import os
import httpx
from dotenv import load_dotenv

# Load variables from .env
load_dotenv()

def test_environment_and_apis():
    print("--- 1. Checking Environment Variables ---")
    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
    eleven_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    voice_id = os.environ.get("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM").strip()

    print(f"GEMINI_API_KEY found: {'YES' if gemini_key else 'NO'}")
    print(f"ELEVENLABS_API_KEY found: {'YES' if eleven_key else 'NO'}")
    print(f"ELEVENLABS_VOICE_ID: {voice_id}")

    # 2. Test Gemini API
    print("\n--- 2. Testing Gemini API Connection ---")
    if not gemini_key:
        print("[SKIPPED] GEMINI_API_KEY is missing from .env")
    else:
        try:
            from google import genai
            client = genai.Client(api_key=gemini_key)
            response = client.models.generate_content(
                model="gemini-3.6-flash",
                contents="Ping! Reply with 'Gemini OK' only."
            )
            print(f"[SUCCESS] Gemini Response: {response.text.strip()}")
        except Exception as e:
            print(f"[INFO] Gemini unavailable: {e}")
            print("[FALLBACK] Built-in application fallback will be used.")

    # 3. Test the configured ElevenLabs provider and local fallbacks
    print("\n--- 3. Testing ElevenLabs and fallback voice synthesis ---")
    try:
        from audio_briefing import _synthesize_voice_blocking

        out_file = "test_voice_output.mp3"
        if not eleven_key:
            print("[SKIPPED] ELEVENLABS_API_KEY is missing; testing fallbacks directly.")
        else:
            print("[INFO] ElevenLabs API key is configured; it will be tried first.")
        ok, provider = _synthesize_voice_blocking(
            "Audio synthesis is working successfully.", out_file
        )
        if ok:
            size_bytes = os.path.getsize(out_file)
            print(f"[SUCCESS] Voice synthesis provider: {provider}")
            print(f"Saved test file '{out_file}' ({size_bytes} bytes).")
        else:
            print("[FAILED] No fallback voice provider was available.")
    except Exception as e:
        print(f"[FAILED] Voice synthesis error: {e}")

if __name__ == "__main__":
    test_environment_and_apis()