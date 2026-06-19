---
title: "Kubernetes Interview Questions — Top 40 with Answers"
description: "Top Kubernetes interview questions with answers. Covers pods, deployments, services, ingress, HPA, RBAC, ConfigMaps, Secrets, Helm, networking, and production troubleshooting — asked at FAANG, SRE, and DevOps interviews."
---

# Kubernetes Interview Questions

Kubernetes is asked in every senior backend, DevOps, and SRE interview. This page covers the 40 most frequently asked questions with concise, interview-ready answers — from pod scheduling to production troubleshooting asked at Google, Amazon, Netflix, and top product companies.

**What interviewers test:** Not just kubectl commands, but whether you understand *why* K8s makes certain architectural decisions — how the scheduler works, what happens during a rolling update, why pods get OOMKilled, and how to debug a CrashLoopBackOff.

---

## Architecture

**1. What are the main components of a Kubernetes cluster?**

**Control Plane (brain):**
- `kube-apiserver` — REST API gateway; all kubectl commands and components communicate through it
- `etcd` — distributed key-value store; the source of truth for all cluster state
- `kube-scheduler` — watches for unscheduled pods; assigns them to nodes based on resources and constraints
- `kube-controller-manager` — runs controllers (Deployment, ReplicaSet, Node, Endpoint controllers)

**Worker Nodes:**
- `kubelet` — agent on each node; ensures containers described in PodSpecs are running and healthy
- `kube-proxy` — manages network rules for Service routing (iptables/ipvs)
- Container runtime — Docker, containerd, or CRI-O

**2. What happens when you run `kubectl apply -f deployment.yaml`?**

1. `kubectl` sends the manifest to `kube-apiserver`
2. API server validates, authenticates, authorizes, and stores in `etcd`
3. `Deployment controller` sees the new Deployment, creates a `ReplicaSet`
4. `ReplicaSet controller` sees desired pods don't exist, creates Pod objects
5. `Scheduler` sees unscheduled pods, assigns each to a node based on resources
6. `kubelet` on the assigned node sees the pod spec, pulls the image, starts containers
7. Pod becomes `Running`

**3. What is etcd and why is it critical?**

etcd is a strongly-consistent distributed key-value store (Raft consensus). It stores the entire cluster state — all objects (pods, services, secrets, configmaps). If etcd data is lost without a backup, the entire cluster state is gone. In production: run 3 or 5 etcd nodes across AZs, back up regularly, monitor closely.

→ Deep dive: [Kubernetes](../devops/kubernetes.md)

---

## Pods & Workloads

**4. What is a Pod?**

The smallest deployable unit in Kubernetes — one or more containers sharing a network namespace (same IP, same localhost) and storage volumes. Containers in a pod are always co-located and co-scheduled. Pods are ephemeral — never attach to a specific pod IP in your application code.

**5. What is the difference between a Pod, ReplicaSet, and Deployment?**

- **Pod:** single instance, no self-healing
- **ReplicaSet:** maintains N identical pod replicas; replaces crashed pods. Don't use directly.
- **Deployment:** manages ReplicaSets; adds rolling updates, rollback, revision history. Use for stateless apps.

**6. What is a StatefulSet and when do you use it?**

Like a Deployment but for **stateful workloads** — provides stable network identities (`pod-0`, `pod-1`), ordered startup/shutdown, and persistent storage per pod (PVC not shared). Use for: databases (MySQL, Cassandra), Kafka brokers, ZooKeeper — anything that needs stable identity or per-instance storage.

**7. What is a DaemonSet?**

Ensures **one pod per node** — when a node joins the cluster, the DaemonSet pod is automatically scheduled on it. Use for: log collectors (Fluentd, Filebeat), monitoring agents (Prometheus node-exporter), network plugins (Calico, Weave).

**8. What is a Job vs CronJob?**

- **Job:** runs a pod to completion — retry on failure until success count is met. Use for: data migrations, batch processing, one-time tasks.
- **CronJob:** creates Jobs on a schedule (cron syntax). Use for: nightly reports, cleanup tasks, periodic backups.

---

## Scheduling

**9. How does the Kubernetes scheduler decide where to place a pod?**

Two phases:
1. **Filtering:** eliminates nodes that don't meet requirements — insufficient CPU/memory, taints not tolerated, node affinity not satisfied, port conflicts
2. **Scoring:** ranks remaining nodes — prefers nodes with more available resources, satisfies preferred affinity, balances load

**10. What are taints and tolerations?**

**Taints** mark a node as unsuitable for certain pods (e.g., `dedicated=gpu:NoSchedule`). **Tolerations** allow a pod to be scheduled on a tainted node. Use to: dedicate nodes to specific workloads, prevent non-GPU pods from landing on expensive GPU nodes, mark nodes as not-ready during maintenance.

**11. What is node affinity vs pod affinity?**

- **Node affinity:** schedule pods on nodes matching labels (`requiredDuringScheduling` = hard, `preferredDuringScheduling` = soft). E.g., "only on nodes in us-east-1a".
- **Pod affinity/anti-affinity:** schedule pods relative to other pods. Anti-affinity is critical for HA — spread replicas across nodes/AZs so one node failure doesn't kill all replicas.

