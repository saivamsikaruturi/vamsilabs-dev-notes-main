---
title: "Kafka Interview Questions — Top 35 with Answers"
description: "Top Apache Kafka interview questions with answers. Covers topics, partitions, consumer groups, offsets, exactly-once semantics, Kafka Streams, replication, and real-world design patterns — asked at FAANG and top product companies."
---

# Kafka Interview Questions

Apache Kafka is asked in **every senior backend and system design interview**. This page covers the 35 most frequently asked Kafka questions with concise, interview-ready answers — from core concepts to exactly-once semantics and real-world design patterns asked at Amazon, Netflix, Uber, and top product companies.

**What interviewers test:** Not just "what is Kafka" but whether you can explain *why* Kafka guarantees ordering only per-partition, what happens when a consumer dies mid-processing, and how you'd design an event pipeline that doesn't lose or duplicate messages.

---

## Core Concepts

**1. What is Apache Kafka and what problem does it solve?**

Kafka is a **distributed event streaming platform** — a durable, ordered, replayable log. It solves three problems at once:
- **Decoupling:** producers and consumers don't need to know about each other
- **Buffering:** absorbs traffic spikes — producers don't wait for slow consumers
- **Replay:** unlike queues, messages are retained — multiple consumers can independently replay

Used for: event-driven microservices, real-time analytics, CDC (Change Data Capture), audit logs, activity tracking.

**2. What is the difference between Kafka and a traditional message queue (RabbitMQ/SQS)?**

| | Traditional Queue (RabbitMQ/SQS) | Kafka |
|---|---|---|
| Message retention | Deleted after consumption | Retained (configurable TTL) |
| Consumer model | Competing consumers (one gets it) | Consumer groups (each group gets all messages) |
| Replay | No | Yes — seek to any offset |
| Ordering | Per-queue FIFO | Per-partition ordering |
| Throughput | Moderate | Extremely high (millions/sec) |
| Use for | Task queues, RPC | Event streaming, audit logs, CDC |

**3. What is a Kafka Topic?**

A **named stream of records** — like a database table or a log file. Producers write to topics; consumers read from them. Topics are split into partitions for parallelism and scalability. Topics are durable — data persists on disk for a configurable retention period (default 7 days).

**4. What is a Partition?**

A partition is an **ordered, immutable sequence of records** — the unit of parallelism in Kafka. Each partition is stored on one broker (with replicas on others). Records within a partition have a monotonically increasing **offset**. Ordering is only guaranteed *within* a partition, not across partitions of the same topic.

**5. How does Kafka decide which partition a message goes to?**

- **Key provided:** `hash(key) % numPartitions` — all messages with the same key always go to the same partition (preserving order per key)
- **No key:** round-robin across partitions (Kafka 2.4+: sticky partitioner batches to one partition for throughput)
- **Custom partitioner:** implement `Partitioner` interface for custom routing logic

Use keys when ordering matters per entity (e.g., all events for `orderId=123` must be ordered).

→ Deep dive: [Apache Kafka](../kafka-messaging/kafka.md)

---

## Brokers & Replication

**6. What is a Kafka Broker?**

A Kafka broker is a **server that stores partitions and serves reads/writes**. A Kafka cluster has multiple brokers — each partition has one **leader** (handles all reads/writes) and N **replicas** on other brokers (followers). If the leader broker dies, one follower is elected the new leader.

**7. What is the replication factor?**

The number of copies of each partition across brokers. `replication.factor=3` means 3 copies — 1 leader + 2 followers. You can lose `replication.factor - 1` brokers without data loss. In production, always use replication factor ≥ 3.

**8. What is ISR (In-Sync Replicas)?**

The set of replicas that are fully caught up with the leader. If a follower falls behind (`replica.lag.time.max.ms` exceeded), it's removed from ISR. With `acks=all` (or `acks=-1`), the producer waits for all ISR replicas to acknowledge — guaranteeing no data loss even if the leader fails immediately after.

**9. What is `acks` and what are the options?**

Controls producer durability guarantee:
- `acks=0` — fire and forget, no acknowledgement. Fastest, can lose data.
- `acks=1` — leader acknowledges after writing to its log. Data lost if leader fails before replication.
- `acks=all` (or `-1`) — all ISR replicas acknowledge. Strongest durability, higher latency. Use in production for critical data.

