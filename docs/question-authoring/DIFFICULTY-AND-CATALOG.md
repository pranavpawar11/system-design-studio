# Difficulty levels and the question catalogue

Every question has one `question.difficulty`: **easy**, **medium** or **hard**.
(`beginner`, `intermediate` and `advanced` in older files are accepted and shown as easy, medium and hard.)

## How to choose

Decide by what a *good answer* must contain, not by how famous the product is.

| | **Easy** | **Medium** | **Hard** |
|---|---|---|---|
| Time (`estimatedMinutes`) | 30 to 45 | 45 to 60 | 60 to 90 |
| Core idea | One main flow and one obvious bottleneck | Two or more flows; a real trade-off | Several interacting flows; the trade-offs conflict |
| Components in a good answer | 4 to 7 | 7 to 11 | 10 or more |
| Hard part | Estimating load; caching or choosing a store | Async work, partitioning, fan-out, consistency vs availability | Consensus, ordering, multi-region, exactly-once effects, contention |
| Failure thinking | A cache or database is down | A queue backs up; a node dies; duplicates arrive | Split brain, replay, partial failure across regions |
| Requirements | 3 to 5 functional, 2 to 3 non-functional | 4 to 6, 3 to 5 | 5 to 8, 4 to 6 |
| Hints / follow-ups | 5 / 3 to 5, mostly easy | 5 / 4 to 6, mixed | 5 / 5 to 8, mostly medium and hard |
| Needs a learner to know | HTTP, a database, caching basics | Queues, sharding, replication basics | Consistency models, consensus, stream processing |
| Typical wrong answer | Forgetting the read/write imbalance | Treating async as free; ignoring duplicates | Hand-waving ordering and failure |

**Quick test.** Can a good answer be drawn in under ten components with no distributed-systems theory? → easy.
Does it need a queue, a partition scheme or a fan-out decision? → medium.
Does it need consensus, ordering guarantees or more than one region to be correct? → hard.

**Calibrate with a pilot.** Have two people who have not seen it build a design. If both finish in under 60% of the estimate,
it is probably one level easier than labelled; if neither finishes, one level harder.

## Where the two shipped questions sit

| Question | Level | Why |
|---|---|---|
| URL Shortener | easy | One read-heavy flow; caching and unique IDs are the whole story. 45 min. |
| Rate Limiter | medium | Shared state across servers, failure behaviour (fail-open vs fail-closed), per-request latency cost. 45 min. |

## Engine fit: how much new work a question needs

| Fit | Meaning |
|---|---|
| **Ready** | Needs only components and connections that exist, plus an evaluator. |
| **New components** | Needs new component types (add them to the question file; no app code). Plus an evaluator. |
| **New modeling** | Needs behaviour the engine cannot express yet (quorum, consensus, ordering, geo-queries). Plan declaration settings, or new engine support. |

## Catalogue: 30 questions

Status: **Available** or Planned. Ids follow `hld-<slug>-001`.

### Easy (8)

| # | Question | id | What it teaches | New components | Engine fit | Status |
|---|---|---|---|---|---|---|
| 1 | URL Shortener | `hld-url-shortener-001` | Read-heavy lookup, unique IDs, caching | none | Ready | **Available** |
| 2 | Pastebin | `hld-pastebin-001` | Blob storage, expiry, read-heavy | Object Storage | New components | Planned |
| 3 | Page-View Counter | `hld-page-view-counter-001` | Write-heavy counters, batching, eventual consistency | none (queue, worker, counter store exist) | Ready | Planned |
| 4 | File Upload Service | `hld-file-upload-001` | Pre-signed uploads, chunking, async scanning | Object Storage | New components | Planned |
| 5 | Image Thumbnail Service | `hld-image-thumbnails-001` | Async processing, idempotency, CDN | Object Storage | New components | Planned |
| 6 | Feature Flag Service | `hld-feature-flags-001` | Read-heavy config, push vs poll, staleness | none | Ready | Planned |
| 7 | Leaderboard | `hld-leaderboard-001` | Ranking, top-K, sorted sets | Sorted-set cache (a cache with a ranking operation) | New components | Planned |
| 8 | Voting / Poll System | `hld-polls-001` | One vote per user, write-heavy counts, dedupe | none | Ready | Planned |

### Medium (12)

