# piper_phonemize (emscripten module glue)

Vendored glue for the integrated Piper voice engine (`server/tts/piper.ts`).

Piper is a VITS text-to-speech model whose inputs are espeak-ng phoneme ids,
not text. The phonemizer that turns text into those ids (`piper-phonemize`,
wrapping espeak-ng) has no maintained native build that runs on macOS, Windows
and Linux without system dependencies, but it does have a complete emscripten
compile — published inside the npm package `piper-tts-web` (MIT).

## What lives here

- `piper_phonemize.cjs` — the emscripten MODULARIZE factory extracted from the
  published `piper-tts-web@1.1.2` bundle, plus an fs facade (see the header
  comment in that file for the exact edits). The `.cjs` extension is
  load-bearing: the module is CommonJS and the repository is
  `"type": "module"`.
- `LICENSE` — piper-tts-web's MIT license (the extracted code is theirs).

## What does NOT live here

`piper_phonemize.wasm` (~630 KB) and `piper_phonemize.data` (espeak-ng data,
~18 MB) are downloaded at first use by `server/tts/model-manager.ts`, pinned
to version `1.1.2` with sha256 checksums, from:

- https://unpkg.com/piper-tts-web@1.1.2/dist/piper/piper_phonemize.wasm
- https://unpkg.com/piper-tts-web@1.1.2/dist/piper/piper_phonemize.data

jsDelivr is deliberately NOT used: it serves a transformed wasm (observed
sha256 mismatch) and 403s the 18 MB data file. unpkg serves the registry
tarball's bytes exactly; the pins in model-manager.ts are the authority.

## Provenance and extraction

1. `npm pack piper-tts-web@1.1.2` (registry tarball, sha512-integrity checked
   by npm itself).
2. The `createPiperPhonemize` factory was extracted from
   `dist/piper-tts-web.js` by locating its top-level declarator with a JS
   parser (acorn) and slicing its source range — no hand editing of minified
   code. The two identifiers vite had stubbed for browser builds were
   rebound to real `fs`/`path` bindings via the facade.

`piper-phonemize` itself is MIT (rhasspy), but it statically links espeak-ng,
which is GPLv3. That is why the wasm/data artifacts are downloaded at first
use rather than committed: this repository and the shipped installers never
redistribute the GPL-derivative binaries; each user's machine fetches them
directly from the pinned URLs above.

## Upgrading

Bump the version in both the URLs and the sha256 pins together, re-extract
the factory from the new tarball, and re-run the unit tests plus the
verification fixture (`docs/verification/README.md`) — phoneme ids feed a
neural model directly, so a phonemizer regression is audible, not testable
by inspection.
