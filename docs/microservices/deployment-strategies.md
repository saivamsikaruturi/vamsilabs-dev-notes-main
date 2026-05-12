# 🚀 Deployment Strategies

> **Deploy microservices to production with zero downtime — blue-green, canary, rolling updates, and feature flags.**

---

!!! abstract "Real-World Analogy"
    Think of **renovating a restaurant while it's open**. You can't close for weeks. **Blue-Green**: build a duplicate restaurant next door, switch customers over when ready. **Canary**: seat 5% of customers in the renovated section, check reviews, then move everyone. **Rolling**: renovate one table at a time while others keep serving.

```mermaid
flowchart LR
    subgraph Strategies["Deployment Strategies"]
        RU["🔄 Rolling Update<br/>Replace pods one by one"]
        BG["🔵🟢 Blue-Green<br/>Switch all traffic at once"]
        CN["🐤 Canary<br/>Gradual traffic shift"]
        FF["🏁 Feature Flags<br/>Deploy dark, enable later"]
    end

    style RU fill:#E3F2FD,stroke:#1565C0,color:#000
    style BG fill:#E8F5E9,stroke:#2E7D32,color:#000
    style CN fill:#FEF3C7,stroke:#D97706,color:#000
    style FF fill:#F3E5F5,stroke:#6A1B9A,color:#000
```

---

## 🔄 Rolling Update (Default in Kubernetes)

Replace old pods with new ones gradually:

```mermaid
flowchart TD
    subgraph T1["Time 1: Start"]
        A1["v1 ✅"] 
        A2["v1 ✅"]
        A3["v1 ✅"]
    end
    
    subgraph T2["Time 2: Updating"]
        B1["v2 ✅"]
        B2["v1 ✅"]
        B3["v1 ✅"]
    end
    
    subgraph T3["Time 3: Complete"]
        C1["v2 ✅"]
        C2["v2 ✅"]
        C3["v2 ✅"]
    end

    T1 --> T2 --> T3

    style A1 fill:#E3F2FD,stroke:#1565C0,color:#000
    style B1 fill:#E8F5E9,stroke:#2E7D32,color:#000
    style C1 fill:#E8F5E9,stroke:#2E7D32,color:#000
    style C2 fill:#E8F5E9,stroke:#2E7D32,color:#000
    style C3 fill:#E8F5E9,stroke:#2E7D32,color:#000
```

```yaml
# Kubernetes deployment with rolling update
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # At most 1 extra pod during update
      maxUnavailable: 0  # Always maintain full capacity
```

| Pros | Cons |
|---|---|
| Simple, built-in to K8s | Both versions run simultaneously (briefly) |
| Zero downtime | Rollback is another rolling update (slow) |
| No extra infrastructure | Hard to test with real traffic first |

---

## 🔵🟢 Blue-Green Deployment

Run two identical environments. Switch traffic instantly:

```mermaid
flowchart TD
    LB["⚖️ Load Balancer"]
    
    subgraph Blue["🔵 Blue (v1 - LIVE)"]
        B1["Pod 1 v1"]
        B2["Pod 2 v1"]
        B3["Pod 3 v1"]
    end
    
    subgraph Green["🟢 Green (v2 - STAGING)"]
        G1["Pod 1 v2"]
        G2["Pod 2 v2"]
        G3["Pod 3 v2"]
    end

    LB -->|"100% traffic"| Blue
    LB -.->|"switch!"| Green

    style Blue fill:#E3F2FD,stroke:#1565C0,stroke-width:2px,color:#000
    style Green fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px,color:#000
```

```yaml
# Switch by updating the service selector
apiVersion: v1
kind: Service
metadata:
  name: order-service
spec:
  selector:
    app: order-service
    version: green   # Change from "blue" to "green" to switch
  ports:
    - port: 80
      targetPort: 8080
```

| Pros | Cons |
|---|---|
| Instant rollback (switch back) | Double infrastructure cost |
| Test green before switching | Database migrations need care |
| Zero downtime | Both environments must be maintained |

---

## 🐤 Canary Deployment

Gradually shift traffic to the new version:

```mermaid
flowchart TD
    LB["⚖️ Load Balancer / Istio"]
    
    subgraph Stable["Stable (v1)"]
        S1["Pod 1"]
        S2["Pod 2"]
        S3["Pod 3"]
    end
    
    subgraph Canary["Canary (v2)"]
        C1["Pod 1"]
    end

    LB -->|"95% traffic"| Stable
    LB -->|"5% traffic"| Canary

    style Stable fill:#E3F2FD,stroke:#1565C0,color:#000
    style Canary fill:#FEF3C7,stroke:#D97706,stroke-width:2px,color:#000
```

