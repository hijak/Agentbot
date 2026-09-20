# iOS companion architecture

The iOS app is a thin, native client for the Agentbot instance running on
your Mac. The Mac remains the only machine that persists agent processes,
credentials, SQLite data, transcripts, and computers. The iPhone trusts a Mac
by scanning the QR code shown in desktop **Settings → Remote access**; it does not need
an Agentbot account of its own.

## Current status

The first version includes:

- QR-first pairing from desktop **Settings → Remote access**, with the computer name
  confirmed on the iPhone before it connects.
- Tailscale and trusted-local QR routes, chosen explicitly.
- Nearby computers, a manual address, and a six-digit code under **Other ways
  to connect** when the QR path is unavailable.
- Secure per-device trust, device listing, and revocation.
- Multiple saved computers with a one-tap switcher. Each pairing has its own
  Keychain credential, and only the selected computer is connected at a time.
- Bot and room lists, paged transcripts, sending, interruption, and unread
  state.
- Approvals and questions, including narrow “always allow” grants.
- Resumable SSE, streamed reply text, reconnect hydration, and an opt-in live
  Box computer view. The loopback-only VPS SSH viewer remains desktop-only.
- Markdown rendering and Keychain storage for the phone's pairing trust.
- Secure completion of supported credential-request cards using iOS Password
  AutoFill and QR-pinned HPKE encryption. Apple Passwords/iCloud Keychain is
  sufficient; 1Password, Bitwarden, and other AutoFill providers are optional.

Alerts work while the app is open or for the short period it remains connected
after moving to the background. Once iOS suspends or closes the app, new alerts
cannot arrive. Closed-app push delivery, voice, and App Store release
automation are not part of this version.

The Mac must be running Agentbot and must not be asleep. Desktop
**Settings → Remote access** offers an off-by-default **Keep this computer awake**
switch that prevents system sleep while device access is on; the display may
still turn off. A sleeping or powered-off computer cannot receive phone
requests or run its local routines.

## Runtime architecture

```text
 iPhone (pairing trust in Keychain; credential plaintext only while editing)
        │ trusted LAN/Tailscale
        ▼
 sidecar :8810 (paired native devices; authenticated and allowlisted)
        │ loopback only
        ▼
 Agentbot harness :8799
   HTTP API + event stream
   agent processes and approvals
        │ private Electron utility-process channel
        ▼
 OS-encrypted desktop credential store
        │
        ▼
 SQLite message store + local configuration
```

There are three deliberately separate trust surfaces:

| Surface | Bind | Purpose |
|---|---|---|
| Harness | `127.0.0.1:8799` | Existing app API; remains loopback-only |
| Companion | `0.0.0.0:8810` | Paired native devices; authenticated and allowlisted |
| Companion control | `127.0.0.1:8811` | Start pairing, cancel pairing, list devices, revoke |

The desktop app owns the sidecar lifecycle through
`electron/companion.mjs`. The renderer only receives narrow IPC operations; it
does not fetch the control port directly.

## SQLite compatibility

SQLite does not move onto the phone. It is an implementation detail behind the
harness API:

- `server/message-db.ts` and `server/store.ts` persist and page transcripts.
- The phone asks for `GET /api/bots?messages=50` and
  `GET /api/threads/:threadId/messages?before=…&limit=50`.
- SQLite ordering and cursors are therefore tested at the server boundary,
  while the Swift package tests decoding and prepend/deduplication using
  responses captured through the real sidecar.
- A storage migration may change the bytes on disk without changing the app.
  If an API payload changes, regenerate the fixtures with
  `node scripts/capture-companion-fixtures.mjs` and review the diff.

The sidecar keeps its device registry in `~/.agentbot/devices.json`. That is
security state owned by the network boundary, not transcript data, so it does
not belong in the message database.

## Connectivity

### Same Wi-Fi

The QR code is still the primary path on the same Wi-Fi. If it is unavailable,
the user can open **Other ways to connect** and choose a nearby computer or
enter the address shown in desktop Settings → Remote access. Nearby discovery does not
run until the user opens that fallback.

Nearby discovery uses Bonjour and direct LAN traffic. Use it only on a network
you trust.

Choosing a nearby computer or manually entering a LAN address is therefore an
explicit fallback. Once the app is using a Tailscale route,
automatic reconnection stays within those protected transports. Moving back to
direct LAN requires choosing that computer or address again.

### Tailscale

