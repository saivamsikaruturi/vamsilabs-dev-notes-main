"""MkDocs hook: ELI5 (Explain Like I'm 5) Mode support.

Scans pages for !!! eli5 admonitions. If none exist, injects a hidden placeholder
div that can be populated manually later. The ELI5 content is hidden by default
and revealed when the user activates ELI5 mode via the floating toggle button.
"""

import re


def on_page_markdown(markdown: str, page, config, files) -> str:
    # Skip homepage and about page
    src_path = page.file.src_path
    if src_path in ("index.md", "about.md"):
        return markdown

    # Check if page already has an eli5 admonition
    has_eli5 = bool(re.search(r'^!!! eli5', markdown, re.MULTILINE))

    if has_eli5:
        # Page already has manual ELI5 content — no injection needed
        return markdown

    # Auto-inject a hidden placeholder after the first heading
    # This gives authors a template to fill in later
    title = page.title or "this topic"
    placeholder = (
        '\n\n<div class="eli5-simple" style="display:none;">\n\n'
        f'**In simple terms:** This page explains {title} in a way that\'s '
        'easy to understand. Toggle ELI5 mode to see simplified explanations.\n\n'
        '</div>\n\n'
    )

    # Insert after the first H1 heading line
    h1_match = re.search(r'^# .+$', markdown, re.MULTILINE)
    if h1_match:
        insert_pos = h1_match.end()
        markdown = markdown[:insert_pos] + placeholder + markdown[insert_pos:]

    return markdown