---

## Services & Networking

**12. What is a Kubernetes Service and why do you need it?**

Pods are ephemeral — their IPs change when they restart. A **Service** provides a stable virtual IP (ClusterIP) and DNS name that load-balances traffic to matching pods (via label selector). `kube-proxy` maintains iptables/ipvs rules to route traffic.

**13. What are the Service types?**

| Type | Accessibility | Use for |
|---|---|---|
| `ClusterIP` | Internal only (default) | Service-to-service communication |
| `NodePort` | External via `<NodeIP>:<Port>` | Dev/testing, not production |
| `LoadBalancer` | External via cloud LB | Production external traffic |
| `ExternalName` | DNS alias to external service | Accessing external services by name |

**14. What is an Ingress?**

A Layer 7 (HTTP/HTTPS) routing rule — routes external traffic to Services based on hostname and path. Requires an **Ingress Controller** (nginx-ingress, Traefik, AWS ALB Ingress) to be installed. Supports: path-based routing, TLS termination, virtual hosting. More flexible and cheaper than one LoadBalancer per service.

**15. What is a NetworkPolicy?**

Firewall rules for pod traffic — by default all pods can communicate with all other pods. NetworkPolicy restricts ingress/egress based on pod labels, namespace, and IP blocks. E.g., "only allow payment-service to reach database-pod on port 5432."

---

## Configuration & Storage

**16. What is the difference between ConfigMap and Secret?**

| | ConfigMap | Secret |
|---|---|---|
| Data type | Plain text | Base64-encoded (not encrypted by default) |
| Use for | App config, env vars, config files | Passwords, API keys, TLS certs |
| Mounted as | Env var or volume | Env var or volume |
| Access control | Standard RBAC | Stricter RBAC recommended |

Secrets are base64 — not encrypted at rest by default. Enable **encryption at rest** in etcd for production, or use Vault/AWS Secrets Manager with external-secrets-operator.

**17. What are the volume types you use most in production?**

- `emptyDir` — temp storage, deleted when pod dies. Good for scratch space, inter-container sharing.
- `hostPath` — mounts a node path. Avoid — breaks pod portability.
- `PersistentVolumeClaim (PVC)` — requests durable storage (EBS, GCE PD, NFS). Use for stateful apps.
- `ConfigMap / Secret` — mount config/secrets as files.

**18. What is a PersistentVolume (PV) vs PersistentVolumeClaim (PVC)?**

**PV:** a piece of storage provisioned by an admin or dynamically by a `StorageClass` (e.g., 100GB EBS volume). **PVC:** a request for storage by a pod ("I need 10Gi, ReadWriteOnce"). Kubernetes binds the PVC to a matching PV. Dynamic provisioning with `StorageClass` means you rarely manage PVs manually.

---

## Scaling & Updates

**19. What is the Horizontal Pod Autoscaler (HPA)?**

Automatically scales the number of pods based on metrics — CPU utilization (default), memory, or custom metrics (via Prometheus Adapter). Checks metrics every 15s (configurable). Scales up fast, scales down slowly (stabilization window prevents flapping).

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

**20. What is the difference between Rolling Update, Recreate, and Blue-Green in Kubernetes?**

- **RollingUpdate** (default): replaces pods one by one — zero downtime, controlled by `maxSurge` and `maxUnavailable`
- **Recreate**: kills all old pods, then starts new ones — brief downtime, used when two versions can't coexist
- **Blue-Green**: two separate Deployments; switch Service selector. Instant cutover, instant rollback, double the resources
- **Canary**: route small % of traffic to new version (via Ingress weights or service mesh)

**21. How do you roll back a Deployment?**

```bash
kubectl rollout undo deployment/my-app              # roll back one version
kubectl rollout undo deployment/my-app --to-revision=3  # specific revision
kubectl rollout history deployment/my-app           # see revision history
```

---

## Security & RBAC

**22. What is RBAC in Kubernetes?**

Role-Based Access Control — controls who can do what in the cluster.
- `Role` / `ClusterRole` — defines permissions (verbs: get, list, create, delete on resources)
- `RoleBinding` / `ClusterRoleBinding` — binds a Role to a user, group, or ServiceAccount
- `ServiceAccount` — identity for pods — used to call the K8s API from inside a pod

Principle of least privilege: give each pod/service account only the permissions it needs.

**23. What is a Pod Security Context?**

Defines security settings at the pod or container level:
- `runAsNonRoot: true` — don't run as root
- `readOnlyRootFilesystem: true` — prevent writes to container filesystem
- `allowPrivilegeEscalation: false` — no sudo
- `seccompProfile` — restrict syscalls

Use `Pod Security Admission` (PSA, Kubernetes 1.25+) to enforce security standards cluster-wide.

---

## Observability & Troubleshooting

**24. A pod is in `CrashLoopBackOff`. How do you debug it?**

```bash
kubectl describe pod <pod>        # look at Events section — OOMKilled, image pull error, probe failure
kubectl logs <pod>                # current container logs
kubectl logs <pod> --previous     # logs from previous (crashed) container
kubectl exec -it <pod> -- sh      # shell into container (if it starts)
```

