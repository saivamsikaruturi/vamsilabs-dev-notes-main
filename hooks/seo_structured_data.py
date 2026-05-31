"""MkDocs hook: Injects FAQ structured data (JSON-LD) for pages with FAQ sections."""

import re
import json


def on_page_content(html: str, page, config, files) -> str:
    faqs = _extract_faqs(html)
    if not faqs:
        return html

    schema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": q,
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": a,
                },
            }
            for q, a in faqs
        ],
    }

    script_tag = f'<script type="application/ld+json">{json.dumps(schema, ensure_ascii=False)}</script>'
    return html + script_tag


def _extract_faqs(html: str) -> list[tuple[str, str]]:
    pattern = re.compile(
        r'<details[^>]*>\s*<summary[^>]*>(.*?)</summary>\s*(.*?)</details>',
        re.DOTALL,
    )
    faqs = []
    for match in pattern.finditer(html):
        question = re.sub(r'<[^>]+>', '', match.group(1)).strip()
        answer_html = match.group(2).strip()
        answer_text = re.sub(r'<[^>]+>', '', answer_html).strip()
        answer_text = re.sub(r'\s+', ' ', answer_text)
        if question and answer_text:
            faqs.append((question, answer_text[:500]))
    return faqs
