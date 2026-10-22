# Servers & Domains (Infrastructure module)

Admin → **System & Security → Servers & Domains** (`/infrastructure`). Backend: `src/modules/infrastructure/`,
models: `src/models/infrastructure/`, admin UI: `admin/organic_admin/components/infrastructure/` and
`app/(dashboard)/infrastructure/`.

This module is a port of the Infrastructure module of Encodency Omniplatform (NestJS + PostgreSQL) to this project's
stack (Express 5 + MongoDB/Mongoose). The pages, workflows and business rules are the same; the code is not shared and
the two systems are fully independent (own database, own encryption key, own collector tokens, own schedulers).

## Switching it on

The module is **off by default** so that deploying the code never creates collections or schedules work unannounced.

| Variable | Required | Meaning |
| --- | --- | --- |
| `INFRASTRUCTURE_ENABLED` | yes | `true` mounts `/api/v1/infrastructure/*`, creates indexes and starts the scheduler |
| `ENCRYPTION_MASTER_KEY` | for provider credentials | base64 of 32 random bytes, **unique to this deployment** (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`). Without it provider credentials are refused with 503; everything else works |
| `INFRA_SWEEP_MINUTES` | no (30) | scheduler period, `0` disables the sweep |
| `INFRA_RDAP_INTERVAL_HOURS` / `INFRA_DNS_INTERVAL_HOURS` / `INFRA_SSL_INTERVAL_HOURS` | no (24 / 6 / 24) | refresh age per check |
| `INFRA_PROVIDER_SYNC_MINUTES` | no (360) | provider sync age, `0` disables |
| `INFRA_DNS_SERVERS` | no | resolvers for DNS lookups (default `1.1.1.1,8.8.8.8,9.9.9.9`) |
| `INFRA_DEFAULT_CURRENCY` | no (INR) | currency pre-selected for a new subscription |
| `INFRA_EMAIL_DISABLED` | no | `true` suppresses reminder e-mails (in-app alerts still work) |
| `INFRA_SCHEDULER` | no | `off` keeps the process from running the sweep (for a second web instance or a dev copy) |
| `INFRA_INGEST_RATE_PER_MIN` | no (20) | per-collector request cap |

Email uses the existing `SMTP_*` settings; AI report narratives use the existing `OPENAI_API_KEY` / `GEMINI_API_KEY`.

## Permissions (Roles & Permissions)

| Permission id | Allows |
| --- | --- |
| `perm_infra_view` | read inventory, health, alerts, renewals (amounts hidden) |
| `perm_infra_manage` | add/edit/archive servers & domains, alert actions, reports, SSL targets |
| `perm_infra_billing_view` | amounts, payment history, cost reports |
| `perm_infra_billing_manage` | subscriptions, payment confirmation, adjustments |
| `perm_infra_integrations_view` | view provider connections |
| `perm_infra_integrations_manage` | provider credentials, collectors, thresholds, alert settings, DNS TXT contents |

Super admins hold all of them. Every route requires a valid admin JWT **and** the permission; the only exception is
`POST /api/v1/infrastructure/ingest` (collector token).

## Background work

There is no Redis dependency. A repeating sweep runs inside the API process and is made single-instance with a MongoDB
lease lock (`infra_locks`, atomic `findOneAndUpdate`; a crashed holder's lease expires on its own). It performs only due
work: registry (RDAP), DNS, SSL, provider sync, alert evaluation/delivery retries, collector-offline detection and stale
report cleanup. Bulk domain refresh is a de-duplicated background job with exponential-backoff retries.

Differences from the original BullMQ queue: retries of a bulk refresh do not survive a process restart, and jobs are not
visible in a queue dashboard. The code is isolated behind `infra.scheduler.ts`, so a BullMQ implementation (with its own
Redis connection and a prefix such as `boe:infra`) can replace it if a reliable production Redis becomes available.

## Monitoring collector

`docs/monitoring/omni-collector.py` (stdlib Python, read-only) pushes a sample every 30-60 s to
`POST /api/v1/infrastructure/ingest` with a per-server bearer token created in *Server → Monitoring setup*. Only the
SHA-256 of the token is stored. The endpoint is mounted before the global 50 MB JSON parser with its own 256 KB cap and a
per-token rate limit, and it is not part of the admin Activity Log.

## Data

Collections are prefixed `infra_`: `settings`, `provider_connections`, `assets` (servers and domains embedded),
`dns_snapshots`, `ssl_certificates`, `asset_relations`, `subscriptions`, `billing_records`, `alerts`, `sync_runs`,
`collectors`, `metric_samples`, `reports`, `audit_events`, `notifications`, `locks`. Retention is done by TTL indexes:
metric samples 30 days, sync runs 90 days, notifications 180 days. Money is stored as Decimal128.

## Not part of this module

* The existing **Security Center** (`/system-services`) is untouched and independent.
* No live billing or utilisation from Contabo (its API has neither); other providers are manual inventory.
* No client/tenant scoping (this deployment is one organisation).

## Tests

`npx vitest run tests/infrastructure` — ported unit specs plus an HTTP-level suite against a real MongoDB. The API suite
refuses to run against anything but a localhost database (default `mongodb://127.0.0.1:27018/organic_infra_test`,
override with `INFRA_TEST_MONGODB_URI`) and drops it first.
