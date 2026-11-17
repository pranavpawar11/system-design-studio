# Operations and configuration vocabulary

Two things are matched by **exact text**, so spelling matters:

1. **Operations** (`supportedOperations` on a component, `compatibleSourceOperations` / `compatibleTargetOperations` on a connection type).
2. **Config keys** (`defaultConfig` on a component), which shared code reads by name.

## How a connection is allowed

A line from component **A** to component **B** with connection type **T** can be drawn only if:

- A supports at least one operation in `T.compatibleSourceOperations`, **and**
- B supports at least one operation in `T.compatibleTargetOperations`.

The linter reports a connection type that no pair of components can ever satisfy
(for example, a target operation that nothing supports).

**Reuse the words below.** Invent a new operation only when none fits. Use lower-case-with-dashes.
A new word is fine as long as at least one component supports it and one connection type lists it.

## Operations in use today

Generated from the two real questions. "Used by" lists components that support it; "Edges" lists connection types that mention it.

| Operation | Meaning | Components | Edges |
|---|---|---|---|
| `aggregate-query` | Summarises many records. | ANALYTICS-STORE | (none) |
| `allocate-identifier` | Hands out identifiers from a range or counter. | KEY-GENERATOR | ID-ALLOC |
| `append-write` | Appends records without updating old ones (events, logs). | ANALYTICS-STORE | DB-WRITE |
| `atomic-increment` | Increases a counter safely under concurrency. (Counter store) | COUNTER-STORE | COUNTER |
| `authentication` | Verifies who is calling. | API-GATEWAY, AUTH | (none) |
| `buffer-work` | Holds messages until consumers are ready (queue). | QUEUE | ASYNC-CONSUME, ASYNC-PUBLISH |
| `cache-read` | Looks a value up in a cache. | CACHE, COUNTER-STORE | CACHE-READ, TELEMETRY |
| `cache-write` | Stores a value in a cache. | CACHE, COUNTER-STORE | CACHE-WRITE |
| `collect-health` | Receives health signals. | METRICS | TELEMETRY |
| `collect-logs` | Receives logs. | LOGGING | TELEMETRY |
| `collect-metrics` | Receives metrics. | METRICS | TELEMETRY |
| `collect-traces` | Receives request traces. | LOGGING | TELEMETRY |
| `conditional-write` | Writes only if a condition holds. The atomic uniqueness tool of key-value stores. | NOSQL-DATABASE | REPLICATION |
| `consume-message` | Takes messages from a queue. | QUEUE, WORKER | ASYNC-CONSUME, TELEMETRY |
| `durable-read` | Reads stored data. | NOSQL-DATABASE, READ-REPLICA, RULES-DB, SQL-DATABASE | DB-READ, TELEMETRY |
| `durable-write` | Stores data so it survives restarts. | APP-SERVER, NOSQL-DATABASE, RULES-DB, SQL-DATABASE | DB-WRITE |
| `generate-identifier` | Produces unique identifiers. | KEY-GENERATOR | ID-ALLOC |
| `health-based-routing` | Stops sending traffic to unhealthy servers. | LOAD-BALANCER | (none) |
| `hostname-resolution` | Turns a hostname into an address (DNS). | DNS | (none) |
| `http-cache` | Caches HTTP responses near the user (CDN). | CDN | (none) |
| `http-forward` | Forwards uncached requests onward. | CDN | (none) |
| `http-request` | Sends or accepts an HTTP request. | APP-SERVER, AUTH, CLIENT | SYNC-HTTP, TELEMETRY |
| `http-response` | Receives the final response. Marks a component as an entry point (a client); evaluators start their path search here. | CLIENT | (none) |
| `http-response-handler` | Rate Limiter question only; no connection uses it. | APP-SERVER--rl | (none) |
| `http-routing` | Routes requests by path or policy (gateway, firewall). | API-GATEWAY, WAF | SYNC-HTTP |
| `indexed-lookup` | Finds records through an index. | READ-REPLICA, RULES-DB, SQL-DATABASE | DB-READ |
| `key-lookup` | Finds a record by its key (key-value stores). | NOSQL-DATABASE, READ-REPLICA | DB-READ |
| `mapping-lookup` | Resolves a key to its stored value. (URL shortener) | APP-SERVER | CACHE-READ, DB-READ |
| `process-job` | Does asynchronous work (worker). | WORKER | DB-WRITE |
| `publish-message` | Puts a message on a queue. | APP-SERVER, QUEUE | ASYNC-PUBLISH |
| `rate-limiting` | Gateway-level request limiting. | API-GATEWAY | (none) |
| `redirect-response` | Answers with an HTTP redirect. (URL shortener) | APP-SERVER | (none) |
| `reject-excess-requests` | Rejects requests over the limit. (Rate limiter) | RATE-LIMITER | (none) |
| `replication-target` | Receives copies of data from a primary store. | READ-REPLICA | REPLICATION |
| `request-distribution` | Spreads requests across several servers (load balancing). | LOAD-BALANCER | SYNC-HTTP, TELEMETRY |
| `request-rate-check` | Counts requests per client and judges them against a limit. (Rate limiter) | RATE-LIMITER, WAF | COUNTER |
| `short-code-generation` | Creates a short code for a new URL. (URL shortener) | APP-SERVER | ID-ALLOC |
| `ttl-expiration` | Expires cached values after a time. | CACHE, COUNTER-STORE | (none) |
| `unique-constraint` | Enforces uniqueness atomically (relational databases). | SQL-DATABASE | REPLICATION |
| `url-validation` | Checks submitted URLs are well formed and allowed. (URL shortener) | APP-SERVER | (none) |

