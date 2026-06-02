"""MkDocs hook: Adds estimated reading time to page meta.

Calculates based on average reading speed of 200 words/min for technical content.
The value is available in templates as page.meta.reading_time.
"""

import re


def on_page_markdown(markdown: str, page, config, files) -> str:
    clean = re.sub(r"```.*?```", "", markdown, flags=re.DOTALL)
    clean = re.sub(r"<[^>]+>", "", clean)
    clean = re.sub(r"\|[^\n]+", "", clean)
    clean = re.sub(r"!\[.*?\]\(.*?\)", "", clean)

    words = len(clean.split())
    minutes = max(1, round(words / 200))
    page.meta["reading_time"] = f"{minutes} min read"

    return markdown