---

## Consumers & Consumer Groups

**10. What is a Consumer Group?**

A set of consumers that cooperate to consume a topic. Kafka assigns each partition to **exactly one consumer** in the group — so processing is parallelized without duplication within the group. Different consumer groups each get their own copy of all messages — Kafka effectively broadcasts to multiple independent consumers.

**11. What happens if you have more consumers than partitions?**

Extra consumers sit **idle** — a partition can only be consumed by one consumer per group. To increase parallelism, increase the number of partitions. Max useful consumers per group = number of partitions.

**12. What is an offset and how is it managed?**

An **offset** is the position of a record in a partition — a monotonically increasing integer. Consumers commit their offset to track progress. Committed offsets are stored in the `__consumer_offsets` internal topic. On restart or rebalance, consumers resume from the last committed offset.

**13. What is the difference between `auto.offset.reset=earliest` and `latest`?**

- `earliest` — start from the beginning of the partition (reads all retained messages)
- `latest` — start from the end (only reads messages produced after the consumer started)

Use `earliest` when a new consumer group needs to process historical data. Use `latest` when only new messages matter.

**14. What is a Rebalance and why is it expensive?**

When consumers join/leave/crash, Kafka **rebalances** partition assignments across the group. During rebalance, all consumption stops — the **stop-the-world** problem. Minimize rebalances with: `session.timeout.ms` tuning, `max.poll.interval.ms`, incremental cooperative rebalancing (Kafka 2.4+, `CooperativeStickyAssignor` — only moves partitions that need to move).

→ Deep dive: [Apache Kafka](../kafka-messaging/kafka.md)

---

## Delivery Guarantees

**15. What are the delivery guarantee levels in Kafka?**

- **At-most-once:** commit offset before processing — if processing fails, message is lost
- **At-least-once:** commit offset after processing — if consumer crashes after processing but before commit, message is reprocessed (duplicates possible). **Most common in practice.**
- **Exactly-once:** requires idempotent producers + transactional API. No duplicates, no losses. Higher overhead.

**16. How does exactly-once semantics (EOS) work in Kafka?**

Two components:
1. **Idempotent producer** (`enable.idempotence=true`): each message gets a sequence number; broker deduplicates retries. Exactly-once from producer to broker.
2. **Transactions** (`transactional.id`): atomically write to multiple partitions and commit consumer offsets in one transaction. Either all writes commit or none do.

EOS adds overhead — use only when duplicates are truly unacceptable (financial transactions).

**17. How do you make a consumer idempotent without EOS?**

Design the consumer to be idempotent — processing the same message twice produces the same result:
- Use a unique message ID as a database primary key (duplicate insert is a no-op)
- Check-then-act with optimistic locking
- Use Redis `SETNX` as a deduplication gate

This is simpler than EOS and sufficient for most cases.

---

## Performance & Configuration

**18. What is `batch.size` and `linger.ms`?**

Producers batch messages before sending:
- `batch.size` — max bytes per batch (default 16KB). Larger batches = higher throughput, more memory.
- `linger.ms` — wait up to N ms for batch to fill (default 0 = send immediately). Set to 5–20ms in high-throughput scenarios to improve batching without noticeable latency increase.

**19. What is `max.poll.records` and why does it matter?**

Max records returned per `poll()` call. Default 500. If your consumer processes records slowly (external API calls, DB writes), reduce this to avoid exceeding `max.poll.interval.ms` — which triggers an unwanted rebalance.

**20. How do you increase Kafka throughput?**

- **Producer:** increase `batch.size`, set `linger.ms`, use `compression.type=lz4` or `snappy`
- **Consumer:** increase `fetch.min.bytes`, `fetch.max.wait.ms`, process in parallel threads
- **Cluster:** add partitions (more parallelism), add brokers (more storage/bandwidth)
- **Consumer group:** add more consumers (up to partition count)

---

## Kafka in System Design

**21. How would you design a notification system using Kafka?**

```
User Action → Producer → Topic: notifications (partitioned by userId)
                              ↓
                    Consumer Group: email-service
                    Consumer Group: push-service
                    Consumer Group: sms-service
```

