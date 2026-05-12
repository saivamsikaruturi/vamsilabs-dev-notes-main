---
hide:
  - navigation
  - toc
---

<div class="vtn-hero" markdown>

<span class="vtn-tag">FAANG Interview Prep</span>

# Crack the System Design & Java Interview.

<p class="vtn-subtitle">Deep-dive notes from an engineer at a top tech company. Not generic theory — real patterns, tradeoffs, and code used in production at scale.</p>

<p class="vtn-author">by <strong>Vamsi Karuturi</strong> · Senior Software Engineer</p>

<div class="vtn-stats">
  <div class="vtn-stat">
    <span class="vtn-stat-number">150+</span>
    <span class="vtn-stat-label">In-Depth Articles</span>
  </div>
  <div class="vtn-stat">
    <span class="vtn-stat-number">300+</span>
    <span class="vtn-stat-label">Interview Questions</span>
  </div>
  <div class="vtn-stat">
    <span class="vtn-stat-number">48</span>
    <span class="vtn-stat-label">Spring & Microservices</span>
  </div>
</div>

<div class="vtn-hero-actions">
  <a class="vtn-cta" href="learning/">Start Learning Path →</a>
  <a class="vtn-cta vtn-cta-secondary" href="interviewquestions/">Interview Questions</a>
</div>

<!-- Inline Auth Prompt (hidden when logged in) -->
<div class="vtn-hero-auth" id="auth-section">
  <button class="vtn-hero-signin" onclick="signInWithGoogle()">
    <svg viewBox="0 0 24 24" width="16" height="16"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
    Sign in to track progress
  </button>
</div>

</div>

<!-- What's New Banner -->
<div class="vtn-whats-new" markdown>
<span class="vtn-whats-new-badge">NEW</span>
<span class="vtn-whats-new-text">Just added: <a href="springboot/aop/">Spring AOP</a> · <a href="springboot/webflux/">WebFlux</a> · <a href="microservices/grpc/">gRPC</a> · <a href="microservices/resilience-patterns/">Resilience Patterns</a> · <a href="microservices/api-versioning/">API Versioning</a> + 6 more topics</span>
</div>

<!-- Learning Paths -->
<div class="vtn-section-title">Pick Your Path</div>

<div class="vtn-paths">
<div class="vtn-path-card" data-path="faang-prep">
<div class="vtn-path-icon">🎯</div>
<div class="vtn-path-content">
<h3>FAANG Interview Prep</h3>
<p>Java → Spring Boot → System Design → Behavioral. 4-6 weeks.</p>
<div class="vtn-path-steps">
<a href="java/oops/">OOP</a> → <a href="java/Collections/">Collections</a> → <a href="springboot/introduction/">Spring Boot</a> → <a href="microservices/microservices/">Microservices</a> → <a href="designpatterns/dp/">Design Patterns</a>
</div>
<div class="vtn-path-progress" style="display:none;">
<div class="vtn-path-progress-bar"><div class="vtn-path-progress-fill"></div></div>
<span class="vtn-path-progress-label"></span>
</div>
</div>
</div>
<div class="vtn-path-card" data-path="spring-boot-mastery">
<div class="vtn-path-icon">🚀</div>
<div class="vtn-path-content">
<h3>Spring Boot Mastery</h3>
<p>Zero to production-ready. IoC, JPA, Security, Testing, Actuator.</p>
<div class="vtn-path-steps">
<a href="springboot/SpringIOC/">IoC & DI</a> → <a href="springboot/spring-data-jpa/">JPA</a> → <a href="springboot/transactions/">Transactions</a> → <a href="springboot/security/">Security</a> → <a href="springboot/testing/">Testing</a>
</div>
<div class="vtn-path-progress" style="display:none;">
<div class="vtn-path-progress-bar"><div class="vtn-path-progress-fill"></div></div>
<span class="vtn-path-progress-label"></span>
</div>
</div>
</div>
<div class="vtn-path-card" data-path="microservices-architect">
<div class="vtn-path-icon">🏗️</div>
<div class="vtn-path-content">
<h3>Microservices Architect</h3>
<p>Design, build, deploy, and observe distributed systems.</p>
<div class="vtn-path-steps">
<a href="microservices/design-principles/">Design</a> → <a href="microservices/InterServiceCommunication/">Comm.</a> → <a href="microservices/resilience-patterns/">Resilience</a> → <a href="microservices/deployment-strategies/">Deploy</a> → <a href="microservices/logging-monitoring/">Observe</a>
</div>
<div class="vtn-path-progress" style="display:none;">
<div class="vtn-path-progress-bar"><div class="vtn-path-progress-fill"></div></div>
<span class="vtn-path-progress-label"></span>
</div>
</div>
</div>
</div>

