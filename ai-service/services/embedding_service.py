import math

from core.config import settings
from providers.gemini_provider import embed_texts


def estimate_tokens(text: str) -> int:
    return max(1, math.ceil(len(text.split()) * 1.33))


async def batch_embed_texts(texts: list[str], *, task_type: str) -> list[list[float]]:
    results: list[list[float]] = []
    batch: list[str] = []
    batch_tokens = 0
    max_tokens = 7000

    async def flush() -> None:
        nonlocal batch, batch_tokens, results
        if not batch:
            return
        results.extend(await _embed_with_retry(batch, task_type))
        batch = []
        batch_tokens = 0

    for text in texts:
        text_tokens = estimate_tokens(text)
        if batch and (
            len(batch) >= settings.embedding_batch_size or batch_tokens + text_tokens > max_tokens
        ):
            await flush()

        batch.append(text)
        batch_tokens += text_tokens

    await flush()
    return results


async def _embed_with_retry(texts: list[str], task_type: str) -> list[list[float]]:
    delay = 1.0
    last_error = None
    pending = texts

    for _ in range(settings.max_embedding_retries):
        try:
            return await embed_texts(pending, task_type=task_type)
        except Exception as error:  # noqa: BLE001
            last_error = error
            if len(pending) > 1:
                midpoint = max(1, len(pending) // 2)
                left = await _embed_with_retry(pending[:midpoint], task_type)
                right = await _embed_with_retry(pending[midpoint:], task_type)
                return left + right
            delay *= 2

    raise last_error or RuntimeError("Embedding failed.")
