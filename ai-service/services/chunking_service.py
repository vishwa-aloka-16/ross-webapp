import re
from collections import defaultdict

from services.pdf_extraction_service import extract_page_lines, extract_page_paragraphs


LAYOUT_STRATEGIES = {"ADVERSARIAL", "HIERARCHICAL", "TRANSACTIONAL"}

PARTY_KEYWORDS = {
    "CLAIMANT": ("claimant", "appellant", "petitioner", "applicant"),
    "RESPONDENT": ("respondent", "defendant", "appellee", "opponent"),
    "TRIBUNAL": ("tribunal", "court", "bench", "arbitral", "arbitrator", "judge"),
}

PARTY_LEAD_PATTERNS = {
    "CLAIMANT": re.compile(r"^\s*(?:for\s+the\s+)?(?:claimant|appellant|petitioner|applicant)\b", re.IGNORECASE),
    "RESPONDENT": re.compile(r"^\s*(?:for\s+the\s+)?(?:respondent|defendant|appellee|opponent)\b", re.IGNORECASE),
    "TRIBUNAL": re.compile(r"^\s*(?:before\s+the\s+)?(?:tribunal|court|bench|arbitral\s+tribunal|arbitrator|judge)\b", re.IGNORECASE),
}

SECTION_HEADING_PATTERNS = (
    (re.compile(r"^(section|article|chapter|part|title)\s+[a-z0-9ivx().-]+[:.\- ]", re.IGNORECASE), 1),
    (re.compile(r"^\d+(?:\.\d+){0,4}\s+[A-Za-z0-9$]", re.UNICODE), None),
    (re.compile(r"^[IVXLC]+\.\s+[A-Z]"), 1),
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
    current_words: list[tuple[str, int]] = []
    chunk_index = 0

    for page in pages:
        page_number = page["page_number"]
        words = [(word, page_number) for word in page["text"].split()]
        if not words:
            continue

        cursor = 0
        while cursor < len(words):
            take = min(target_words - len(current_words), len(words) - cursor)
            current_words.extend(words[cursor:cursor + take])
            cursor += take

            if len(current_words) >= target_words:
                page_numbers = [word_page for _, word_page in current_words]
                chunks.append(
                    _build_chunk(
                        chunk_index=chunk_index,
                        content=" ".join(word for word, _ in current_words),
                        page_start=min(page_numbers),
                        page_end=max(page_numbers),
                        metadata={
                            "layout_strategy": "TRANSACTIONAL",
                            "window_overlap_words": overlap_words,
                        },
                    )
                )
                chunk_index += 1
                current_words = current_words[-overlap_words:] if overlap_words < len(current_words) else current_words

    if current_words:
        page_numbers = [word_page for _, word_page in current_words]
        chunks.append(
            _build_chunk(
                chunk_index=chunk_index,
                content=" ".join(word for word, _ in current_words),
                page_start=min(page_numbers),
                page_end=max(page_numbers),
                metadata={
                    "layout_strategy": "TRANSACTIONAL",
                    "window_overlap_words": overlap_words,
                },
            )
        )

    return chunks


def _chunk_adversarial(pages: list[dict]) -> list[dict]:
    paragraphs = extract_page_paragraphs(pages)
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
    lines = extract_page_lines(pages)
    if not lines:
        return []

    sections: list[dict] = []
    stack: list[dict] = []
    current_section: dict | None = None
    synthetic_counter = defaultdict(int)

    for line in lines:
        text = line["text"]
        heading_level = _detect_heading_level_from_line(line)
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
                "content_blocks": [{"text": text, "page_number": line["page_number"]}],
                "hierarchy": [dict(item) for item in stack],
            }
            continue

        if current_section is None:
            synthetic_counter["preamble"] += 1
            current_section = {
                "page_start": line["page_number"],
                "page_end": line["page_number"],
                "content_lines": [],
                "content_blocks": [],
                "hierarchy": [
                    {
                        "key": f"preamble-{synthetic_counter['preamble']}",
                        "title": "Preamble",
                        "depth": 1,
                    }
                ],
            }

        current_section["content_lines"].append(text)
        current_section["content_blocks"].append({"text": text, "page_number": line["page_number"]})
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