<!-- Core Engineering -->
<div class="vtn-section-title">Core Engineering</div>

<div class="vtn-grid" markdown>

<a class="vtn-card" href="java/ecosystem/">
  <span class="vtn-card-icon">:fontawesome-brands-java:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">Java Deep Dive</span><span class="vtn-card-desc">JVM, Collections, Concurrency, Streams, Java 17+</span></span>
</a>

<a class="vtn-card" href="springboot/introduction/">
  <span class="vtn-card-icon">:material-leaf:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">Spring Boot <span class="vtn-badge vtn-badge-hot">23 Topics</span></span><span class="vtn-card-desc">IoC, AOP, JPA, Security, WebFlux, Testing, Actuator</span></span>
</a>

<a class="vtn-card" href="microservices/microservices/">
  <span class="vtn-card-icon">:material-hub:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">Microservices <span class="vtn-badge vtn-badge-hot">25 Topics</span></span><span class="vtn-card-desc">Saga, CQRS, gRPC, Service Mesh, Resilience, Observability</span></span>
</a>

<a class="vtn-card" href="designpatterns/dp/">
  <span class="vtn-card-icon">:material-puzzle:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">Design Patterns</span><span class="vtn-card-desc">All 23 GoF — Creational, Structural, Behavioral</span></span>
</a>

<a class="vtn-card" href="lld/lld-roadmap/">
  <span class="vtn-card-icon">:material-map-marker-path:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">LLD Roadmap <span class="vtn-badge vtn-badge-hot">HOT</span></span><span class="vtn-card-desc">Complete roadmap, resources, 35+ interview Qs</span></span>
</a>

<a class="vtn-card" href="solidprinciples/solidprinciples/">
  <span class="vtn-card-icon">:material-shield-check:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">SOLID Principles</span><span class="vtn-card-desc">SRP, OCP, LSP, ISP, DIP with real examples</span></span>
</a>

</div>

<!-- Featured Deep Dives -->
<div class="vtn-section-title">Featured Deep Dives</div>

<div class="vtn-featured" markdown>

<a class="vtn-featured-card" href="springboot/transactions/">
  <span class="vtn-featured-tag">Spring Boot</span>
  <span class="vtn-featured-title">@Transactional Deep Dive</span>
  <span class="vtn-featured-desc">Propagation, isolation, self-invocation trap, readOnly optimization — everything for your interview.</span>
</a>

<a class="vtn-featured-card" href="microservices/resilience-patterns/">
  <span class="vtn-featured-tag">Microservices</span>
  <span class="vtn-featured-title">Resilience Patterns</span>
  <span class="vtn-featured-desc">Retry, Circuit Breaker, Bulkhead, Rate Limiter — with Resilience4j code and Istio comparison.</span>
</a>

<a class="vtn-featured-card" href="springboot/aop/">
  <span class="vtn-featured-tag">Spring Boot</span>
  <span class="vtn-featured-title">AOP & Custom Annotations</span>
  <span class="vtn-featured-desc">Build @LogExecutionTime, @RateLimit — understand proxy-based weaving and its pitfalls.</span>
</a>

