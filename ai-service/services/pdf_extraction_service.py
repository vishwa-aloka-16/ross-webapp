import logging
import re
from collections import Counter
from io import BytesIO
from statistics import median

try:
    import pdfplumber
except ImportError:  # pragma: no cover - dependency is required at runtime
    pdfplumber = None

logger = logging.getLogger(__name__)


BODY_LABELS = {"SECTION_HEADER", "PARAGRAPH", "LIST_ITEM", "TABLE", "TEXT"}
PARAGRAPH_LABELS = BODY_LABELS
FURNITURE_LABELS = {"PAGE_HEADER", "PAGE_FOOTER"}

NUMBERED_HEADING_PATTERN = re.compile(r"^\d+(?:\.\d+){0,4}(?:[.)])?\s+\S+")
SECTION_HEADING_PATTERN = re.compile(
    r"^(section|article|chapter|part|title)\s+[a-z0-9ivx().-]+[:.\- ]",
    re.IGNORECASE,
)
ROMAN_HEADING_PATTERN = re.compile(r"^[IVXLC]+\.\s+\S+")
PAREN_HEADING_PATTERN = re.compile(r"^\([a-z0-9ivxlc]+\)\s+\S+", re.IGNORECASE)
LIST_MARKER_PATTERN = re.compile(
    r"^\s*(?:[-*•]|(?:\d+|[a-zA-Z]|[ivxlcdmIVXLCDM]+)[.)]|\([a-zA-Z0-9ivxlcdmIVXLCDM]+\))\s+"
)


def extract_pdf_pages(pdf_bytes: bytes) -> list[dict]:
    structured_pages = extract_pdf_structure(pdf_bytes)
    return [
        {
            "page_number": page["page_number"],
            "text": page["text"],
            "items": page["items"],
            "component_counts": page["component_counts"],
            "size": page.get("size"),
        }
        for page in structured_pages
    ]


def extract_pdf_structure(pdf_bytes: bytes) -> list[dict]:
    if pdfplumber is None:
        raise RuntimeError("pdfplumber is not installed. Add `pdfplumber` before ingesting PDFs.")

    with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
        page_payloads = [_extract_raw_page(page, index) for index, page in enumerate(pdf.pages, start=1)]

    text_word_count = sum(len(line["text"].split()) for payload in page_payloads for line in payload["lines"])
    if text_word_count < 10:
        raise RuntimeError("No readable text layer was found in this PDF. OCR is not supported yet.")

    furniture_keys = _detect_repeated_furniture(page_payloads)
    structured_pages = [_build_structured_page(payload, furniture_keys) for payload in page_payloads]
    structured_pages = [page for page in structured_pages if page["text"] or page["items"]]

    if not structured_pages:
        raise RuntimeError("No readable body text was found after PDF extraction.")

    logger.info(
        "pdf_extracted pages=%s empty_pages=%s tables=%s furniture_keys=%s",
        len(structured_pages),
        sum(1 for page in structured_pages if not page["text"]),
        sum((page.get("component_counts") or {}).get("TABLE", 0) for page in structured_pages),
        len(furniture_keys),
    )
    return structured_pages


def normalize_extracted_text(raw_text: str) -> str:
    normalized = raw_text.replace("\r\n", "\n").replace("\r", "\n")
    return re.sub(r"(\w+)-\n(\w+)", r"\1\2", normalized)


def extract_page_paragraphs(pages: list[dict]) -> list[dict]:
    paragraphs: list[dict] = []

    for page in pages:
        structured_items = page.get("items") or []
        if structured_items:
            for item in structured_items:
                if item.get("label") not in PARAGRAPH_LABELS:
                    continue
                text = re.sub(r"\s+", " ", normalize_extracted_text(item.get("text") or "")).strip()
                if not text:
                    continue
                paragraphs.append(
                    {
                        "text": text,
                        "page_number": page["page_number"],
                        "component": item.get("label"),
                        "section_level": item.get("section_level"),
                        "reading_order": item.get("reading_order"),
                        "bbox": item.get("bbox"),
                    }
                )
            continue

        raw_text = normalize_extracted_text(page.get("text") or "")
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


