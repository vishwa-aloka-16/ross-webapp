import asyncio
import logging
from functools import lru_cache
from typing import Sequence

from google import genai
from google.genai import types

from core.config import settings
from services.gemini_cache_service import load_cached, save_cached

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_gemini_client():
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured.")

    try:
        return genai.Client(api_key=settings.gemini_api_key)
    except Exception as error:  # noqa: BLE001
        raise RuntimeError(
            "Failed to initialize Gemini client. Check GEMINI_API_KEY and Gemini model access."
        ) from error


async def embed_texts(texts: Sequence[str], *, task_type: str) -> list[list[float]]:
    cache_payload = {
        "model": settings.embedding_model_name,
        "task_type": task_type,
        "output_dimensionality": settings.embedding_output_dimensions,
        "texts": list(texts),
    }
    cached = load_cached("embeddings", cache_payload)
    if cached is not None:
        logger.info("gemini_cache_hit type=embeddings items=%s", len(texts))
        return cached

    def _embed():
        client = get_gemini_client()
        response = client.models.embed_content(
            model=settings.embedding_model_name,
            contents=list(texts),
            config=types.EmbedContentConfig(
                task_type=task_type,
                output_dimensionality=settings.embedding_output_dimensions,
            ),
        )
        return [list(item.values) for item in response.embeddings]

    embeddings = await asyncio.to_thread(_embed)
    save_cached("embeddings", cache_payload, embeddings)
    return embeddings


async def summarize_text(prompt: str) -> str:
    cache_payload = {
        "model": settings.summarization_model_name,
        "prompt": prompt,
    }
    cached = load_cached("summaries", cache_payload)
    if cached is not None:
        logger.info("gemini_cache_hit type=summary")
        return cached

    def _generate():
        client = get_gemini_client()
        response = client.models.generate_content(
            model=settings.summarization_model_name,
            contents=prompt,
        )
        return response.text or ""

    summary = await asyncio.to_thread(_generate)
    save_cached("summaries", cache_payload, summary)
    return summary


async def answer_question(prompt: str) -> str:
    cache_payload = {
        "model": settings.answer_model_name,
        "prompt": prompt,
    }
    cached = load_cached("answers", cache_payload)
    if cached is not None:
        logger.info("gemini_cache_hit type=answer")
        return cached

    def _generate():
        client = get_gemini_client()
        response = client.models.generate_content(
            model=settings.answer_model_name,
            contents=prompt,
        )
        return response.text or ""

    answer = await asyncio.to_thread(_generate)
    save_cached("answers", cache_payload, answer)
    return answer