## Component `type` and `category`

`type` names the kind of component (`cache`, `message-queue`). Reuse existing types where one fits, so icons and colours
carry over. `category` must be one of **Clients, Networking, Compute, Caching, Storage, Messaging, Security, Observability**.
It controls the library group, the node colour and a default icon.
Set `category` on every component: a type the app has never seen is otherwise filed under Compute.

## Config keys that shared code reads

If a component stores one of these, keep the exact name and units.

| Key | Unit | Read by | Meaning |
|---|---|---|---|
| `instances` | whole number ≥ 1 | capacity model, node label, inspector | How many copies run. |
| `capacityPerInstanceRps` | requests per second | capacity model, node label | What one copy can handle. Total = instances × this. |
| `averageLatencyMs` | milliseconds | latency model | Time this component adds. |
| `averageProcessingLatencyMs` | milliseconds | latency model | Same, for application servers. |
| `averageReadLatencyMs` / `averageWriteLatencyMs` | milliseconds | latency model | Database timings. |
| `readCapacityRps` / `writeCapacityRps` | per second | capacity model, node label | Database throughput. |
| `opsCapacityRps` | per second | rate-limiter model | Counter-store throughput. |
| `hitRatio` | 0 to 1 | capacity and latency models | Share of lookups a cache answers. |
| `ttlSeconds` | seconds | node label | Cache expiry. |
| `available` | true/false | capacity model | Whether a cache is up. |
| `durable` | true/false | evaluators | Data survives restarts. |
| `uniqueConstraintSupported` | true/false | evaluators | Can enforce uniqueness atomically. |

Anything else you put in `defaultConfig` is shown in the inspector as an editable field
(a number, true/false, or text) and saved with the design. Your own evaluator can read it.

## Declaration settings (how to check what a diagram cannot show)

Some requirements are about application behaviour, such as "unknown codes return 404".
A diagram cannot prove that, so give the component a setting the learner must choose:

```json
"defaultConfig": { "notFoundBehavior": "undeclared" },
"configSchema":  { "notFoundBehavior": { "type": "string", "enum": ["undeclared", "return-404"] } }
```

The inspector renders a dropdown. Your evaluator reports **not evaluated** while it says `undeclared`, and **met** once the
learner picks a value. Always make `undeclared` the default.

`configSchema` rules: `type` is `number`, `integer`, `string` or `boolean`; optional `minimum`, `maximum`, `exclusiveMinimum`,
and `enum` (strings). Every key must also appear in `defaultConfig`, and its default must satisfy its own rule. The linter checks both.

## Connection type ids used by the shipped evaluators

If you reuse a shipped connection id, keep its meaning: `EDGE-SYNC-HTTP`, `EDGE-DB-READ`, `EDGE-DB-WRITE`,
`EDGE-CACHE-READ`, `EDGE-CACHE-WRITE`, `EDGE-ASYNC-PUBLISH`, `EDGE-ASYNC-CONSUME`, `EDGE-ID-ALLOC`, `EDGE-REPLICATION`,
`EDGE-TELEMETRY`, `EDGE-COUNTER`. Your own evaluator may use any ids you define; nothing else depends on them.
