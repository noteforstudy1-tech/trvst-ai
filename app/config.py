import os
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent

def load_env_file():
    try:
        env_file = BASE_DIR / ".env"
        if env_file.exists():
            with open(env_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, val = line.split("=", 1)
                        key = key.strip()
                        val = val.strip().strip('"').strip("'")
                        if key and key not in os.environ:
                            os.environ[key] = val
    except Exception as e:
        print(f"[Config] Error loading .env: {e}")

load_env_file()

is_serverless = bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"))
default_data_dir = Path("/tmp/trvst_data") if is_serverless else (BASE_DIR / "app" / "data")

class Settings(BaseModel):
    app_name: str = os.getenv("APP_NAME", "TRVST AI")
    app_env: str = os.getenv("APP_ENV", "development")
    host: str = os.getenv("HOST", "127.0.0.1")
    port: int = int(os.getenv("PORT", "8000"))
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    data_dir: Path = default_data_dir

    def update_gemini_key(self, new_key: str):
        self.gemini_api_key = new_key.strip()
        os.environ["GEMINI_API_KEY"] = self.gemini_api_key
        try:
            env_file = BASE_DIR / ".env"
            lines = []
            key_found = False
            if env_file.exists():
                with open(env_file, "r", encoding="utf-8") as f:
                    for line in f:
                        if line.strip().startswith("GEMINI_API_KEY="):
                            lines.append(f'GEMINI_API_KEY="{self.gemini_api_key}"\n')
                            key_found = True
                        else:
                            lines.append(line)
            if not key_found:
                lines.append(f'GEMINI_API_KEY="{self.gemini_api_key}"\n')
            with open(env_file, "w", encoding="utf-8") as f:
                f.writelines(lines)
        except Exception as e:
            print(f"[Settings] Filesystem read-only or error: {e}")

settings = Settings()
try:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
except Exception:
    pass
