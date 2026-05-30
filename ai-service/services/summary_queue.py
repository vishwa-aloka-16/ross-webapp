import asyncio
import logging
import time
from dataclasses import dataclass
from threading import Lock

from core.config import settings
from providers.gemini_provider import summarize_text

logger = logging.getLogger(__name__)


@dataclass
class SummaryJob:
    prompt: str
    future: asyncio.Future


class SummaryQueue:
    def __init__(self) -> None:
        self.queue: asyncio.Queue[SummaryJob] = asyncio.Queue()
        self.last_run_at = 0.0
        self.lock = Lock()

    async def start(self) -> None:
        return

    async def stop(self) -> None:
        return

    async def enqueue(self, prompt: str) -> str:
        with self.lock:
            elapsed = time.monotonic() - self.last_run_at
            if elapsed < settings.summary_request_interval_seconds:
                await asyncio.sleep(settings.summary_request_interval_seconds - elapsed)

            result = await _with_retry(prompt)
            self.last_run_at = time.monotonic()
            return result


async def _with_retry(prompt: str) -> str:
    delay = settings.summary_request_interval_seconds
    last_error = None

    for attempt in range(1, settings.max_summary_retries + 1):
        try:
            return await summarize_text(prompt)
        except Exception as error:  # noqa: BLE001
            last_error = error
            error_text = str(error).lower()
            is_rate_limit = "429" in error_text or "resource_exhausted" in error_text or "too many requests" in error_text
            if is_rate_limit:
                delay = max(delay, settings.summary_request_interval_seconds * 2)

            logger.warning(
                "summary_retry attempt=%s delay=%ss rate_limit=%s error=%s",
                attempt,
                round(delay, 2),
                is_rate_limit,
                error,
            )
            await asyncio.sleep(delay)
            delay *= 2

    raise last_error or RuntimeError("Summary generation failed.")


summary_queue = SummaryQueue()
