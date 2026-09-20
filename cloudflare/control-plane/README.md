# Agentbot control plane

This directory is an isolated Cloudflare Worker for cloud account identity
and installation ownership. It does **not** store or move local bots, chats, desktop SQLite state, prompts, or
tool output.

## What is included

- Better Auth 1.7.1 with email OTP, signed bearer sessions, hashed OTP storage,
  and D1-backed IP plus recipient rate limits.
- A Cloudflare Email Sending binding that produces both HTML and plain-text OTP
  messages. Authentication responses remain generic even when delivery fails;
  email addresses, OTPs, secrets, and provider errors are never logged.
- Owner-scoped desktop installations and independently revocable
  `omb_install_…` credentials. Account bearer tokens are never accepted as
  installation credentials, or vice versa.
- Exact-origin CORS, bounded JSON bodies, redacted errors, and `no-store` on
  every response.
- No managed-tunnel provisioning: the per-installation remotely managed
  endpoint surface has been removed. Reach a server over Tailscale
  (`serve --tailscale`), an own domain (`serve --domain`), or a
  reverse proxy (`serve --public-url`) instead.
- D1-backed generation/lease claims, recovery by stable opaque tunnel name, and
  retryable partial cleanup. Cloudflare API credentials and raw connector
  tokens are never written to D1 or logs.

The D1 schema is pinned in `migrations/`. `0001_better_auth_1_7_1.sql` was
generated from the exact Better Auth configuration. `0002_installations.sql`
contains only cloud ownership and credential metadata. `0003` adds a
recipient-scoped OTP limiter whose keys are HMACs rather than email addresses,
plus an authenticated installation-creation limiter. `0004` adds managed
endpoint resource IDs, lifecycle state, generation leases, redacted error
codes, and installation-scoped action limits. `0005` adds the cleanup-attempt
counter used for scheduled retry backoff. Endpoint rows deliberately do not
cascade away with a hard installation deletion: losing the tunnel and DNS IDs
would make operator cleanup impossible.

## API surface

| Method | Path | Authentication |
| --- | --- | --- |
| `GET` | `/healthz` | none |
| any | `/api/auth/*` | Better Auth |
| `GET` | `/v1/me` | account bearer |
| `GET`, `POST` | `/v1/installations` | account bearer |
| `POST` | `/v1/installations/:id/credentials/rotate` | owning account bearer |
| `DELETE` | `/v1/installations/:id` | owning account bearer |
| `GET` | `/v1/installations/self` | installation credential |

Installation registration requires a stable `clientInstanceId`, a display
`name`, and a `platform` of `darwin`, `windows`, or `linux`; `appVersion` is
optional. A client ID is unique among one account's active installations. After
revocation, that account may register the stable ID again. Other accounts may
independently use the same client ID. An account may have at most 100 active
installations, matching the complete management-list limit. Creation is also
limited to 100 attempts per account per hour.

Raw installation credentials contain a random lookup ID plus 32 random bytes.
Only a SHA-256 digest is stored, and the raw value is returned only when an
installation is created or its credential is rotated. Credentials expire after
90 days even if they are not revoked; the response includes their expiry so a
signed-in desktop can rotate ahead of time. `/v1/installations/self` rejects
expired credentials and records both credential use and installation
`lastSeenAt`. Rotations are serialized with a one-minute cooldown, so concurrent
requests cannot both return credentials while one invalidates the other.

### Managed endpoints (removed)

The `GET`, `POST`, and `DELETE /v1/installations/self/endpoint` methods and
their tunnel/DNS provisioning once reserved one remotely managed endpoint
per installation. That surface has been removed: no new tunnel or DNS
resources are provisioned, and servers are reached over Tailscale, an own
domain, or a reverse proxy instead. The notes below are preserved as the
historical contract and do not describe an offered API.

- `GET` returned `{ "endpoint": null }` before allocation or after deletion.
  Otherwise it returned the HTTPS URL, hostname, lifecycle status, generation,
  timestamps, and a redacted `lastErrorCode`. It never returned a connector
  token.
- `POST` had no required body. It idempotently reserved or reconciled the
  endpoint and returned `{ endpoint, connectorToken }`.
- `DELETE` removed DNS first and then the tunnel, returning `204` when done or
  when already deleted.

Hostnames had exactly one opaque label in front of the configured suffix.
Endpoint provisioning was lease-serialized per installation with bounded
retries and scheduled cleanup of expired leases.

## Local checks

Install from the repository root, then run:

```sh
pnpm control-plane:check
pnpm control-plane:test
pnpm control-plane:dry-run
```

For local manual development, copy `.dev.vars.example` to `.dev.vars`, replace
`BETTER_AUTH_SECRET` with at least 32 cryptographically random bytes, provide a
non-production scoped `CLOUDFLARE_API_TOKEN`, apply the migrations locally, and
start Wrangler:

```sh
pnpm --filter @agentbot/control-plane exec wrangler d1 migrations apply DB --local --config wrangler.jsonc
pnpm --filter @agentbot/control-plane exec wrangler dev --config wrangler.jsonc
```

Do not commit `.dev.vars`.

## Production blockers

The checked-in Wrangler file is intentionally non-deployable production
scaffolding. No remote resource was created or changed while preparing it.
Before a production deployment, an operator must:

1. Choose and route an HTTPS hostname, then replace `BETTER_AUTH_URL`. The
   Worker has `workers_dev` disabled and no production route in this PR.
2. Generate a strong production `BETTER_AUTH_SECRET` and add it with Wrangler's
   interactive secret command. Add `CLOUDFLARE_API_TOKEN` the same way. The
   checked-in `secrets.required` names validate local configuration and generate
   binding types; they do not contain or upload values.
3. Create the D1 database, replace the all-zero `database_id`, review the pinned
   migrations, and apply them to that database.
4. Complete Cloudflare Email Sending domain onboarding, replace the placeholder
   sender in both `EMAIL_FROM` and `allowed_sender_addresses`, and grant the
   deployment identity access to the binding. The Cloudflare session used while
   preparing this code could not list Email Sending (`2036 Unauthorized`), so no
   domain or binding activation was attempted.
5. Replace `ALLOWED_ORIGINS` with a comma-separated allow-list of exact HTTPS
   application origins. Wildcards are deliberately unsupported.
6. Deploy the Worker and verify that `GET <BETTER_AUTH_URL>/healthz` returns
   exactly `{ "ok": true, "service": "agentbot-control-plane" }` over
   HTTPS before shipping the desktop build.

The control-plane API token is never handed to a desktop. The public companion
service still enforces its own pairing and application authentication. This
control plane does not collect marketing consent.
