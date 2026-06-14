"""MkDocs hook: Auto-assigns difficulty level (L1/L2/L3) based on page src_path.

Rules:
- If page already has 'difficulty' in frontmatter, respect that value.
- L1: Java Core, Spring Core Fundamentals, Start section pages
- L2: Advanced Java, Spring Data/Web/Security, Microservices Foundations/Communication,
       System Design Fundamentals, Interviews, DevOps, AI & ML, Design Patterns
- L3: JVM Internals, Spring Advanced/Deep Dives, Microservices Advanced/Production,
       System Design Case Studies, System Design Distributed Systems/Infrastructure,
       LLD Problems

The value is available in templates as page.meta.difficulty ('l1', 'l2', or 'l3').
"""

import re

# Patterns mapped to difficulty levels (checked in order; first match wins)
L1_PATTERNS = [
    r"^java/(ecosystem|JavaBasics|StaticAndFinal|oops|OverloadingVsOverriding|"
    r"PassByValue|AccessModifiers|Constructors|thisandSuper|Strings|StringPool|"
    r"StringMethods|WrapperClasses|Enums|Interfaces|innerclasses|CastingAndInstanceof|"
    r"EqualsHashCode|ObjectClassMethods|ImmutableClasses|DesignPrinciples|"
    r"EffectiveJavaPatterns|PackagesAndImports|MarkerInterfaces|VarargsAndHeapPollution|"
    r"BigDecimalPrecision|Regex|TryWithResources)\.md$",
    r"^springboot/(introduction|AutoConfiguration|Annotations|SpringIOC|typesofdi|"
    r"bean-lifecycle|circular-dependencies|custom-starter-bean-processors|aop|"
    r"spring-aop-deep-dive|spel|design-patterns)\.md$",
    r"^(learning|shortcuts|git|interviewquestions|dsa)\.md$",
    r"^behavioral/",
]

L3_PATTERNS = [
    # JVM Internals
    r"^java/(Jvm|ClassLoaders|JavaMemoryModel|GarbageCollection|JVMTuning|"
    r"MemoryLeaks|ProfilingTools|JavaAgents|ReferenceTypes)\.md$",
    # Spring Advanced Features & Deep Dives
    r"^springboot/(profiles|configuration-properties|events|async|actuator|"
    r"observability|testing|slice-testing|SpringBoot3|internals|pitfalls|"
    r"production-tuning)\.md$",
    # Spring Cloud & Ecosystem
    r"^springboot/(spring-cloud|spring-batch|spring-kafka|spring-rabbitmq|"
    r"spring-ai|spring-modulith|docker-kubernetes|testcontainers|"
    r"graalvm-native|openapi-swagger)\.md$",
    # Microservices Advanced Patterns & Production & Operations
    r"^microservices/(advanced-patterns|case-studies|production-operations|"
    r"deployment-strategies|logging-monitoring|Observability|containerization|"
    r"testing-microservices|security-microservices)\.md$",
    # System Design Distributed Systems
    r"^(distributedlocks)\.md$",
    r"^systemdesign/(leader-election|consensus-algorithms|unique-id-generation|"
    r"heartbeat-gossip|message-queues|distributed-transactions|circuit-breakers|"
    r"event-sourcing|batch-stream-processing)\.md$",
    # System Design Infrastructure & Performance
    r"^systemdesign/(database-indexing|connection-pooling|object-storage|"
    r"observability|multi-region)\.md$",
    # System Design Case Studies
    r"^systemdesign/case-studies/",
    # LLD Problems
    r"^lld/(parking-lot|elevator-system|online-book-store|snake-game|"
    r"notification-service|movie-ticket-booking)\.md$",
]

