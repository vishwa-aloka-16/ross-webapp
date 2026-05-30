from app import create_app
from core.config import settings

app = create_app()


if __name__ == "__main__":
    app.run(host=settings.ai_service_host, port=settings.ai_service_port, debug=False)