Tailscale is the route away from home and on Wi-Fi networks that
isolate clients. Install or open Tailscale
on both devices, sign in to the same tailnet, leave MagicDNS enabled, and
choose **Turn on device access & check** followed by **Pair over Tailscale**.
That first action explicitly starts Remote access so the phone has a listener
to reach. Agentbot then places the computer's MagicDNS name in that
dedicated QR.
Manual entry remains available as a fallback.

The URL is still `http`, but the path is encrypted and authenticated by
WireGuard inside the tailnet. Use the MagicDNS name rather than the
`100.64.0.0/10` address: App Transport Security exceptions are domain-based,
and `ios/project.yml` narrowly allows insecure HTTP for `ts.net` subdomains.

Tailscale is optional. The direct path does not use an Agentbot-operated
relay or create a cloud copy of local transcript data.

### Remote HTTPS (removed)

The previously offered hosted HTTPS route — a managed tunnel provisioned
after a passwordless email sign-in — has been removed. Pair over Tailscale
or a trusted local network instead. The control plane no longer provisions
tunnel or DNS resources for new installations; see `docs/ios-privacy.md`
for what account data remains.

## Pairing and device security

1. On the Mac, open **Settings → Remote access** and choose **Pair a phone**. The app
   starts device access as part of setup.
2. On the iPhone, choose **Connect my computer** and scan the QR.
3. Confirm the computer name and the displayed transport —
   **Tailscale connection** or **Trusted local connection**. The phone stores
   its trust securely in Keychain; no iPhone account is required. A camera QR
   also pins that computer's public credential-encryption key. Manual and old
   pairings can still chat, but must scan a fresh QR before entering a key on
   the phone.
4. If scanning is unavailable, open **Other ways to connect** for a nearby
   computer, manual address, or six-digit code.
5. Revoking the phone on the Mac removes its access and lets it pair again.

To add another Mac, open **Settings → Computers → Connect another computer**
on the iPhone and scan that Mac's QR. The existing computer stays usable if
the new pairing fails or is cancelled. Switching computers replaces the live
event stream and in-memory chat state, but keeps every saved pairing; removing
one computer deletes only that computer's Keychain credential from the phone.
An app upgrade migrates the previous single saved pairing automatically.

The Mac must remain awake with Agentbot running for chats, approvals, and
routines to work, including over Tailscale.

After pairing, the phone periodically reads the authenticated, sidecar-owned
`GET /api/companion/endpoints` snapshot. This lets an existing phone learn
a changed Tailscale address without another pairing ceremony. The
route never reaches the harness and returns only the computer name plus a
bounded list of connection origins.

No Agentbot account is required: nearby, manual, and Tailscale
connections all use the same QR trust flow on the iPhone.

### Secure credential entry

This is Password AutoFill, not a password-vault integration. A native
`SecureField` marked as a password lets the user explicitly choose Apple
Passwords or any enabled third-party AutoFill provider. AgentbotMobile does
not enumerate a vault, receive a provider token, or save the entered value in
its own Keychain.

The packaged desktop creates one stable P-256 recipient key pair and keeps the
private JWK inside its operating-system-encrypted credential document. Only the
65-byte uncompressed public point is added to a camera QR. The phone validates
and pins that point with the connection; manual and older pairings remain fully
usable for chat but cannot submit a credential until they scan a fresh QR.

Credential submission is enabled only while the phone is using
a Tailscale route. Local and Bonjour chat pairing still work as before, but
their cleartext HTTP transport would expose the reusable device token to anyone
who could observe that Wi-Fi network, so the app directs the user to finish the
credential request on the computer instead.

Each submission uses RFC 9180 base-mode HPKE with P-256/HKDF-SHA256/AES-GCM-256
and authenticates this exact newline-separated context:

```text
agentbot-phone-credential-v1
<key id>
<authenticated companion device id>
<bot id>
<thread id>
<message id>
<credential target>
<one-time request key>
```

The companion replaces any caller-supplied device header with the identity of
the bearer token it authenticated. The harness accepts only an allowlisted
target on the exact pending card, opens the ciphertext through its private
Electron channel, and waits for the encrypted desktop store and live config to
commit before it marks the card complete. Replays are idempotent; moving a
ciphertext to another device, bot, task, card, target, or computer fails
authentication. The native field is cleared immediately after local
encryption. If the response is interrupted, the app retains only that exact
ciphertext in memory and reuses it for Retry, so HPKE randomness cannot turn a
network retry into a second credential write. Nothing is persisted on the
phone. Development servers deliberately have no recipient key and fail closed
instead of advertising an unusable secure-entry route.

The device-facing socket rejects browser `Origin` headers before reading a
token. Its route policy in `companion/src/routes.ts` is default-deny: a new
harness route remains unreachable until it is deliberately added.

