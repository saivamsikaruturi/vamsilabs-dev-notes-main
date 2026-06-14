"""MkDocs hook: Adds company tags to pages based on frontmatter or auto-detection.

If page.meta.companies is set in frontmatter, those are used directly.
Otherwise, auto-assigns companies based on page path and content patterns.
"""

import re

# Auto-assignment rules based on path patterns
PATH_COMPANY_MAP = [
    # Java core topics
    (r"java/(core|collections|multithreading|concurrency|jvm|streams|memory|garbage)",
     ["Google", "Amazon", "Microsoft"]),
    # System Design
    (r"(system-design|hld|high-level-design)",
     ["Google", "Meta", "Amazon", "Netflix"]),
    # Spring Boot
    (r"(spring-boot|spring)",
     ["Amazon", "Walmart", "Goldman Sachs"]),
    # Microservices
    (r"(microservices|micro-services)",
     ["Amazon", "Netflix", "Uber"]),
    # Low-Level Design
    (r"(lld|low-level-design|design-patterns)",
     ["Google", "Amazon", "Flipkart"]),
    # Kafka / messaging
    (r"(kafka|messaging|event-driven)",
     ["LinkedIn", "Uber", "Netflix"]),
    # Docker / Kubernetes / DevOps
    (r"(docker|kubernetes|k8s|devops|ci-cd)",
     ["Google", "Amazon", "Microsoft"]),
    # Database / SQL
    (r"(database|sql|nosql|redis|mongodb)",
     ["Amazon", "Google", "Oracle"]),
    # DSA / Algorithms
    (r"(dsa|algorithms|data-structures|leetcode)",
     ["Google", "Meta", "Amazon", "Microsoft"]),
]

# Content-based patterns (checked if path rules don't match)
CONTENT_COMPANY_MAP = [
    (r"HashMap|ConcurrentHashMap|TreeMap|LinkedHashMap",
     ["Google", "Amazon", "Microsoft"]),
    (r"thread pool|ExecutorService|CompletableFuture|synchronized",
     ["Google", "Amazon", "Goldman Sachs"]),
    (r"circuit.?breaker|retry|resilience|bulkhead",
     ["Netflix", "Amazon", "Uber"]),
    (r"load.?balancer|consistent.?hashing|sharding",
     ["Google", "Meta", "Amazon"]),
    (r"REST\s?API|GraphQL|gRPC",
     ["Google", "Meta", "Amazon"]),
]


def on_page_markdown(markdown: str, page, config, files) -> str:
    """Assign company tags to page meta if not already set."""
    # If companies already defined in frontmatter, use those
    if page.meta.get("companies"):
        return markdown

    # Try path-based matching
    page_path = page.file.src_path.lower().replace("\\", "/")

    for pattern, companies in PATH_COMPANY_MAP:
        if re.search(pattern, page_path):
            page.meta["companies"] = companies
            return markdown

    # Try content-based matching
    for pattern, companies in CONTENT_COMPANY_MAP:
        if re.search(pattern, markdown, re.IGNORECASE):
            page.meta["companies"] = companies
            return markdown

    return markdown
