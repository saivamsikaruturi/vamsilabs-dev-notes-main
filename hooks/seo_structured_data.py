"""MkDocs hook: Injects FAQ, Breadcrumb, and Article structured data (JSON-LD)."""

import re
import json
from datetime import datetime


def on_page_content(html: str, page, config, files) -> str:
    schemas = []

    # FAQ Schema
    faqs = _extract_faqs(html)
    if faqs:
        faq_schema = {
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
        schemas.append(faq_schema)

    # Breadcrumb Schema
    breadcrumb_schema = _generate_breadcrumb_schema(page, config)
    if breadcrumb_schema:
        schemas.append(breadcrumb_schema)

    # Article Schema
    article_schema = _generate_article_schema(page, config)
    if article_schema:
        schemas.append(article_schema)

    if not schemas:
        return html

    # Combine all schemas
    script_tags = ''.join([
        f'<script type="application/ld+json">{json.dumps(schema, ensure_ascii=False)}</script>\n'
        for schema in schemas
    ])

    return html + script_tags


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


def _generate_breadcrumb_schema(page, config):
    """Generate BreadcrumbList schema for the page."""
    site_url = config.get('site_url', '').rstrip('/')
    if not site_url or not page.url:
        return None

    # Split URL into parts
    url_parts = page.url.rstrip('/').split('/')
    if not url_parts or url_parts == ['']:
        return None  # Skip for home page

    items = [{
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": site_url + "/"
    }]

    current_url = site_url
    position = 2

    for part in url_parts:
        if not part:
            continue
        current_url += '/' + part
        name = part.replace('-', ' ').replace('_', ' ').title()
        items.append({
            "@type": "ListItem",
            "position": position,
            "name": name,
            "item": current_url + "/"
        })
        position += 1

    # Last item should be the page title if available
    if page.title and len(items) > 1:
        items[-1]["name"] = page.title

    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": items
    }


def _generate_article_schema(page, config):
    """Generate Article schema for content pages."""
    site_url = config.get('site_url', '').rstrip('/')
    if not site_url or not page.url:
        return None

    # Skip for index pages
    if page.url in ['', '/', 'index.html']:
        return None

    meta = page.meta or {}

    schema = {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        "headline": page.title or "VamsiLabs Article",
        "url": site_url + '/' + page.url,
        "author": {
            "@type": "Person",
            "name": "Vamsi Karuturi",
            "jobTitle": "Senior Backend Engineer",
            "worksFor": {
                "@type": "Organization",
                "name": "Salesforce"
            },
            "url": "https://www.linkedin.com/in/vamsi-karuturi-2a117215b/"
        },
        "publisher": {
            "@type": "Organization",
            "name": "VamsiLabs",
            "url": site_url
        },
        "dateModified": datetime.now().strftime("%Y-%m-%d"),
        "inLanguage": "en",
    }

    # Add description if available
    if meta.get('description'):
        schema['description'] = meta['description']

    # Add keywords from common tags
    if 'java' in page.url.lower():
        schema['keywords'] = "Java, FAANG interview, coding interview, backend engineering"
    elif 'spring' in page.url.lower():
        schema['keywords'] = "Spring Boot, Java, microservices, FAANG interview"
    elif 'dsa' in page.url.lower():
        schema['keywords'] = "DSA, algorithms, LeetCode, coding patterns, FAANG interview"
    elif 'system' in page.url.lower():
        schema['keywords'] = "system design, distributed systems, scalability, FAANG interview"

    return schema
