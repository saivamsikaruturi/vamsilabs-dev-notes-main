"""MkDocs hook: Appends a 'Related Pages' admonition at the bottom of each page.

Uses on_env to build a mapping of file paths to sibling pages within the same
top-level nav section, then on_page_markdown to inject up to 4 related page links.
"""

import os
import random

# Global mapping: file_path -> list of (title, url) siblings in same top-level section
_siblings_map: dict[str, list[tuple[str, str]]] = {}

# Pages to exclude from getting related pages appended
_EXCLUDED_FILES = {"index.md", "about.md", "learning.md"}


def _collect_pages_from_nav_item(item, pages_acc):
    """Recursively collect all (title, file_path) pairs from a nav item."""
    if isinstance(item, dict):
        for title, value in item.items():
            if isinstance(value, str):
                # Leaf page: title -> file_path
                pages_acc.append((title, value))
            elif isinstance(value, list):
                # Section: title -> list of children
                for child in value:
                    _collect_pages_from_nav_item(child, pages_acc)
    elif isinstance(item, str):
        # Plain file path without explicit title
        pages_acc.append((None, item))


def _title_from_path(file_path: str) -> str:
    """Generate a fallback title from a file path."""
    basename = os.path.splitext(os.path.basename(file_path))[0]
    # Convert kebab-case/camelCase to readable title
    title = basename.replace("-", " ").replace("_", " ")
    return title.title()


def on_env(env, config, files):
    """Build the siblings map from the nav configuration."""
    global _siblings_map
    _siblings_map.clear()

    nav = config.get("nav")
    if not nav:
        return env

    # Process each top-level nav section
    for top_item in nav:
        if isinstance(top_item, dict):
            for section_title, section_value in top_item.items():
                # Collect all pages under this top-level section
                pages_in_section: list[tuple[str | None, str]] = []

                if isinstance(section_value, str):
                    # Single page at top level (e.g., Home: index.md)
                    pages_in_section.append((section_title, section_value))
                elif isinstance(section_value, list):
                    for child in section_value:
                        _collect_pages_from_nav_item(child, pages_in_section)

                # Now map each page to its siblings (all other pages in same top-level section)
                for title, file_path in pages_in_section:
                    resolved_title = title if title else _title_from_path(file_path)
                    siblings = []
                    for sib_title, sib_path in pages_in_section:
                        if sib_path == file_path:
                            continue
                        sib_resolved = sib_title if sib_title else _title_from_path(sib_path)
                        siblings.append((sib_resolved, sib_path))
                    _siblings_map[file_path] = siblings
        elif isinstance(top_item, str):
            # Bare file at nav root - no siblings
            pass

    return env


def _path_to_url(file_path: str) -> str:
    """Convert a docs-relative file path to a site URL path."""
    # Remove .md extension and handle index files
    if file_path.endswith("/index.md"):
        url = file_path[: -len("index.md")]
    elif file_path.endswith(".md"):
        url = file_path[:-3] + "/"
    else:
        url = file_path

    # Ensure leading slash
    if not url.startswith("/"):
        url = "/" + url

    return url


def on_page_markdown(markdown: str, page, config, files) -> str:
    """Append related pages admonition to the bottom of each page."""
    src_path = page.file.src_path

    # Skip excluded pages
    basename = os.path.basename(src_path)
    if basename in _EXCLUDED_FILES:
        return markdown

    # Also skip if the src_path itself matches (for top-level files)
    if src_path in _EXCLUDED_FILES:
        return markdown

    # Get siblings for this page
    siblings = _siblings_map.get(src_path, [])
    if not siblings:
        return markdown

    # Prefer pages from the same directory first, then fill from section
    same_dir = []
    other_dir = []
    current_dir = os.path.dirname(src_path)

    for title, path in siblings:
        if os.path.dirname(path) == current_dir:
            same_dir.append((title, path))
        else:
            other_dir.append((title, path))

    # Pick up to 4: prioritize same directory, then fill from other dirs
    selected = []
    random.seed(hash(src_path))  # deterministic per page

    if len(same_dir) <= 4:
        selected = same_dir[:]
    else:
        selected = random.sample(same_dir, 4)

    remaining = 4 - len(selected)
    if remaining > 0 and other_dir:
        if len(other_dir) <= remaining:
            selected.extend(other_dir)
        else:
            selected.extend(random.sample(other_dir, remaining))

    if not selected:
        return markdown

    # Build the admonition
    lines = [
        "",
        "",
        "---",
        "",
        '!!! tip "Related Pages"',
    ]
    for title, path in selected:
        url = _path_to_url(path)
        lines.append(f"    - [{title}]({url})")

    related_section = "\n".join(lines)
    return markdown + related_section + "\n"
