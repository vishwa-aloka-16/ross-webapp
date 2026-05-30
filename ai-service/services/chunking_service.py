import re
from collections import defaultdict


LAYOUT_STRATEGIES = {"ADVERSARIAL", "HIERARCHICAL", "TRANSACTIONAL"}

PARTY_KEYWORDS = {
    "CLAIMANT": ("claimant", "appellant", "petitioner", "applicant"),
    "RESPONDENT": ("respondent", "defendant", "appellee", "opponent"),
    "TRIBUNAL": ("tribunal", "court", "bench", "arbitral", "arbitrator", "judge"),
}

SECTION_HEADING_PATTERNS = (
    (re.compile(r"^(section|article|chapter|part|title)\s+[a-z0-9ivx().-]+[:.\- ]", re.IGNORECASE), 1),
    (re.compile(r"^\d+(?:\.\d+){0,4}\s+[A-Z]", re.IGNORECASE), None),
    (re.compile(r"^[IVXLC]+\.\s+[A-Z]", re.IGNORECASE), 1),
    (re.compile(r"^\([a-z0-9]+\)\s+[A-Z]", re.IGNORECASE), 4),
)


def normalize_layout_strategy(layout_strategy: str | None) -> str:
    strategy = (layout_strategy or "TRANSACTIONAL").upper().strip()
    if strategy not in LAYOUT_STRATEGIES:
        return "TRANSACTIONAL"
    return strategy


def chunk_document(pages: list[dict], layout_strategy: str | None = None) -> list[dict]:
    strategy = normalize_layout_strategy(layout_strategy)

    if strategy == "ADVERSARIAL":
        return _chunk_adversarial(pages)
    if strategy == "HIERARCHICAL":
        return _chunk_hierarchical(pages)
    return _chunk_transactional(pages)


def chunk_pages(pages: list[dict], target_words: int = 400, overlap_words: int = 50) -> list[dict]:
    return _chunk_transactional(pages, target_words=target_words, overlap_words=overlap_words)


def _chunk_transactional(
    pages: list[dict],
    *,
    target_words: int = 400,
    overlap_words: int = 75,
) -> list[dict]:
    chunks: list[dict] = []
    current_words: list[str] = []
    current_page_start = None
    current_page_end = None
    chunk_index = 0

    for page in pages:
        words = page["text"].split()
        if not words:
            continue

        cursor = 0
        while cursor < len(words):
            if current_page_start is None:
                current_page_start = page["page_number"]

            take = min(target_words - len(current_words), len(words) - cursor)
            current_words.extend(words[cursor:cursor + take])
            current_page_end = page["page_number"]
            cursor += take

            if len(current_words) >= target_words:
                chunks.append(
                    _build_chunk(
                        chunk_index=chunk_index,
                        content=" ".join(current_words),
                        page_start=current_page_start,
                        page_end=current_page_end,
                        metadata={
                            "layout_strategy": "TRANSACTIONAL",
                            "window_overlap_words": overlap_words,
                        },
                    )
                )
                chunk_index += 1
                current_words = current_words[-overlap_words:] if overlap_words < len(current_words) else current_words
                current_page_start = current_page_end

    if current_words:
        chunks.append(
            _build_chunk(
                chunk_index=chunk_index,
                content=" ".join(current_words),
                page_start=current_page_start,
                page_end=current_page_end,
                metadata={
                    "layout_strategy": "TRANSACTIONAL",
                    "window_overlap_words": overlap_words,
                },
            )
        )

    return chunks