<a class="vtn-featured-card" href="microservices/distributed-transactions/">
  <span class="vtn-featured-tag">Microservices</span>
  <span class="vtn-featured-title">Distributed Transactions</span>
  <span class="vtn-featured-desc">Saga choreography vs orchestration, Outbox Pattern, idempotency — with full code.</span>
</a>

</div>

<!-- System Design -->
<div class="vtn-section-title">System Design</div>

<div class="vtn-grid" markdown>

<a class="vtn-card" href="https/">
  <span class="vtn-card-icon">:material-sitemap:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">System Design Fundamentals</span><span class="vtn-card-desc">HTTPS, CAP Theorem, Rate Limiting, Caching</span></span>
</a>

<a class="vtn-card" href="apidesign/apidesign/">
  <span class="vtn-card-icon">:material-api:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">API Design</span><span class="vtn-card-desc">REST best practices, pagination, HATEOAS</span></span>
</a>

<a class="vtn-card" href="loadbalancer/">
  <span class="vtn-card-icon">:material-scale-balance:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">Load Balancing</span><span class="vtn-card-desc">Algorithms, L4 vs L7, health checks</span></span>
</a>

<a class="vtn-card" href="redis/">
  <span class="vtn-card-icon">:material-flash:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">Redis</span><span class="vtn-card-desc">Caching, pub/sub, data structures</span></span>
</a>

<a class="vtn-card" href="distributedCaching/">
  <span class="vtn-card-icon">:material-cached:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">Distributed Caching</span><span class="vtn-card-desc">Strategies, consistency, eviction policies</span></span>
</a>

<a class="vtn-card" href="sqlvsnosql/">
  <span class="vtn-card-icon">:material-database-search:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">SQL vs NoSQL</span><span class="vtn-card-desc">When to pick what and trade-offs</span></span>
</a>

</div>

<!-- Data & DevOps -->
<div class="vtn-section-title">Data & Messaging</div>

<div class="vtn-grid" markdown>

<a class="vtn-card" href="databases/sql/">
  <span class="vtn-card-icon">:material-database:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">SQL</span><span class="vtn-card-desc">Queries, joins, indexes, optimization</span></span>
</a>

<a class="vtn-card" href="postgresql/postgresql/">
  <span class="vtn-card-icon">:material-elephant:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">PostgreSQL</span><span class="vtn-card-desc">Replication, sharding, tuning</span></span>
</a>

<a class="vtn-card" href="kafka-messaging/kafka/">
  <span class="vtn-card-icon">:material-message-fast:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">Kafka</span><span class="vtn-card-desc">Topics, partitions, consumer groups, exactly-once</span></span>
</a>

<a class="vtn-card" href="graphql/graphql/">
  <span class="vtn-card-icon">:material-graphql:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">GraphQL</span><span class="vtn-card-desc">Queries, mutations, subscriptions, SDL</span></span>
</a>

</div>

<div class="vtn-section-title">DevOps & Cloud</div>

<div class="vtn-grid" markdown>

<a class="vtn-card" href="devops/docker/">
  <span class="vtn-card-icon">:fontawesome-brands-docker:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">Docker</span><span class="vtn-card-desc">Containers, Compose, multi-stage builds</span></span>
</a>

<a class="vtn-card" href="devops/kubernetes/">
  <span class="vtn-card-icon">:material-kubernetes:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">Kubernetes</span><span class="vtn-card-desc">Pods, services, deployments, Helm</span></span>
</a>

<a class="vtn-card" href="devops/aws/">
  <span class="vtn-card-icon">:fontawesome-brands-aws:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">AWS</span><span class="vtn-card-desc">EC2, S3, Lambda, ECS, CloudFormation</span></span>
</a>

<a class="vtn-card" href="cicd/cicd/">
  <span class="vtn-card-icon">:material-infinity:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">CI/CD Pipelines</span><span class="vtn-card-desc">Jenkins, GitHub Actions, deploy strategies</span></span>
</a>

<a class="vtn-card" href="devops/linux/">
  <span class="vtn-card-icon">:fontawesome-brands-linux:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">Linux</span><span class="vtn-card-desc">Commands, shell scripting, permissions</span></span>