def extract_page_lines(pages: list[dict]) -> list[dict]:
    lines: list[dict] = []

    for page in pages:
        structured_items = page.get("items") or []
        if structured_items:
            for item in structured_items:
                if item.get("label") not in PARAGRAPH_LABELS:
                    continue
                for raw_line in normalize_extracted_text(item.get("text") or "").splitlines():
                    line = re.sub(r"\s+", " ", raw_line).strip()
                    if not line:
                        continue
                    lines.append(
                        {
                            "text": line,
                            "page_number": page["page_number"],
                            "component": item.get("label"),
                            "section_level": item.get("section_level"),
                            "reading_order": item.get("reading_order"),
                            "bbox": item.get("bbox"),
                        }
                    )
            continue

        for raw_line in normalize_extracted_text(page.get("text") or "").splitlines():
            line = re.sub(r"\s+", " ", raw_line).strip()
            if line:
                lines.append({"text": line, "page_number": page["page_number"]})

    return lines


def _extract_raw_page(page, page_number: int) -> dict:
    words = page.extract_words(
        x_tolerance=2,
        y_tolerance=3,
        keep_blank_chars=False,
        use_text_flow=False,
    )
    lines = _group_words_into_lines(words, page.chars, page_number)
    tables = _extract_tables(page, page_number)

    return {
        "page_number": page_number,
        "width": float(page.width or 0),
        "height": float(page.height or 0),
        "lines": lines,
        "tables": tables,
    }


def _group_words_into_lines(words: list[dict], chars: list[dict], page_number: int) -> list[dict]:
    if not words:
        return []

    sorted_words = sorted(words, key=lambda word: (float(word.get("top", 0)), float(word.get("x0", 0))))
    grouped: list[list[dict]] = []

    for word in sorted_words:
        if not grouped:
            grouped.append([word])
            continue

        current = grouped[-1]
        current_top = median(float(item.get("top", 0)) for item in current)
        if abs(float(word.get("top", 0)) - current_top) <= 3:
            current.append(word)
        else:
            grouped.append([word])

    lines: list[dict] = []
    previous_bottom = None
    for group in grouped:
        group = sorted(group, key=lambda word: float(word.get("x0", 0)))
        text = _clean_inline_text(" ".join(word.get("text", "") for word in group))
        if not text:
            continue

        x0 = min(float(word.get("x0", 0)) for word in group)
        x1 = max(float(word.get("x1", 0)) for word in group)
        top = min(float(word.get("top", 0)) for word in group)
        bottom = max(float(word.get("bottom", 0)) for word in group)
        font_size, is_bold = _line_font_features(chars, x0, top, x1, bottom)
        gap_before = None if previous_bottom is None else max(0.0, top - previous_bottom)
        previous_bottom = bottom

        lines.append(
            {
                "text": text,
                "page_number": page_number,
                "x0": x0,
                "x1": x1,
                "top": top,
                "bottom": bottom,
                "bbox": _bbox(x0, top, x1, bottom),
                "font_size": font_size,
                "bold": is_bold,
                "gap_before": gap_before,
            }
        )

    return lines


def _line_font_features(chars: list[dict], x0: float, top: float, x1: float, bottom: float) -> tuple[float | None, bool]:
    matching_chars = [
        char
        for char in chars
        if _overlaps(
            (x0, top, x1, bottom),
            (
                float(char.get("x0", 0)),
                float(char.get("top", 0)),
                float(char.get("x1", 0)),
                float(char.get("bottom", 0)),
            ),
        )
    ]
    if not matching_chars:
        return None, False

    sizes = [float(char.get("size", 0)) for char in matching_chars if char.get("size") is not None]
    font_names = " ".join(str(char.get("fontname", "")) for char in matching_chars).lower()
    is_bold = any(token in font_names for token in ("bold", "black", "heavy", "semibold", "demi"))
    return (median(sizes) if sizes else None), is_bold