Common causes: app crash on startup (bad config, missing env var), OOMKilled (increase memory limit), liveness probe misconfigured (too aggressive timeout), missing dependency (DB not ready — add `initContainer` or retry logic).

**25. What is `OOMKilled` and how do you fix it?**

The container exceeded its **memory limit** — the Linux kernel OOM killer terminated it. Fix: increase `resources.limits.memory`, or investigate a memory leak with heap dumps / profilers. Always set both `requests` (scheduling hint) and `limits` (enforcement).

**26. What is the difference between liveness and readiness probes?**

| | Liveness Probe | Readiness Probe |
|---|---|---|
| Failure action | **Restart the container** | **Remove from Service endpoints** (stop sending traffic) |
| Use for | Detect deadlocks, stuck processes | Detect app not ready (warming up, dependency down) |
| Misconfiguration risk | Too aggressive = restart loop | Overly strict = pod removed from rotation unnecessarily |

Always have a readiness probe. Only add liveness if your app can truly get stuck without crashing.

**27. How do you debug a pod that's stuck in `Pending`?**

```bash
kubectl describe pod <pod>   # look at Events
```

Common causes: insufficient CPU/memory on any node (scale cluster or reduce requests), no node satisfies node affinity/taints, PVC can't be bound (no matching PV or StorageClass issues).

**28. What are resource requests and limits?**

- `requests`: what the scheduler uses to find a node with enough capacity. Pod is guaranteed this much.
- `limits`: hard cap — container is OOMKilled (memory) or throttled (CPU) if exceeded.

Always set both. Without `requests`, the scheduler can't make good decisions. Without `limits`, a runaway process can starve other pods on the node.

---

## Helm & Production

**29. What is Helm?**

Kubernetes package manager — bundles K8s manifests into a **Chart** (versioned, parameterized). `helm install`, `helm upgrade`, `helm rollback`. Values files (`values.yaml`) allow environment-specific customization without duplicating manifests. Helm 3 removed Tiller — runs fully client-side.

**30. What is a Namespace and why use multiple?**

Namespaces provide logical isolation within a cluster — separate environments (`dev`, `staging`, `prod`), teams, or applications. ResourceQuotas limit total CPU/memory per namespace. NetworkPolicies can isolate namespace traffic. In practice: one namespace per environment or per team.

**31. What is the difference between `kubectl apply` and `kubectl create`?**

`kubectl create` — imperative, fails if resource already exists. `kubectl apply` — declarative, creates or updates. Always use `apply` — it's idempotent and works in CI/CD pipelines.

---

## Quick-Fire Questions

**32. What is a sidecar container?** A helper container in the same pod — shares network and volumes with the main container. Used for: log shipping (Filebeat), proxying (Envoy), secret rotation (Vault agent).

**33. What is an initContainer?** Runs to completion before app containers start. Use for: waiting for a dependency (`wait-for-db`), database migrations, permission fixes on mounted volumes.

**34. What is `kubectl port-forward`?** Forwards a local port to a pod port — for local debugging without exposing a Service. `kubectl port-forward pod/my-pod 8080:80`.

**35. What is the difference between `Deployment` and `ReplicaSet`?** Deployment manages ReplicaSets and adds rolling update/rollback. Always use Deployment — never manage ReplicaSets directly.

**36. What is cluster autoscaler?** Automatically adds/removes nodes based on pod scheduling needs — adds nodes when pods are unschedulable due to insufficient resources; removes underutilized nodes. Works with cloud provider node groups (ASGs on AWS, MIGs on GCP).

**37. What is a PodDisruptionBudget (PDB)?** Limits voluntary disruptions — ensures at least N pods are always available during node drains or rolling updates. `minAvailable: 2` means at least 2 pods must be running. Critical for HA.

**38. How do you zero-downtime drain a node?** `kubectl drain <node> --ignore-daemonsets --delete-emptydir-data` — evicts pods respecting PDBs, then cordon prevents new pods from scheduling. Pods are rescheduled on other nodes.

**39. What is Vertical Pod Autoscaler (VPA)?** Automatically adjusts pod CPU/memory `requests` based on actual usage history. Complements HPA — use VPA for right-sizing, HPA for scaling replicas. Don't use both on the same Deployment simultaneously.

**40. What is a ServiceMesh and when do you need it?** A dedicated infrastructure layer (Istio, Linkerd) for service-to-service communication — adds mTLS, retries, circuit breaking, distributed tracing via sidecar proxies. Use when you have 20+ services and don't want to implement resilience logic in every service.

→ Deep dive: [Kubernetes](../devops/kubernetes.md)

---

## Go Deeper

- [Kubernetes Deep Dive](../devops/kubernetes.md)
- [Docker](../devops/docker.md)
- [CI/CD Pipelines](../cicd/cicd.md)
- [Service Mesh](../microservices/service-mesh.md)
- [Microservices Deployment Strategies](../microservices/deployment-strategies.md)
- [Observability](../microservices/Observability.md)