def _detect_party_enclave(text: str, fallback: str) -> str:
    lowered = text.lower()
    scores: dict[str, int] = {}

    for party, keywords in PARTY_KEYWORDS.items():
        # Count unique keyword hits rather than raw frequency so quoted references
        # do not overpower the actual speaker/entity for the paragraph.
        unique_hits = sum(1 for keyword in keywords if re.search(rf"\b{re.escape(keyword)}\b", lowered))
        lead_bonus = 3 if PARTY_LEAD_PATTERNS[party].search(text) else 0
        scores[party] = unique_hits + lead_bonus

    best_score = max(scores.values(), default=0)
    if best_score == 0:
        return "NEUTRAL"

    leaders = [party for party, score in scores.items() if score == best_score]
    if len(leaders) == 1:
        return leaders[0]

    return fallback if fallback in leaders and fallback not in {"UNKNOWN", "NEUTRAL"} else "NEUTRAL"


def _chunk_text_blocks(
    blocks: list[dict],
    *,
    target_words: int,
    overlap_words: int,
) -> list[dict]:
    chunks: list[dict] = []
    current_words: list[tuple[str, int]] = []

    for block in blocks:
        page_number = block["page_number"]
        words = [(word, page_number) for word in block["text"].split()]
        if not words:
            continue

        cursor = 0
        while cursor < len(words):
            take = min(target_words - len(current_words), len(words) - cursor)
            current_words.extend(words[cursor:cursor + take])
            cursor += take

            if len(current_words) >= target_words:
                page_numbers = [word_page for _, word_page in current_words]
                chunks.append(
                    {
                        "content": " ".join(word for word, _ in current_words),
                        "page_start": min(page_numbers),
                        "page_end": max(page_numbers),
                    }
                )
                current_words = current_words[-overlap_words:] if overlap_words < len(current_words) else current_words

    if current_words:
        page_numbers = [word_page for _, word_page in current_words]
        chunks.append(
            {
                "content": " ".join(word for word, _ in current_words),
                "page_start": min(page_numbers),
                "page_end": max(page_numbers),
            }
        )

    return chunks


def _detect_heading_level(text: str) -> int | None:
    return _detect_heading_level_from_line({"text": text})


def _detect_heading_level_from_line(line: dict) -> int | None:
    if line.get("component") == "SECTION_HEADER" and line.get("section_level") is not None:
        return int(line["section_level"])
    if line.get("component") == "TITLE":
        return 1

    text = line["text"]
    compact = _normalize_heading_candidate(text)
    for pattern, fixed_level in SECTION_HEADING_PATTERNS:
        if not pattern.match(compact):
            continue
        if not _looks_like_structural_heading(compact):
            continue
        if fixed_level is not None:
            return fixed_level

        numeric_prefix = re.match(r"^(\d+(?:\.\d+){0,4})", compact)
        if numeric_prefix:
            return numeric_prefix.group(1).count(".") + 1

    return None


def _normalize_heading_candidate(text: str) -> str:
    compact = re.sub(r"\s+", " ", text).strip()
    # Common OCR substitutions in headings: 0 -> O and $ -> S when embedded in tokens.
    compact = re.sub(r"\b0(?=[A-Za-z])", "O", compact)
    compact = compact.replace("$", "S")
    return compact


def _looks_like_structural_heading(text: str) -> bool:
    body = re.sub(
        r"^(?:section|article|chapter|part|title)\s+[a-z0-9ivx().-]+[:.\- ]\s*|^\d+(?:\.\d+){0,4}\s+|^[IVXLC]+\.\s+|^\([a-z0-9]+\)\s+",
        "",
        text,
        flags=re.IGNORECASE,
    ).strip()
    if not body:
        return False

    words = re.findall(r"[A-Za-z][A-Za-z0-9/&()'$.:-]*", body)
    if not words or len(words) > 18:
        return False

    uppercase_initial_ratio = sum(1 for word in words if word[0].isupper()) / len(words)
    has_terminal_punctuation = body.endswith((".", "?", "!"))
    has_verb_like_pattern = bool(re.search(r"\b(is|are|was|were|shall|must|may|should)\b", body, re.IGNORECASE))

    if body.isupper():
        return True
    if uppercase_initial_ratio >= 0.5:
        return True
    if not has_terminal_punctuation and not has_verb_like_pattern and len(words) <= 10:
        return True
    return False


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
            "text": block["text"],
            "page_number": block["page_number"],
        }
        for block in section.get("content_blocks", [])
        if block["text"].strip()
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