def _extract_tables(page, page_number: int) -> list[dict]:
    tables: list[dict] = []

    try:
        found_tables = page.find_tables()
    except Exception:  # noqa: BLE001
        logger.debug("pdfplumber table detection failed on page %s", page_number, exc_info=True)
        found_tables = []

    for table_index, table in enumerate(found_tables):
        rows = table.extract() or []
        rendered_text = _render_table_rows(rows)
        if not rendered_text:
            continue

        x0, top, x1, bottom = (float(value) for value in table.bbox)
        tables.append(
            {
                "label": "TABLE",
                "text": rendered_text,
                "page_number": page_number,
                "bbox": _bbox(x0, top, x1, bottom),
                "x0": x0,
                "x1": x1,
                "top": top,
                "bottom": bottom,
                "table_cells": _table_cells_from_rows(rows),
                "table_index": table_index,
            }
        )

    return tables


def _render_table_rows(rows: list[list[str | None]]) -> str:
    rendered_rows = []
    for row in rows:
        cells = [_clean_inline_text(cell or "") for cell in row or []]
        if any(cells):
            rendered_rows.append(" | ".join(cells))
    return "\n".join(rendered_rows).strip()


def _table_cells_from_rows(rows: list[list[str | None]]) -> list[dict]:
    cells: list[dict] = []
    for row_index, row in enumerate(rows):
        for col_index, cell in enumerate(row or []):
            text = _clean_inline_text(cell or "")
            if not text:
                continue
            cells.append(
                {
                    "text": text,
                    "row_start": row_index,
                    "row_end": row_index + 1,
                    "col_start": col_index,
                    "col_end": col_index + 1,
                    "row_span": 1,
                    "col_span": 1,
                    "bbox": None,
                }
            )
    return cells


def _detect_repeated_furniture(page_payloads: list[dict]) -> set[str]:
    if len(page_payloads) < 2:
        return set()

    counts: Counter[str] = Counter()
    for payload in page_payloads:
        seen_on_page = set()
        for line in payload["lines"]:
            if _line_zone(line, payload["height"]) not in FURNITURE_LABELS:
                continue
            key = _furniture_key(line["text"])
            if key:
                seen_on_page.add(key)
        counts.update(seen_on_page)

    threshold = max(2, round(len(page_payloads) * 0.45))
    return {key for key, count in counts.items() if count >= threshold}


def _build_structured_page(payload: dict, furniture_keys: set[str]) -> dict:
    page_number = payload["page_number"]
    height = payload["height"]
    tables = payload["tables"]
    line_gaps = [line["gap_before"] for line in payload["lines"] if line.get("gap_before") is not None]
    paragraph_gap = max(8.0, (median(line_gaps) * 1.8) if line_gaps else 10.0)
    page_font_sizes = [line["font_size"] for line in payload["lines"] if line.get("font_size")]
    body_font_size = median(page_font_sizes) if page_font_sizes else None

    events: list[dict] = []
    for table in tables:
        events.append({"kind": "table", "top": table["top"], "payload": table})

    for line in payload["lines"]:
        if any(_line_inside_table(line, table) for table in tables):
            continue
        events.append({"kind": "line", "top": line["top"], "payload": line})

    events.sort(key=lambda event: (event["top"], event["payload"].get("x0", 0)))

    items: list[dict] = []
    paragraph_lines: list[dict] = []
    reading_order = 0

    for event in events:
        if event["kind"] == "table":
            reading_order = _flush_paragraph(items, paragraph_lines, page_number, reading_order)
            paragraph_lines = []
            table = event["payload"]
            items.append(_item_from_table(table, reading_order))
            reading_order += 1
            continue

        line = event["payload"]
        furniture_label = _classify_furniture(line, height, furniture_keys)
        if furniture_label:
            reading_order = _flush_paragraph(items, paragraph_lines, page_number, reading_order)
            paragraph_lines = []
            items.append(_item_from_line(line, furniture_label, reading_order))
            reading_order += 1
            continue

        heading_level = _detect_heading_level(line, body_font_size)
        if heading_level is not None:
            reading_order = _flush_paragraph(items, paragraph_lines, page_number, reading_order)
            paragraph_lines = []
            items.append(_item_from_line(line, "SECTION_HEADER", reading_order, section_level=heading_level))
            reading_order += 1
            continue

        if _looks_like_list_item(line["text"]):
            reading_order = _flush_paragraph(items, paragraph_lines, page_number, reading_order)
            paragraph_lines = []
            items.append(_item_from_line(line, "LIST_ITEM", reading_order))
            reading_order += 1
            continue

        if paragraph_lines and _starts_new_paragraph(paragraph_lines[-1], line, paragraph_gap):
            reading_order = _flush_paragraph(items, paragraph_lines, page_number, reading_order)
            paragraph_lines = []

        paragraph_lines.append(line)

    _flush_paragraph(items, paragraph_lines, page_number, reading_order)
    items.sort(key=lambda item: item["reading_order"])

    body_texts = [item["text"] for item in items if item["label"] in BODY_LABELS and item["text"]]
    return {
        "page_number": page_number,
        "text": "\n\n".join(body_texts).strip(),
        "items": items,
        "component_counts": dict(Counter(item["label"] for item in items)),
        "size": {"width": payload["width"], "height": payload["height"]},
    }


