#!/usr/bin/env python3
"""OCR question PDFs that have little extractable text (forms 7-10)."""
from __future__ import annotations

import json
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import fitz

SRC = Path("/Users/oliver/Desktop/TestingUI/1 Internal Medicine Example forms")
OUT = Path("/tmp/exam_parse/forms")
OCR = Path("/Users/oliver/Downloads/TestingUIProject/resources/ocr-helper")
FORMS = ["7 Q.pdf", "8 Q.pdf", "9 Q.pdf", "10 Q.pdf", "7A.pdf", "8A.pdf", "9A.pdf", "10A.pdf"]


def ocr_page(png_path: str) -> str:
    result = subprocess.run([str(OCR), png_path], capture_output=True, text=True)
    if result.returncode != 0:
        return ""
    return result.stdout


def extract_pdf(pdf: Path) -> list[dict]:
    doc = fitz.open(pdf)
    pages: list[dict] = [{} for _ in range(doc.page_count)]

    def work(index: int) -> tuple[int, str]:
        page = doc[index]
        native = page.get_text("text") or ""
        letters = sum(ch.isalpha() for ch in native)
        if letters >= 80:
            return index, native
        pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
        with tempfile.NamedTemporaryFile(suffix=".png", delete=True) as tmp:
            pix.save(tmp.name)
            text = ocr_page(tmp.name)
        return index, text or native

    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = [pool.submit(work, i) for i in range(doc.page_count)]
        done = 0
        for future in as_completed(futures):
            index, text = future.result()
            pages[index] = {"pageNumber": index + 1, "text": text, "usedOcr": True}
            done += 1
            if done % 10 == 0 or done == doc.page_count:
                print(f"  {pdf.name}: {done}/{doc.page_count}", flush=True)
    doc.close()
    return pages


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    if not OCR.exists():
        raise SystemExit(f"missing OCR helper at {OCR}")
    for name in FORMS:
        pdf = SRC / name
        if not pdf.exists():
            print(f"skip missing {name}")
            continue
        print(f"OCR {name}", flush=True)
        pages = extract_pdf(pdf)
        key = "a" if name.endswith("A.pdf") or name.endswith("A.PDF") else "q"
        stem = pdf.stem
        (OUT / f"{stem}.json").write_text(json.dumps({key: pages}, ensure_ascii=False))
        letters = sum(sum(ch.isalpha() for ch in p["text"]) for p in pages)
        print(f"  saved {len(pages)} pages, letters={letters}", flush=True)


if __name__ == "__main__":
    main()