| # | Question | id | What it teaches | New components | Engine fit | Status |
|---|---|---|---|---|---|---|
| 9 | Rate Limiter | `hld-rate-limiter-001` | Shared counters, algorithms, fail-open vs closed | none | Ready | **Available** |
| 10 | Key-Value Store | `hld-key-value-store-001` | Partitioning, consistent hashing, replication, quorum | Storage Node, Coordinator | New modeling | Planned |
| 11 | Multi-channel Notification System | `hld-notification-system-001` | Queues per channel, retries, dead letters, idempotency, preferences | Dead-letter Queue, Template Service, External Provider | Ready (uses queue and worker path) | Planned |
| 12 | News Feed | `hld-news-feed-001` | Fan-out on write vs read, celebrity users, feed cache | Feed Cache, Graph Store | New components | Planned |
| 13 | Chat Messaging | `hld-chat-001` | Persistent connections, ordering, offline delivery, group fan-out | WebSocket Gateway, Presence Store | New components | Planned |
| 14 | Typeahead / Autocomplete | `hld-typeahead-001` | Prefix indexes, ranking, update pipeline | Search Index | New components | Planned |
| 15 | Web Crawler | `hld-web-crawler-001` | URL frontier, politeness, dedupe, partitioning | Frontier Queue, Blob Store | New components | Planned |
| 16 | Distributed Job Scheduler | `hld-job-scheduler-001` | Delayed jobs, leader election, at-least-once, idempotency | Scheduler, Coordination Service | New modeling | Planned |
| 17 | Unique ID Generator | `hld-unique-id-generator-001` | Time-based IDs, clock skew, coordination | ID Service Node | New components | Planned |
| 18 | Metrics and Monitoring | `hld-metrics-monitoring-001` | Ingestion pipeline, time-series storage, downsampling, alerts | Time-series Database, Stream | New components | Planned |
| 19 | Distributed Cache | `hld-distributed-cache-001` | Eviction, consistent hashing, stampedes, replication | Cache Node, Coordinator | New modeling | Planned |
| 20 | Video on Demand Streaming | `hld-video-streaming-001` | Transcoding pipeline, CDN, adaptive bitrate | Transcoder, Object Storage | New components | Planned |

### Hard (10)

| # | Question | id | What it teaches | New components | Engine fit | Status |
|---|---|---|---|---|---|---|
| 21 | Ride Sharing | `hld-ride-sharing-001` | Geo-indexing, matching, high-rate location updates, ETAs | Geo Index, Matching Service, Stream | New modeling | Planned |
| 22 | Cloud File Storage and Sync | `hld-file-sync-001` | Chunking, dedupe, delta sync, conflict resolution | Metadata Store, Object Storage, Sync Notifier | New modeling | Planned |
| 23 | Collaborative Document Editor | `hld-collab-editor-001` | Operational transform or CRDTs, ordering, presence | Collaboration Server, Operation Log | New modeling | Planned |
| 24 | Payment System | `hld-payment-system-001` | Idempotency, ledgers, sagas, reconciliation | Ledger Store, Payment Gateway, Idempotency Store | New modeling | Planned |
| 25 | Distributed Message Queue | `hld-message-queue-001` | Partitioned logs, consumer groups, replication, ordering | Broker, Log Storage, Coordinator | New modeling | Planned |
| 26 | Live Streaming | `hld-live-streaming-001` | Ingest, low-latency transcoding, CDN fan-out | Ingest Server, Transcoder | New components | Planned |
| 27 | Web Search Engine | `hld-search-engine-001` | Crawling, inverted index, ranking, sharding, freshness | Search Index, Ranker | New components | Planned |
| 28 | High-contention Ticket Booking | `hld-ticket-booking-001` | Inventory locking, waiting room, overselling, payment timeouts | Waiting Room, Lock Service | New modeling | Planned |
| 29 | Distributed Lock and Coordination | `hld-distributed-lock-001` | Consensus, leases, fencing tokens | Consensus Cluster | New modeling | Planned |
| 30 | Stock Exchange Matching Engine | `hld-matching-engine-001` | Sequencing, order book, deterministic replay, audit | Sequencer, Order Book | New modeling | Planned |

### Suggested order to build next

1. **Multi-channel Notification System** (medium). Reuses the queue and worker path the engine already models. Best test of the kit with no new components.
2. **Pastebin** (easy). Needs only a new Object Storage component, so it proves "add a component without touching code".
3. **Page-View Counter** and **Voting System** (easy). Ready today; they reuse the counter store and queue.
4. **Feature Flag Service** (easy). Ready today.
5. Then the "New components" mediums (News Feed, Typeahead, Web Crawler). Hold the "New modeling" questions until the declarative rule format exists.
