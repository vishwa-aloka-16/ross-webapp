from io import BytesIO

from pypdf import PdfReader


def extract_pdf_pages(pdf_bytes: bytes) -> list[dict]:
    reader = PdfReader(stream=BytesIO(pdf_bytes))
    pages = []

    for index, page in enumerate(reader.pages, start=1):
        pages.append({
            "page_number": index,
            "text": (page.extract_text() or "").strip(),
        })

    return pages