</a>

<a class="vtn-card" href="devops/ansible/">
  <span class="vtn-card-icon">:material-cog-transfer:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">Ansible</span><span class="vtn-card-desc">Playbooks, roles, automation</span></span>
</a>

</div>

<!-- Languages -->
<div class="vtn-section-title">Languages</div>

<div class="vtn-grid" markdown>

<a class="vtn-card" href="golang/introduction/">
  <span class="vtn-card-icon">:fontawesome-brands-golang:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">Go</span><span class="vtn-card-desc">Goroutines, channels, interfaces</span></span>
</a>

<a class="vtn-card" href="python/introduction/">
  <span class="vtn-card-icon">:fontawesome-brands-python:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">Python</span><span class="vtn-card-desc">Fundamentals, data structures, scripting</span></span>
</a>

<a class="vtn-card" href="typescript/introduction/">
  <span class="vtn-card-icon">:material-language-typescript:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">TypeScript</span><span class="vtn-card-desc">Types, generics, decorators</span></span>
</a>

<a class="vtn-card" href="rust/introduction/">
  <span class="vtn-card-icon">:fontawesome-brands-rust:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">Rust</span><span class="vtn-card-desc">Ownership, borrowing, zero-cost abstractions</span></span>
</a>

<a class="vtn-card" href="kotlin/introduction/">
  <span class="vtn-card-icon">:material-language-kotlin:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">Kotlin</span><span class="vtn-card-desc">Null safety, coroutines, JVM</span></span>
</a>

<a class="vtn-card" href="ruby/introduction/">
  <span class="vtn-card-icon">:material-diamond-stone:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">Ruby</span><span class="vtn-card-desc">Dynamic typing, Rails, metaprogramming</span></span>
</a>

</div>

<!-- More -->
<div class="vtn-section-title">More</div>

<div class="vtn-grid" markdown>

<a class="vtn-card" href="aiml/aiml/">
  <span class="vtn-card-icon">:material-robot:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">AI & ML</span><span class="vtn-card-desc">LLMs, RAG, transformers, MLOps</span></span>
</a>

<a class="vtn-card" href="security/Oauth/">
  <span class="vtn-card-icon">:material-shield-lock:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">Security</span><span class="vtn-card-desc">OAuth 2.0, JWT, auth patterns</span></span>
</a>

<a class="vtn-card" href="junit/junit/">
  <span class="vtn-card-icon">:material-test-tube:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">Testing</span><span class="vtn-card-desc">JUnit 5, TDD, mocking, integration</span></span>
</a>

<a class="vtn-card" href="behavioral/behavioral/">
  <span class="vtn-card-icon">:material-account-voice:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">Behavioral — Amazon LPs <span class="vtn-badge vtn-badge-hot">HOT</span></span><span class="vtn-card-desc">14 Leadership Principles with STAR answers</span></span>
</a>

<a class="vtn-card" href="interviewquestions/">
  <span class="vtn-card-icon">:material-chat-question:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">Interview Prep</span><span class="vtn-card-desc">Common questions & answers by topic</span></span>
</a>

<a class="vtn-card" href="misc/clean-architecture/">
  <span class="vtn-card-icon">:material-layers-outline:</span>
  <span class="vtn-card-body"><span class="vtn-card-title">Clean Architecture</span><span class="vtn-card-desc">Layers, boundaries, dependency rule</span></span>
</a>

</div>

<!-- Tech Stack -->
<div class="vtn-tech-stack">
  <div class="vtn-tech-label">Topics covered for interviews at</div>
  <div class="vtn-tech-logos">
    <span>Google</span>
    <span>Amazon</span>
    <span>Meta</span>
    <span>Microsoft</span>
    <span>Apple</span>
    <span>Netflix</span>
    <span>Uber</span>
    <span>Stripe</span>
  </div>
</div>


<!-- User Profile (shown when logged in, hidden by default) -->
<div class="vtn-user-profile" id="user-profile" style="display:none;"></div>