Key decisions: partition by `userId` for ordering per user; separate topics per channel or filter by header; retry topic + dead-letter topic for failed deliveries; idempotency key per notification to prevent duplicates on retry.

**22. What is the Outbox Pattern with Kafka?**

Solves dual-write: you can't atomically write to DB *and* publish to Kafka.

1. Write business data + outbox event in **one DB transaction**
2. A **Debezium CDC connector** (or polling relay) reads the outbox table and publishes to Kafka
3. Consumers process the event

Guarantees exactly-once-to-Kafka without distributed transactions.

**23. What is Kafka Connect?**

A framework for **streaming data between Kafka and external systems** without writing producer/consumer code. Source connectors pull data into Kafka (Debezium CDC from MySQL/Postgres, S3, JDBC). Sink connectors push data out (Elasticsearch, S3, JDBC, BigQuery). Runs as a scalable cluster of workers.

**24. What is Kafka Streams?**

A **Java library for stream processing** on top of Kafka — no separate cluster needed. Supports: stateless operations (filter, map), stateful operations (aggregations, joins with KTable), windowing (tumbling, sliding, session). Processes exactly-once by default with `processing.guarantee=exactly_once_v2`.

---

## Advanced Topics

**25. What is Log Compaction?**

Instead of deleting messages by time/size, Kafka retains only the **latest record per key**. Use for: CDC (keep latest DB state), configuration stores, user profiles. Set `cleanup.policy=compact`. Compaction runs in the background — older records with the same key are deleted, keeping the latest value (or a tombstone if value=null for deletion).

**26. What is a Dead Letter Topic (DLT)?**

When a consumer fails to process a message after N retries, it publishes the message to a dead letter topic (e.g., `orders.DLT`). Operations can inspect and replay failed messages. Essential for production — never silently discard failed messages.

**27. What is the difference between Kafka and Kinesis?**

| | Kafka | AWS Kinesis |
|---|---|---|
| Hosting | Self-managed or Confluent Cloud | Fully managed AWS |
| Retention | Configurable (default 7 days) | Max 365 days |
| Replay | Yes | Yes |
| Throughput | Very high | High (shard limits) |
| Ecosystem | Kafka Connect, Streams, ksqlDB | Lambda, Firehose |

Use Kinesis on AWS when you want zero ops overhead. Use Kafka when you need full control, cross-cloud, or the Kafka ecosystem.

---

## Quick-Fire Questions

**28. What is `__consumer_offsets`?** Internal Kafka topic that stores committed consumer group offsets. Never write to it directly.

**29. Can you decrease the number of partitions?** No — you can only increase. Decreasing requires deleting and recreating the topic (data loss).

**30. What is a Kafka tombstone?** A message with a non-null key and a **null value** — signals to log compaction to delete that key's entry.

**31. What is `min.insync.replicas`?** Minimum ISR replicas that must acknowledge a write for it to succeed (with `acks=all`). Set to 2 with replication factor 3 — ensures at least 2 copies before acknowledging.

**32. What happens to unprocessed messages when a consumer restarts?** Consumer resumes from the last committed offset. Messages between the last commit and crash are reprocessed (at-least-once).

**33. What is Confluent Schema Registry?** Stores Avro/Protobuf/JSON schemas. Producers register schemas; consumers validate. Prevents schema-breaking changes from reaching consumers. `BACKWARD` compatibility = new schema can read old data.

**34. How do you monitor Kafka consumer health?** Consumer lag (messages in partition − last committed offset). Alert when lag grows continuously — consumer is falling behind. Tools: Kafka Manager, Confluent Control Center, Burrow, Prometheus + JMX exporter.

**35. What is KRaft mode?** Kafka 3.3+ removes ZooKeeper dependency — Kafka manages its own metadata via the Raft consensus protocol. Simpler ops, faster controller failover, supports millions of partitions.

---

## Go Deeper

- [Apache Kafka Deep Dive](../kafka-messaging/kafka.md)
- [Async Communication with Kafka](../microservices/AsyncCommunicationUsingKafka.md)
- [Spring Kafka Integration](../springboot/spring-kafka.md)
- [Event-Driven Architecture](../microservices/event-driven.md)
- [Message Queues — System Design](../systemdesign/message-queues.md)
- [Distributed Transactions & Outbox](../microservices/distributed-transactions.md)