### With Istio Service Mesh

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: order-service
spec:
  hosts:
    - order-service
  http:
    - route:
        - destination:
            host: order-service
            subset: stable
          weight: 95
        - destination:
            host: order-service
            subset: canary
          weight: 5
```

### Progressive Delivery

```
5% → monitor errors/latency → 25% → monitor → 50% → monitor → 100%
     ↓ (if errors spike)
     Automatic rollback!
```

| Pros | Cons |
|---|---|
| Low risk — small blast radius | More complex setup |
| Real user validation | Need good monitoring/alerting |
| Automatic rollback possible | Mixed versions serve traffic |

---

## 🏁 Feature Flags (Deploy Dark)

Deploy code to production but keep it hidden behind a flag:

```java
@Service
public class CheckoutService {

    @Value("${feature.new-payment-flow.enabled:false}")
    private boolean newPaymentFlowEnabled;

    public PaymentResult processCheckout(Order order) {
        if (newPaymentFlowEnabled) {
            return newPaymentFlow(order);  // New code, deployed but inactive
        }
        return legacyPaymentFlow(order);   // Currently active
    }
}
```

```mermaid
flowchart TD
    D["Deploy v2 code<br/>(flag OFF)"] --> T["Test in prod<br/>(internal users only)"]
    T --> E5["Enable for 5%<br/>Monitor metrics"]
    E5 --> E100["Enable for 100%<br/>Full rollout"]
    E100 --> CL["Clean up flag<br/>Remove old code"]

    style D fill:#E3F2FD,stroke:#1565C0,color:#000
    style E100 fill:#E8F5E9,stroke:#2E7D32,color:#000
```

---

## 📊 Strategy Comparison

| Strategy | Downtime | Risk | Cost | Rollback Speed | Best For |
|---|---|---|---|---|---|
| Rolling | None | Medium | Low | Medium (minutes) | Most deployments |
| Blue-Green | None | Low | High (2x infra) | Instant | Critical services |
| Canary | None | Lowest | Medium | Fast (seconds) | High-traffic services |
| Feature Flags | None | Lowest | Low | Instant (toggle) | Gradual feature rollout |

---

## 🔄 CI/CD Pipeline

```mermaid
flowchart LR
    C["📝 Code Push"] --> B["🔨 Build<br/>+ Unit Tests"]
    B --> I["🐳 Docker Image<br/>Tag: git-sha"]
    I --> D["🧪 Deploy to Staging"]
    D --> IT["🧪 Integration Tests"]
    IT --> P["🚀 Deploy to Prod<br/>(canary 5%)"]
    P --> M["📊 Monitor<br/>Errors, Latency"]
    M -->|"✅ Healthy"| Full["📈 100% Traffic"]
    M -->|"❌ Errors"| RB["⬅️ Rollback"]

    style Full fill:#E8F5E9,stroke:#2E7D32,color:#000
    style RB fill:#FFCDD2,stroke:#C62828,color:#000
```

---

## 🎯 Interview Questions

??? question "1. What deployment strategies do you know?"
    **Rolling Update** — replace pods gradually (K8s default). **Blue-Green** — two environments, instant switch. **Canary** — route small % of traffic to new version, gradually increase. **Feature Flags** — deploy dark, enable incrementally. **A/B Testing** — route specific user segments to different versions.

??? question "2. How do you achieve zero-downtime deployments?"
    Readiness probes (don't send traffic until ready), graceful shutdown (finish in-flight requests), rolling updates (always maintain capacity), backward-compatible API changes, and database migrations that work with both old and new code.

??? question "3. How do you handle database migrations with zero downtime?"
    **Expand-and-contract pattern**: 1) Add new column (nullable), deploy new code that writes to both columns. 2) Migrate existing data. 3) Deploy code that only reads new column. 4) Drop old column. Never make breaking schema changes in one step.

??? question "4. What is a canary deployment and when would you use it?"
    Deploy new version alongside stable, route a small percentage (1-5%) of traffic to it. Monitor error rates, latency, and business metrics. If healthy, gradually increase. If degraded, automatically roll back. Use for high-traffic production services where bugs have large blast radius.

??? question "5. How do you roll back a failed deployment?"
    **Rolling**: K8s `kubectl rollout undo`. **Blue-Green**: switch service selector back. **Canary**: shift weight to 0%. **Feature flags**: toggle off instantly. Always keep the previous version's Docker image available. Database rollbacks are harder — prefer forward-fix with expand-and-contract.

