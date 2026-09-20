# AgentbotMobile privacy

AgentbotMobile is a companion for an Agentbot service chosen and operated
by the user. Local Wi-Fi and Tailscale connections work without an Agentbot
account.

## Data handling

- The iOS app stores the selected computer address in iOS preferences and its
  pairing token in the iOS Keychain.
- The iOS Share extension can access that selected computer metadata through a
  private App Group and its pairing token through a shared Keychain access
  group. No other app receives those values.
- The computer remains the source of bots, transcripts, approvals, credentials,
  SQLite data, and screen images. Agentbot's hosted control plane does not
  store a copy of that content.
- When a user completes a supported credential request on the phone, the value
  exists only in the native secure field long enough to encrypt it with the
  public key pinned by that computer's QR code. The app clears that field
  immediately after encryption. It may keep the resulting ciphertext in memory
  long enough to retry the exact same operation after an interrupted response;
  that ciphertext is never persisted and is discarded when the app exits.
   Submission is available only
   through Tailscale, not cleartext LAN or Bonjour HTTP. The
   sidecar receives an HPKE ciphertext, not the value.
  Only the paired packaged
  desktop processes receive the private key: the embedded server decrypts and
  passes the value over Electron's private process channel to commit through
  the same operating-system-encrypted store used by Settings. The value is not
  written to
  iOS preferences or Keychain by AgentbotMobile, chat, SQLite, logs, or the
  hosted control-plane database. The user's chosen Password AutoFill provider
  may separately store it under that provider's own settings and privacy terms.
- On a local Wi-Fi or Tailscale connection, phone traffic goes directly to the
  user's computer. Tailscale is a separate service with its own privacy terms.
- If the desktop user enables optional hosted access, Agentbot stores the
  account email address, an internal account ID, and computer installation
  metadata: an opaque installation ID, opaque client ID, computer display name,
  operating system, app version, status, and security timestamps.
  These records are used only for sign-in, ownership, abuse prevention,
  provisioning, revocation, support, and reliability.
- The managed-tunnel remote route has been removed: the desktop no longer
  runs an outbound connector, and no tunnel or DNS resources are provisioned
  for new installations. No message, approval, transcript, screen-frame, or
  token content was ever written to the Agentbot control-plane database.
- Pairing and device tokens are not stored in the hosted control-plane
  database.
- When a user explicitly chooses Agentbot from another app's Share sheet, or
  uses the attachment button in a chat, the selected text, link, image, or
  supported document is sent to the bot or room the user confirms. Images and
  documents are stored in the attachments directory on the user's computer with
  generated names and owner-only file permissions. Individual images are
  limited to 10 MiB, documents to 25 MiB, and one message to four items and
  50 MiB total. The computer refuses new uploads after 512 MiB of attachments
  rather than silently deleting files referenced by older conversations.
  In-chat selections remain in memory until the message succeeds or the draft
  is discarded. Temporary Share-extension copies are removed after a completed
  send or cancellation. If iOS terminates the extension mid-transfer, the next
  Share sheet session removes the abandoned copy immediately; an AgentbotMobile
  foreground launch removes it once it is at least 60 minutes old.
- Opening a file link sent by a bot requests that exact file from the paired
  computer over the selected authenticated companion connection. The app keeps
  a temporary local preview only while it is open, then removes it. Ordinary
  web links continue to open in the system browser. The hosted control plane
  does not store either the source file or its preview.
- The app contains no advertising or analytics SDKs, does not track users
  across other companies' apps or websites, and does not sell personal data.

Local HTTP connections should only be used on a network the user trusts.
Tailscale access is the encrypted alternative for untrusted or
remote networks; it does not make a sleeping or powered-off computer reachable.

## Retention, control, and deletion

Unpairing removes the computer address and pairing token from the phone.
Revoking the phone in Agentbot's Companion settings invalidates that device
credential. Transcript deletion is controlled by the Agentbot installation
that stores the transcript.

Signing out of optional hosted access stops advertising the hosted address
and revokes the computer installation credential. Account email, account identifiers,
installation/security metadata, and operational records are retained while
needed to operate and protect the service, and otherwise until the account
holder asks for deletion. Some minimal records may be retained when required
for security, fraud prevention, dispute resolution, or law.

To request a copy or deletion of hosted account data, open an
[Agentbot Support](https://github.com/milind-soni/Agentbot/issues) request
without posting an OTP, pairing code, device token, or other
secret. The maintainer will provide a private way to verify control of the
email address. Deleting hosted account data does not delete transcripts stored
on the user's own computer.

## Support

Privacy questions can be opened at
[Agentbot Support](https://github.com/milind-soni/Agentbot/issues).
