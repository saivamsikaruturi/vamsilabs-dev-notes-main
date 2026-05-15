document.addEventListener("DOMContentLoaded", function () {
  // Reading progress bar
  (function initReadingProgress() {
    var bar = document.createElement("div");
    bar.className = "vtn-reading-progress";
    document.body.appendChild(bar);

    var ticking = false;
    window.addEventListener("scroll", function () {
      if (!ticking) {
        requestAnimationFrame(function () {
          var winHeight = document.documentElement.scrollHeight - window.innerHeight;
          var scrolled = winHeight > 0 ? (window.scrollY / winHeight) * 100 : 0;
          bar.style.width = scrolled + "%";
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  })();

  // Card hover optimization
  var cards = document.querySelectorAll("a.vtn-card");
  cards.forEach(function (card) {
    card.addEventListener("mouseenter", function () {
      this.style.willChange = "transform, box-shadow";
    });
    card.addEventListener("mouseleave", function () {
      this.style.willChange = "auto";
    });
  });

  // AI Chat Widget
  var chatHTML = `
    <button class="vtn-chat-fab" id="vtn-chat-toggle" aria-label="Ask AI Assistant">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.48 2 2 6.48 2 12c0 1.74.46 3.37 1.24 4.78L2 22l5.22-1.24C8.63 21.54 10.26 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm-1 14h-1.5v-1.5H11V16zm2.5 0H12v-1.5h1.5V16zM15 16h-1.5v-1.5H15V16zm-4-3.5c0-.28.22-.5.5-.5h1c.28 0 .5.22.5.5V13h-2v-.5zM12 6c1.93 0 3.5 1.57 3.5 3.5 0 1.12-.53 2.12-1.35 2.76-.4.31-.65.78-.65 1.24h-3c0-.72.37-1.38.95-1.76.56-.37.95-.98.95-1.74 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5z"/>
      </svg>
    </button>
    <div class="vtn-chat-panel" id="vtn-chat-panel">
      <div class="vtn-chat-header">
        <div>
          <h3>AI Study Assistant</h3>
          <span class="vtn-chat-status">● Online</span>
        </div>
      </div>
      <div class="vtn-chat-messages" id="vtn-chat-messages">
        <div class="vtn-chat-msg bot">Hi! I'm your study assistant. Ask me about Java, System Design, Spring Boot, Design Patterns, or any topic covered here. I'll help you understand concepts and point you to the right articles.</div>
      </div>
      <div class="vtn-chat-suggestions" id="vtn-chat-suggestions">
        <span class="vtn-chat-suggestion" data-q="Explain SOLID principles briefly">SOLID principles</span>
        <span class="vtn-chat-suggestion" data-q="What is Circuit Breaker pattern?">Circuit Breaker</span>
        <span class="vtn-chat-suggestion" data-q="Difference between HashMap and ConcurrentHashMap">HashMap vs ConcurrentHashMap</span>
        <span class="vtn-chat-suggestion" data-q="How does Kafka work?">Kafka basics</span>
      </div>
      <div class="vtn-chat-input-area">
        <input type="text" class="vtn-chat-input" id="vtn-chat-input" placeholder="Ask a question..." autocomplete="off">
        <button class="vtn-chat-send" id="vtn-chat-send" aria-label="Send message">Send</button>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", chatHTML);

  var toggle = document.getElementById("vtn-chat-toggle");
  var panel = document.getElementById("vtn-chat-panel");
  var input = document.getElementById("vtn-chat-input");
  var sendBtn = document.getElementById("vtn-chat-send");
  var messages = document.getElementById("vtn-chat-messages");
  var suggestions = document.getElementById("vtn-chat-suggestions");

  toggle.addEventListener("click", function () {
    panel.classList.toggle("active");
    if (panel.classList.contains("active")) {
      input.focus();
    }
  });

  // Knowledge base for quick answers
  var knowledge = {
    "solid": "**SOLID Principles:**\n\n• **S** - Single Responsibility: A class should have one reason to change\n• **O** - Open/Closed: Open for extension, closed for modification\n• **L** - Liskov Substitution: Subtypes must be substitutable for base types\n• **I** - Interface Segregation: Many specific interfaces > one general\n• **D** - Dependency Inversion: Depend on abstractions, not concretions\n\n→ Read more: [SOLID Principles](/solidprinciples/solidprinciples/)",
    "circuit breaker": "**Circuit Breaker Pattern** prevents cascading failures in distributed systems.\n\n3 States:\n• **Closed** — requests flow normally\n• **Open** — requests fail immediately (service is down)\n• **Half-Open** — limited requests to test recovery\n\nUse **Resilience4j** with Spring Boot for implementation.\n\n→ Read more: [Circuit Breaker](/microservices/CircuitBreaker/)",
    "hashmap": "**HashMap vs ConcurrentHashMap:**\n\n• HashMap: Not thread-safe, allows null key/value, O(1) avg lookup\n• ConcurrentHashMap: Thread-safe via segment locking (Java 8+ uses CAS + synchronized), no null keys/values\n\nUse ConcurrentHashMap in multi-threaded code. Use HashMap in single-threaded or synchronized blocks.\n\n→ Read more: [Collections](/java/Collections/)",
    "kafka": "**Apache Kafka** is a distributed event streaming platform.\n\nCore concepts:\n• **Topics** — named feeds of messages\n• **Partitions** — topics split for parallelism\n• **Producers** — publish messages to topics\n• **Consumers** — read messages (in consumer groups)\n• **Brokers** — Kafka servers in a cluster\n\nKafka guarantees ordering within a partition.\n\n→ Read more: [Kafka](/kafka-messaging/kafka/)",
    "spring boot": "**Spring Boot** simplifies Spring development with:\n\n• Auto-configuration (convention over config)\n• Embedded servers (Tomcat, Jetty)\n• Starter dependencies\n• Actuator for monitoring\n• Spring Boot 3 requires Java 17+\n\n→ Read more: [Spring Boot](/springboot/introduction/)",
    "design pattern": "**23 Gang of Four Design Patterns:**\n\n**Creational (5):** Singleton, Factory, Abstract Factory, Builder, Prototype\n**Structural (7):** Adapter, Bridge, Composite, Decorator, Facade, Flyweight, Proxy\n**Behavioral (11):** Chain of Responsibility, Command, Iterator, Mediator, Memento, Observer, State, Strategy, Template Method, Visitor, Interpreter\n\n→ Read more: [Design Patterns](/designpatterns/dp/)",
    "microservices": "**Microservices** — independently deployable services, each owning its data.\n\nKey patterns:\n• API Gateway (single entry point)\n• Service Discovery (Eureka/Consul)\n• Circuit Breaker (fault tolerance)\n• Saga (distributed transactions)\n• CQRS (read/write separation)\n\n→ Read more: [Microservices](/microservices/microservices/)",
    "jvm": "**JVM Architecture:**\n\n• **Class Loader** — loads .class files\n• **Method Area** — class metadata, static vars\n• **Heap** — objects live here (GC manages)\n• **Stack** — per-thread, stores frames\n• **PC Register** — current instruction\n• **Native Method Stack** — native code\n\nGC types: Serial, Parallel, G1, ZGC\n\n→ Read more: [JVM Internals](/java/Jvm/)",
    "docker": "**Docker** containerizes applications for consistency across environments.\n\nKey concepts:\n• **Image** — read-only template\n• **Container** — running instance of image\n• **Dockerfile** — build instructions\n• **docker-compose** — multi-container apps\n• **Volumes** — persistent data\n\n→ Read more: [Docker](/devops/docker/)",
    "kubernetes": "**Kubernetes (K8s)** orchestrates containers at scale.\n\nCore objects:\n• **Pod** — smallest deployable unit\n• **Service** — stable network endpoint\n• **Deployment** — declarative updates\n• **Ingress** — external HTTP routing\n• **ConfigMap/Secret** — configuration\n\n→ Read more: [Kubernetes](/devops/kubernetes/)"
  };

  function findAnswer(question) {
    var q = question.toLowerCase();
    for (var key in knowledge) {
      if (q.includes(key)) {
        return knowledge[key];
      }
    }
    return "I can help with topics like Java, Spring Boot, Microservices, Design Patterns, System Design, Docker, Kubernetes, and more. Try asking about a specific concept!\n\nYou can also use the **Search** (press `/` or `s`) to find articles directly.";
  }

  function addMessage(text, isUser) {
    var msg = document.createElement("div");
    msg.className = "vtn-chat-msg " + (isUser ? "user" : "bot");
    msg.innerHTML = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                        .replace(/\n/g, "<br>")
                        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" style="color: inherit; text-decoration: underline;">$1</a>')
                        .replace(/• /g, "&#8226; ");
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
  }

  function handleSend() {
    var text = input.value.trim();
    if (!text) return;
    addMessage(text, true);
    input.value = "";
    suggestions.style.display = "none";

    sendBtn.disabled = true;
    sendBtn.textContent = "...";

    setTimeout(function () {
      var answer = findAnswer(text);
      addMessage(answer, false);
      sendBtn.disabled = false;
      sendBtn.textContent = "Send";
    }, 400 + Math.random() * 300);
  }

  sendBtn.addEventListener("click", handleSend);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") handleSend();
  });

  // Suggestion clicks
  document.querySelectorAll(".vtn-chat-suggestion").forEach(function (btn) {
    btn.addEventListener("click", function () {
      input.value = this.dataset.q;
      handleSend();
    });
  });
});