def _flush_paragraph(items: list[dict], paragraph_lines: list[dict], page_number: int, reading_order: int) -> int:
    if not paragraph_lines:
        return reading_order

    text = _join_lines(paragraph_lines)
    if not text:
        return reading_order

    items.append(
        {
            "label": "PARAGRAPH",
            "text": text,
            "page_number": page_number,
            "reading_order": reading_order,
            "bbox": _merge_bboxes(line["bbox"] for line in paragraph_lines),
            "section_level": None,
            "table_cells": [],
        }
    )
    return reading_order + 1


def _item_from_line(line: dict, label: str, reading_order: int, section_level: int | None = None) -> dict:
    return {
        "label": label,
        "text": line["text"],
        "page_number": line["page_number"],
        "reading_order": reading_order,
        "bbox": line["bbox"],
        "section_level": section_level,
        "table_cells": [],
    }


def _item_from_table(table: dict, reading_order: int) -> dict:
    return {
        "label": "TABLE",
        "text": table["text"],
        "page_number": table["page_number"],
        "reading_order": reading_order,
        "bbox": table["bbox"],
        "section_level": None,
        "table_cells": table["table_cells"],
    }


def _detect_heading_level(line: dict, body_font_size: float | None) -> int | None:
    text = line["text"].strip()
    if not text or len(text.split()) > 22:
        return None

    score = 0
    structural_level = _heading_level_from_marker(text)
    if structural_level is not None:
        score += 3

    words = re.findall(r"[A-Za-z][A-Za-z0-9/&()'$.:-]*", text)
    uppercase_ratio = _uppercase_ratio(words)
    title_ratio = _titlecase_ratio(words)
    if text.isupper() and len(words) >= 2:
        score += 2
    elif uppercase_ratio >= 0.45 or title_ratio >= 0.65:
        score += 1

    if line.get("bold"):
        score += 1
    if body_font_size and line.get("font_size") and line["font_size"] >= body_font_size + 1:
        score += 1
    if line.get("gap_before") is not None and line["gap_before"] >= 8:
        score += 1
    if not text.endswith((".", "?", "!")):
        score += 1
    if re.search(r"\b(is|are|was|were|shall|must|may|should|will|can)\b", text, re.IGNORECASE):
        score -= 1

    if structural_level is not None and score >= 3:
        return structural_level
    if score >= 5:
        return 1
    return None