def _chunk_adversarial(pages: list[dict]) -> list[dict]:
    paragraphs = _extract_paragraphs(pages)
    if not paragraphs:
        return []

    enclaves: list[dict] = []
    active_enclave = "UNKNOWN"

    for paragraph in paragraphs:
        enclave = _detect_party_enclave(paragraph["text"], active_enclave)
        active_enclave = enclave

        if enclaves and enclaves[-1]["party_enclave"] == enclave:
            enclaves[-1]["segments"].append(paragraph)
            enclaves[-1]["page_end"] = paragraph["page_number"]
        else:
            enclaves.append(
                {
                    "party_enclave": enclave,
                    "segments": [paragraph],
                    "page_start": paragraph["page_number"],
                    "page_end": paragraph["page_number"],
                }
            )

    chunk_index = 0
    chunks: list[dict] = []
    for enclave_index, enclave in enumerate(enclaves):
        chunk_payloads = _chunk_text_blocks(
            enclave["segments"],
            target_words=340,
            overlap_words=40,
        )
        for payload in chunk_payloads:
            chunks.append(
                _build_chunk(
                    chunk_index=chunk_index,
                    content=payload["content"],
                    page_start=payload["page_start"],
                    page_end=payload["page_end"],
                    metadata={
                        "layout_strategy": "ADVERSARIAL",
                        "party_enclave": enclave["party_enclave"],
                        "layout_partition": enclave["party_enclave"],
                        "enclave_index": enclave_index,
                    },
                )
            )
            chunk_index += 1

    return chunks


def _chunk_hierarchical(pages: list[dict]) -> list[dict]:
    lines = _extract_lines(pages)
    if not lines:
        return []

    sections: list[dict] = []
    stack: list[dict] = []
    current_section: dict | None = None
    synthetic_counter = defaultdict(int)

    for line in lines:
        text = line["text"]
        heading_level = _detect_heading_level(text)
        if heading_level is not None:
            if current_section and current_section["content_lines"]:
                sections.append(current_section)

            stack = stack[: max(heading_level - 1, 0)]
            heading_key = _build_heading_key(text, heading_level, synthetic_counter)
            stack.append(
                {
                    "key": heading_key,
                    "title": text,
                    "depth": heading_level,
                }
            )
            current_section = {
                "page_start": line["page_number"],
                "page_end": line["page_number"],
                "content_lines": [text],
                "hierarchy": [dict(item) for item in stack],
            }
            continue

        if current_section is None:
            synthetic_counter["preamble"] += 1
            current_section = {
                "page_start": line["page_number"],
                "page_end": line["page_number"],
                "content_lines": [],
                "hierarchy": [
                    {
                        "key": f"preamble-{synthetic_counter['preamble']}",
                        "title": "Preamble",
                        "depth": 1,
                    }
                ],
            }

        current_section["content_lines"].append(text)
        current_section["page_end"] = line["page_number"]

    if current_section and current_section["content_lines"]:
        sections.append(current_section)

    chunks: list[dict] = []
    chunk_index = 0

    for section in sections:
        hierarchy = section["hierarchy"]
        section_payloads = _split_structural_section(section)
        for fragment_index, payload in enumerate(section_payloads):
            chunks.append(
                _build_chunk(
                    chunk_index=chunk_index,
                    content=payload["content"],
                    page_start=payload["page_start"],
                    page_end=payload["page_end"],
                    metadata={
                        "layout_strategy": "HIERARCHICAL",
                        "section_hierarchy": hierarchy,
                        "section_key": hierarchy[-1]["key"],
                        "section_parent_key": hierarchy[-2]["key"] if len(hierarchy) > 1 else None,
                        "structural_depth": len(hierarchy),
                        "section_fragment": fragment_index,
                        "layout_partition": hierarchy[0]["key"],
                    },
                )
            )
            chunk_index += 1

    return chunks


def _extract_paragraphs(pages: list[dict]) -> list[dict]:
    paragraphs: list[dict] = []
    for page in pages:
        raw_text = (page.get("text") or "").replace("\r", "\n")
        blocks = [block.strip() for block in re.split(r"\n\s*\n", raw_text) if block.strip()]
        if not blocks:
            blocks = [line.strip() for line in raw_text.splitlines() if line.strip()]

        for block in blocks:
            paragraphs.append(
                {
                    "text": re.sub(r"\s+", " ", block).strip(),
                    "page_number": page["page_number"],
                }
            )
    return paragraphs