L2_PATTERNS = [
    # Advanced Java (everything under java/ not matched by L1 or L3)
    r"^java/(ExceptionHandling|Collections|HashMapInternals|ComparableComparator|"
    r"DiffCollections|PriorityQueueAndHeap|LinkedHashMapLRU|IteratorAndIterable|"
    r"FailFastFailSafe|EnumSetAndEnumMap|MultiThreading|DaemonThreadsAndLifecycle|"
    r"Executors|Locks|VolatileAtomics|deadlocks|ConcurrentCollections|"
    r"ConcurrentHashMapInternals|ConcurrencyPatterns|ForkJoinFramework|"
    r"ThreadLocalAndSyncAids|BlockingQueueProducerConsumer|JDBC|Serialization|"
    r"Cloning|FileHandling|NIO|Networking|Generics|CovarianceAndPECS|TypeErasure|"
    r"Annotations|Reflection|DynamicProxy|ServiceLoaderSPI)\.md$",
    # Java Functional & Reactive, Version Features, Performance, Security & Build
    r"^java/(FunctionalProgramming|OptionalDeepDive|CollectorsAndParallelStreams|"
    r"CompletableFuture|ReactiveStreams|performance-production|Java8|DateTime|"
    r"java11|Java17|Java21|PatternMatching|VirtualThreads|"
    r"ScopedValuesStructuredConcurrency|ModernJava|StreamGatherers|"
    r"RecordsAndSealedClasses|ModuleSystem|Security|Logging|maven|gradle)\.md$",
    r"^stream-api/",
    # Spring Data & Persistence
    r"^springboot/(spring-data-jpa|specifications-dynamic-queries|n-plus-one-jpa|"
    r"hibernate-internals|hibernate-standalone|transactions|"
    r"multi-datasource-auditing|database-migrations|pagination-sorting|"
    r"caching|spring-data-redis)\.md$",
    # Spring Web & API
    r"^springboot/(mvc-request-lifecycle|filters-interceptors-aop|"
    r"restapibestpractices|cors-content-negotiation|dto-mapping|http-clients|"
    r"exceptionhandling|validation|webflux|spring-graphql|spring-websocket|"
    r"file-upload-download|spring-hateoas)\.md$",
    # Spring Security
    r"^springboot/(security|security-filter-chain|method-security-oauth2)\.md$",
    # Microservices Foundations & Communication
    r"^microservices/(microservices|design-principles|InterServiceCommunication|"
    r"grpc|AsyncCommunicationUsingKafka|event-driven)\.md$",
    # Microservices API Management, Service Infra, Resilience, Data & Patterns
    r"^microservices/(APIGATEWAY|api-gateway-patterns|api-versioning|"
    r"ServiceDiscovery|config-management|service-mesh|CircuitBreaker|"
    r"resilience-patterns|SagaDesignPattern|distributed-transactions|"
    r"data-management|ddd)\.md$",
    r"^CQRS\.md$",
    # System Design Fundamentals
    r"^(capTheorem|consistenthashing)\.md$",
    r"^systemdesign/(data-partitioning|replication|bloom-filters|geohashing|"
    r"estimation-cheatsheet)\.md$",
    # System Design Networking & Communication, Data & Storage, API Design
    r"^(https|loadbalancer|sqlvsnosql|distributedCaching|redis|ratelimiting)\.md$",
    r"^systemdesign/(dns|cdn|proxies|websockets-sse|service-discovery|"
    r"database-sharding|comparisons|grpc)\.md$",
    r"^systemdesign/summaries/",
    r"^apidesign/",
    r"^graphql/",
    # Interviews
    r"^interview/",
    # DevOps
    r"^devops/",
    r"^cicd/",
    # AI & ML
    r"^aiml/",
    # Design Patterns
    r"^designpatterns/",
    # LLD Roadmap & SOLID & Clean Arch
    r"^lld/lld-roadmap\.md$",
    r"^solidprinciples/",
    r"^misc/clean-architecture\.md$",
    # Data section (databases, kafka, security, testing)
    r"^databases/",
    r"^postgresql/",
    r"^kafka-messaging/",
    r"^security/",
    r"^junit/",
    # Networks & OS
    r"^networks/",
    r"^os/",
    # Languages
    r"^(golang|python|kotlin|typescript|rust|ruby)/",
]


def _get_difficulty(src_path: str) -> str:
    """Determine difficulty level from file source path."""
    # Normalize path separators
    path = src_path.replace("\\", "/")

    for pattern in L1_PATTERNS:
        if re.search(pattern, path):
            return "l1"

    for pattern in L3_PATTERNS:
        if re.search(pattern, path):
            return "l3"

    for pattern in L2_PATTERNS:
        if re.search(pattern, path):
            return "l2"

    # Default
    return "l2"


def on_page_markdown(markdown: str, page, config, files) -> str:
    # Respect explicit frontmatter
    if page.meta.get("difficulty"):
        return markdown

    page.meta["difficulty"] = _get_difficulty(page.file.src_path)
    return markdown
