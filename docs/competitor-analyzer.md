# Competitor analyzer deployment and operation

The Organic implementation lives in `src/modules/competitor-analyzer`. The API uses Express, existing Organic authentication/permissions and Mongoose. Original Media360 scoring remains unchanged. Industry findings have their own profile/version and do not replace the original score.

## Run

Start the API with `npm.cmd run dev` in `organic_backend`. In a separate terminal in the same directory, start `npm.cmd run worker:analyzer`. Start the admin with `npm.cmd run dev` in `organic_admin`, then open `/competitor-analyzer`.

The worker is required for analysis, deep discovery, scheduled checks and scheduled report emails. Production needs both the API and `npm.cmd run worker:analyzer:production` after the normal backend build, with matching MongoDB and provider configuration. Jobs survive API/worker restarts. Worker leases, heartbeats and fencing prevent an expired worker from overwriting a new attempt. Each analysis runs in an isolated child process with a deadline and memory limit.

## Profiles and settings

Profiles: `general-v1`, `expo-v1`, `expo-organic-v1`. The settings panel controls the primary website, default profile, domain-to-profile rules and crawl budgets. Initial configuration assigns `bharatorganicexpo.com` the advanced profile; this domain is configuration data rather than an engine condition. Existing studies keep their saved profile. Edit a study to change its profile or budget, then run it again.

Up to eight competitors can be selected. Content limits remain ten pages per site and fifty pages per run, shared across the primary website and competitors. Default concurrency is two sites and HTTP budget is 150 requests; redirect hops also consume that budget. Administrators can reduce these limits. Browser rendering is optional, and its resources use the protected fetch path. Forms are inspected but never submitted.

Advanced discovery is a durable background job with queued/running/completed/failed states, cancellation and retry. City/state/country searches require an explicit location. Up to sixteen candidates are examined under a fifty-request verification budget; up to eight qualifying suggestions are returned. Direct and adjacent candidates are labeled separately. Fewer than eight results is valid when sufficient evidence cannot be found. Discovery caches last seven days. Verification means observed brand/geography/business signals on public pages, not independent ownership, attendance or certification verification. Missing current dates/venues remain visible warnings.

## Reports

Original report tabs remain available. Advanced reports add twelve sections: overview; exhibitors; buyers/B2B; sponsorship; events/conferences; organic industry; SEO/digital marketing; conversion; trust; SWOT/gaps; priority roadmap; historical changes. Saved canonical findings drive the UI and PDF, and the email summary uses the same saved result. Hindi narrative uses the existing validated translation path; source quotations, URLs and published dates remain evidence. Facts, website claims and interpretations are distinguished. Private competitor traffic, revenue, leads and conversion rates are not invented. Search Console data is limited to the configured own property and removed from public reports.

Sharing supports expiry, revocation and view tracking. Task status, alerts, report history and scheduled checks use Mongo persistence. Email has a durable outbox with retry and stable Message-ID; SMTP delivery is at least once, so a crash after acceptance can still produce duplicate mail.

## Configuration

Use the existing database, authentication, SMTP and AI environment configuration. Optional analyzer variables:

- `COMPETITOR_ORGANISATION_NAME`, `COMPETITOR_REPORT_LOGO_URL`: report branding; a local logo fallback is included.
- `COMPETITOR_AI_DAILY_TOKENS`: durable daily token reservation limit, default 250000. Existing provider/cost/call limits also apply.
- `DNS_SERVERS`: optional comma-separated DNS server addresses for networks with a broken resolver. API and worker share the Windows loopback-resolver fallback; working network/VPN resolvers are preserved.
- `COMPETITOR_SEARCH_API_KEY` and `COMPETITOR_SEARCH_ENGINE_ID`: optional Google Custom Search candidate pool; `GOOGLE_SEARCH_API_KEY` / `GOOGLE_SEARCH_ENGINE_ID` are accepted fallbacks.
- `COMPETITOR_BROWSER_EXECUTABLE`: Chrome/Edge executable; `COMPETITOR_BROWSER_RENDERING_ENABLED=false` disables optional rendering.
- Own Search Console uses existing GSC OAuth/service-account configuration and property settings.

Without a search provider or configured AI, advanced discovery returns an actionable error rather than made-up candidates. Paid provider calls reserve budget before execution. Keep API keys on the backend. Do not enable the test-only fixture transport settings in production.

## API additions

Under `/api/competitor-analyzer` (also available through the existing `/api/v1` mount): `GET/PATCH /industry-settings`, `GET /suggest` with profile/scope/place, `POST /discovery/:runId/retry`, `POST /discovery/:runId/stop`. Existing study, report, PDF, sharing, schedule, tasks, alerts and usage APIs remain. Read requires `perm_analyzer_view`; mutations require analyzer management permission. Public report routes expose only a valid unexpired share token.

See the repository verification record in `docs/06-implementation/competitor-analyzer/verification.md` for the exact validation boundary.