Allowed in the first release:

- Read the fleet, rooms, instances, configuration status, and transcripts.
- Fetch settled screen images and opt into live screen frames.
- Request a fresh interactive cloud-desktop viewer only when the computer
  owner has enabled that capability for this specific paired phone.
- Send messages, interrupt bots, answer approvals/questions, and mark chats
  read.
- Create a basic bot.
- Submit a supported pending credential card as an RFC 9180 HPKE envelope
  bound to the authenticated device, bot, task, message, request, and target.
   Only the paired packaged desktop's embedded server and Electron private
   process channel receive the private key or plaintext; the sidecar,
   chat transcript, and SQLite store see ciphertext or status only.

The write surface uses purpose-built `read` and `always-allow` endpoints. The
general bot and room `PATCH` endpoints are not reachable through the sidecar.
An always-allow request succeeds only when its server-issued key is still on a
pending approval for that bot, so possession of a device token is not enough
to invent a broad execution grant.

Intentionally refused:

- Reading credentials, arbitrary credential targets, and general provider
  configuration. The only credential write is the exact pending-card envelope
  above, and it feeds the existing desktop OS-encrypted save path.
- Pairing, device revocation, or companion lifecycle control.
- Local VM lifecycle, webhooks, connectors, routines, team import/export, and
  internal peer-agent routes.
- Cloud computer provisioning, sleep, shell execution, and screenshot APIs.
  The phone receives only the fresh `join` viewer URL, never the provider key.
- New harness routes that have not been reviewed for device access.

## Stream and state model

`CompanionCore` contains the wire models, client, raw-byte SSE parser, and pure
state fold. The SwiftUI target owns lifecycle and presentation only.

On connection, the server sends a `hello` frame containing a cursor and whether
the requested gap was replayed. The client:

1. resumes from its last `<streamId>:<seq>` cursor;
2. folds replayed and live frames when the gap is available;
3. hydrates the newest page of each visible conversation when it is not; and
4. paginates older transcript pages on demand.

Unknown message and frame kinds degrade safely instead of failing an entire
response, and one malformed fleet record does not hide every healthy chat.
Screen frames are off by default and enabled only while a computer view is
visible. Backgrounding keeps the stream for only the short grace period iOS
allows, then closes it; foregrounding reconnects from the saved cursor. A hello
cursor is committed only after a cold hydration succeeds; replayed streams
advance it one folded frame at a time, so a disconnect during recovery cannot
skip the remaining gap.

## Source layout

```text
companion/
  src/routes.ts       device-facing allowlist
  src/devices.ts      pairing and token registry
  src/proxy.ts        HTTP/SSE forwarding and scrubbing
  src/origin.ts       private per-launch hosted origin listener
  src/control.ts      loopback-only control plane
  src/mdns.ts         Bonjour advertisement

ios/
  Sources/CompanionCore/   models, HTTP, SSE, state fold
  Tests/CompanionCoreTests/ captured-contract and core tests
  App/                     SwiftUI, lifecycle, discovery, Keychain
  project.yml              generated Xcode project specification
```

## Verification contract

The merge gate for this feature is:

```sh
pnpm typecheck
pnpm test
pnpm build:companion
pnpm check:electron

cd ios
swift test
xcodegen generate
xcodebuild -project AgentbotCompanion.xcodeproj \
  -scheme AgentbotCompanion \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO build
```

The simulator validates compilation, launch, layout, manual address parsing,
and failure states. Bonjour, Local Network permission, Tailscale routing,
Keychain behavior across a reboot, and approval delivery still require a real
iPhone pass.

## Follow-on releases

Keep the foundational merge separate from capabilities that widen security or
distribution scope:

1. **Foundation:** sidecar, desktop controls, Swift core/app, pairing, chat,
   approvals, reconnect, simulator and contract CI.
2. **Desktop conversation parity:** task create/switch/rename/delete, SQLite
   search with exact-message landing, transcript export/share, reactions, and
   edit/version controls. Archived or hidden chat management remains desktop-only.
3. **Notifications:** native permission, live/replayed alerts, time-sensitive
   approvals, badges, and a brief background grace period are in the app.
   Closed-app delivery still requires project-owned APNs credentials;
   Tailscale cannot wake a terminated iOS process.
4. **Distribution:** signing, bundle ownership, privacy declarations,
   TestFlight, and App Store review material. Swift tests and an unsigned
   simulator build already run in the repository CI.
5. **Optional expansion:** voice/call mode or Local VM/host-computer
   interaction. Each requires its own threat-model review.