def _heading_level_from_marker(text: str) -> int | None:
    compact = re.sub(r"\s+", " ", text).strip()
    if SECTION_HEADING_PATTERN.match(compact) or ROMAN_HEADING_PATTERN.match(compact):
        return 1

    numeric = re.match(r"^(\d+(?:\.\d+){0,4})(?:[.)])?\s+", compact)
    if numeric:
        return numeric.group(1).count(".") + 1

    if PAREN_HEADING_PATTERN.match(compact):
        return 4

    if NUMBERED_HEADING_PATTERN.match(compact):
        return 1
    return None


def _looks_like_list_item(text: str) -> bool:
    return bool(LIST_MARKER_PATTERN.match(text))


def _starts_new_paragraph(previous: dict, current: dict, paragraph_gap: float) -> bool:
    gap = current.get("gap_before")
    if gap is not None and gap >= paragraph_gap:
        return True

    indent_shift = abs(float(current.get("x0", 0)) - float(previous.get("x0", 0)))
    if indent_shift >= 24 and gap is not None and gap >= 3:
        return True

    previous_text = previous.get("text", "")
    if previous_text.endswith((".", ":", ";")) and gap is not None and gap >= paragraph_gap * 0.7:
        return True

    return False


def _classify_furniture(line: dict, page_height: float, furniture_keys: set[str]) -> str | None:
    zone = _line_zone(line, page_height)
    if zone not in FURNITURE_LABELS:
        return None

    key = _furniture_key(line["text"])
    if key in furniture_keys or _looks_like_page_number(line["text"]):
        return zone
    return None


def _line_zone(line: dict, page_height: float) -> str | None:
    if not page_height:
        return None
    if float(line["top"]) <= page_height * 0.10:
        return "PAGE_HEADER"
    if float(line["bottom"]) >= page_height * 0.90:
        return "PAGE_FOOTER"
    return None


def _furniture_key(text: str) -> str:
    normalized = re.sub(r"\b\d+\b", "#", text.lower())
    return re.sub(r"[^a-z0-9#]+", " ", normalized).strip()


def _looks_like_page_number(text: str) -> bool:
    return bool(re.match(r"^\s*(?:page\s*)?\d+(?:\s+of\s+\d+)?\s*$", text, re.IGNORECASE))


def _line_inside_table(line: dict, table: dict) -> bool:
    line_box = (line["x0"], line["top"], line["x1"], line["bottom"])
    table_box = (table["x0"], table["top"], table["x1"], table["bottom"])
    if not _overlaps(line_box, table_box):
        return False

    overlap_top = max(line_box[1], table_box[1])
    overlap_bottom = min(line_box[3], table_box[3])
    line_height = max(1.0, line_box[3] - line_box[1])
    return (overlap_bottom - overlap_top) / line_height >= 0.55


def _overlaps(first: tuple[float, float, float, float], second: tuple[float, float, float, float]) -> bool:
    return not (first[2] < second[0] or second[2] < first[0] or first[3] < second[1] or second[3] < first[1])


def _join_lines(lines: list[dict]) -> str:
    text = "\n".join(line["text"] for line in lines)
    text = normalize_extracted_text(text)
    return re.sub(r"[ \t]+", " ", text.replace("\n", " ")).strip()


def _clean_inline_text(text: str) -> str:
    return re.sub(r"\s+", " ", normalize_extracted_text(str(text))).strip()


def _uppercase_ratio(words: list[str]) -> float:
    if not words:
        return 0.0
    return sum(1 for word in words if word.isupper() and len(word) > 1) / len(words)


def _titlecase_ratio(words: list[str]) -> float:
    if not words:
        return 0.0
    return sum(1 for word in words if word[:1].isupper()) / len(words)


def _bbox(left: float, top: float, right: float, bottom: float) -> dict:
    return {
        "left": left,
        "top": top,
        "right": right,
        "bottom": bottom,
        "coord_origin": "top-left",
    }


def _merge_bboxes(bboxes) -> dict | None:
    boxes = [bbox for bbox in bboxes if bbox]
    if not boxes:
        return None
    return _bbox(
        min(box["left"] for box in boxes),
        min(box["top"] for box in boxes),
        max(box["right"] for box in boxes),
        max(box["bottom"] for box in boxes),
    )
