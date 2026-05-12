# ⚙️ Configuration Management

> **Externalize configuration from code — manage secrets, environment-specific settings, and feature flags across distributed services.**

---

!!! abstract "Real-World Analogy"
    Think of a **car rental company**. The same car model (your service JAR) is used across cities, but each city adjusts the GPS language, radio presets, and insurance policies (configuration). You don't build separate cars — you configure the same car differently per location. Spring Cloud Config does this for microservices.

```mermaid
flowchart TD
    CS["⚙️ Config Server<br/>(Git/Vault)"]
    CS -->|/order-service/prod| OS["🛒 Order Service"]
    CS -->|/payment-service/prod| PS["💳 Payment Service"]
    CS -->|/inventory-service/prod| IS["📦 Inventory Service"]
    
    CS -->|"🔄 Refresh"| OS
    CS -->|"🔄 Refresh"| PS
    CS -->|"🔄 Refresh"| IS

    style CS fill:#FEF3C7,stroke:#D97706,stroke-width:2px,color:#000
```

---

## 🏗️ Spring Cloud Config Server

### Server Setup

```java
@SpringBootApplication
@EnableConfigServer
public class ConfigServerApplication { }
```

```yaml
# application.yml for config server
server:
  port: 8888
spring:
  cloud:
    config:
      server:
        git:
          uri: https://github.com/myorg/config-repo
          default-label: main
          search-paths: '{application}'
```

### Config Repository Structure

```
config-repo/
├── application.yml              ← shared defaults (all services)
├── order-service/
│   ├── application.yml          ← order-service defaults
│   ├── application-dev.yml      ← order-service dev
│   └── application-prod.yml     ← order-service prod
├── payment-service/
│   ├── application.yml
│   └── application-prod.yml
```

### Client Setup

```yaml
# bootstrap.yml (or spring.config.import in Boot 3)
spring:
  application:
    name: order-service
  config:
    import: "configserver:http://config-server:8888"
  cloud:
    config:
      fail-fast: true
      retry:
        max-attempts: 5
```

---

## 🔐 Secrets Management

### Approach 1: Spring Cloud Vault

```yaml
spring:
  cloud:
    vault:
      host: vault.internal
      port: 8200
      scheme: https
      authentication: KUBERNETES
      kubernetes:
        role: order-service
        service-account-token-file: /var/run/secrets/kubernetes.io/serviceaccount/token
      kv:
        enabled: true
        backend: secret
        default-context: order-service
```

```java
// Secrets automatically become properties
@Value("${db.password}")
private String dbPassword;  // Fetched from Vault at startup
```

### Approach 2: Kubernetes Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: order-service-secrets
type: Opaque
data:
  DB_PASSWORD: c2VjcmV0MTIz  # base64
  API_KEY: bXlhcGlrZXk=
---
# Mount as environment variables
env:
  - name: DB_PASSWORD
    valueFrom:
      secretKeyRef:
        name: order-service-secrets
        key: DB_PASSWORD
```

### Approach 3: AWS Secrets Manager

```yaml
spring:
  config:
    import: "aws-secretsmanager:/secrets/order-service"
```

---

## 🔄 Dynamic Configuration Refresh

Change config without restarting services:

```java
@RestController
@RefreshScope  // Bean recreated on /actuator/refresh
public class FeatureController {

    @Value("${feature.new-checkout.enabled:false}")
    private boolean newCheckoutEnabled;

    @GetMapping("/api/checkout")
    public String checkout() {
        if (newCheckoutEnabled) {
            return "New checkout flow!";
        }
        return "Classic checkout";
    }
}
```

```bash
# Trigger refresh (single instance)
curl -X POST http://order-service:8080/actuator/refresh

# Or use Spring Cloud Bus (refreshes ALL instances)
curl -X POST http://config-server:8888/actuator/busrefresh
```

```mermaid
flowchart LR
    Git["📝 Git Push<br/>(config change)"] --> CS["Config Server"]
    CS -->|webhook| Bus["🚌 Spring Cloud Bus<br/>(RabbitMQ/Kafka)"]
    Bus --> S1["Service Instance 1<br/>@RefreshScope beans recreated"]
    Bus --> S2["Service Instance 2"]
    Bus --> S3["Service Instance 3"]

    style Bus fill:#EDE9FE,stroke:#7C3AED,stroke-width:2px,color:#000
```

---

## 🏷️ Configuration Priority (Highest → Lowest)

```mermaid
flowchart TD
    P1["1. Command-line args<br/>--server.port=9090"] 
    P2["2. System environment<br/>SERVER_PORT=9090"]
    P3["3. Config Server (profile-specific)<br/>application-prod.yml"]
    P4["4. Config Server (default)<br/>application.yml"]
    P5["5. Local application-{profile}.yml"]
    P6["6. Local application.yml"]
    P7["7. @PropertySource"]
    P8["8. Default properties"]

    P1 --> P2 --> P3 --> P4 --> P5 --> P6 --> P7 --> P8

    style P1 fill:#E8F5E9,stroke:#2E7D32,color:#000
    style P8 fill:#FFCDD2,stroke:#C62828,color:#000
```

---

## 🎯 Interview Questions

??? question "1. How do you manage configuration across 50+ microservices?"
    Use a **centralized config server** (Spring Cloud Config) backed by Git. Each service pulls its config on startup. Shared properties go in a global file, service-specific ones in their own directory. Secrets go in Vault/AWS Secrets Manager, not Git.

??? question "2. How do you change configuration without restarting?"
    Use `@RefreshScope` on beans that read dynamic properties. Trigger via `/actuator/refresh` endpoint. For multi-instance refresh, use **Spring Cloud Bus** (broadcasts refresh events to all instances via Kafka/RabbitMQ).

??? question "3. Where should secrets be stored?"
    Never in Git or property files. Use: **HashiCorp Vault** (full-featured secret management), **Kubernetes Secrets** (simple K8s deployments), **AWS Secrets Manager** / **GCP Secret Manager** (cloud-native). Spring Cloud integrates with all of these.

??? question "4. What is the property resolution order?"
    Command-line args > Environment variables > Config server profile-specific > Config server default > Local profile-specific > Local application.yml > Defaults. Higher priority overrides lower. This lets you override any property per environment.

??? question "5. How do you handle feature flags?"
    Store flags in config (`feature.x.enabled=true/false`). Use `@RefreshScope` for real-time toggling. For advanced use (percentage rollouts, A/B tests, user targeting), use dedicated tools like LaunchDarkly, Unleash, or GrowthBook.

