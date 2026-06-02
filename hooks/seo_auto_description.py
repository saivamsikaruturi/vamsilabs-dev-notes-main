"""MkDocs hook: Auto-generates meta descriptions for pages missing them.

Extracts the first meaningful paragraph from page content and sets it as
the meta description. This ensures every page has a unique description
for Google indexing instead of falling back to the generic site description.
"""

import re


def on_page_markdown(markdown: str, page, config, files) -> str:
    if page.meta.get("description"):
        return markdown

    description = _extract_description(markdown)
    if description:
        page.meta["description"] = description

    return markdown


def _extract_description(markdown: str) -> str:
    lines = markdown.split("\n")
    paragraphs = []
    current = []

    skip_next = False
    in_code_block = False
    in_admonition = False
    in_html_block = False

    for line in lines:
        if line.strip().startswith("```"):
            in_code_block = not in_code_block
            continue
        if in_code_block:
            continue

        if line.strip().startswith("!!!") or line.strip().startswith("???"):
            in_admonition = True
            continue
        if in_admonition:
            if line.startswith("    ") or line.strip() == "":
                continue
            else:
                in_admonition = False

        stripped = line.strip()
        if re.match(r"<(div|span|section|script|style|svg|button|input|form|img|a\s)", stripped, re.IGNORECASE):
            in_html_block = True
            continue
        if in_html_block:
            if re.match(r"</(div|span|section|script|style|svg|button|form)>", stripped, re.IGNORECASE):
                in_html_block = False
            continue

        if line.startswith("#"):
            skip_next = False
            continue
        if line.startswith("---"):
            continue
        if line.startswith("|"):
            continue
        if line.startswith("<"):
            continue
        if line.startswith(">"):
            text = line.lstrip("> ").strip()
            if text and len(text) > 30:
                current.append(text)
            continue
        if line.strip() == "":
            if current:
                paragraphs.append(" ".join(current))
                current = []
            continue

        stripped = line.strip()
        if stripped and not stripped.startswith("- ") and not stripped.startswith("* "):
            current.append(stripped)

    if current:
        paragraphs.append(" ".join(current))

    for para in paragraphs:
        clean = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", para)
        clean = re.sub(r"[*_`~]", "", clean)
        clean = re.sub(r"\s+", " ", clean).strip()

        if len(clean) >= 50:
            if len(clean) > 155:
                clean = clean[:152].rsplit(" ", 1)[0] + "..."
            return clean

    return ""