def _extract_lines(pages: list[dict]) -> list[dict]:
    lines: list[dict] = []
    for page in pages:
        for raw_line in (page.get("text") or "").splitlines():
            line = re.sub(r"\s+", " ", raw_line).strip()
            if line:
                lines.append({"text": line, "page_number": page["page_number"]})
    return lines


def _detect_party_enclave(text: str, fallback: str) -> str:
    lowered = text.lower()
    scores = {
        party: sum(lowered.count(keyword) for keyword in keywords)
        for party, keywords in PARTY_KEYWORDS.items()
    }
    best_party = max(scores, key=scores.get)
    if scores[best_party] == 0:
        return fallback
    return best_party


def _chunk_text_blocks(
    blocks: list[dict],
    *,
    target_words: int,
    overlap_words: int,
) -> list[dict]:
    chunks: list[dict] = []
    current_words: list[str] = []
    current_page_start = None
    current_page_end = None

    for block in blocks:
        words = block["text"].split()
        if not words:
            continue

        cursor = 0
        while cursor < len(words):
            if current_page_start is None:
                current_page_start = block["page_number"]

            take = min(target_words - len(current_words), len(words) - cursor)
            current_words.extend(words[cursor:cursor + take])
            current_page_end = block["page_number"]
            cursor += take

            if len(current_words) >= target_words:
                chunks.append(
                    {
                        "content": " ".join(current_words),
                        "page_start": current_page_start,
                        "page_end": current_page_end,
                    }
                )
                current_words = current_words[-overlap_words:] if overlap_words < len(current_words) else current_words
                current_page_start = current_page_end

    if current_words:
        chunks.append(
            {
                "content": " ".join(current_words),
                "page_start": current_page_start,
                "page_end": current_page_end,
            }
        )

    return chunks


def _detect_heading_level(text: str) -> int | None:
    compact = text.strip()
    for pattern, fixed_level in SECTION_HEADING_PATTERNS:
        if not pattern.match(compact):
            continue
        if fixed_level is not None:
            return fixed_level

        numeric_prefix = re.match(r"^(\d+(?:\.\d+){0,4})", compact)
        if numeric_prefix:
            return numeric_prefix.group(1).count(".") + 1

    return None


def _build_heading_key(text: str, level: int, synthetic_counter: defaultdict[str, int]) -> str:
    match = re.match(r"^((?:section|article|chapter|part|title)\s+[a-z0-9ivx().-]+|\d+(?:\.\d+){0,4}|[IVXLC]+\.|\([a-z0-9]+\))", text, re.IGNORECASE)
    if match:
        return re.sub(r"[^a-z0-9]+", "-", match.group(1).lower()).strip("-")

    synthetic_counter[f"level-{level}"] += 1
    return f"level-{level}-{synthetic_counter[f'level-{level}']}"


def _split_structural_section(section: dict) -> list[dict]:
    section_text = "\n".join(section["content_lines"]).strip()
    if not section_text:
        return []

    words = section_text.split()
    if len(words) <= 650:
        return [
            {
                "content": section_text,
                "page_start": section["page_start"],
                "page_end": section["page_end"],
            }
        ]

    blocks = [
        {
            "text": line,
            "page_number": section["page_start"],
        }
        for line in section["content_lines"]
        if line.strip()
    ]
    return _chunk_text_blocks(blocks, target_words=500, overlap_words=0)


def _build_chunk(*, chunk_index: int, content: str, page_start: int | None, page_end: int | None, metadata: dict) -> dict:
    return {
        "content": content.strip(),
        "page_start": page_start,
        "page_end": page_end,
        "chunk_index": chunk_index,
        "metadata": metadata,
    }
