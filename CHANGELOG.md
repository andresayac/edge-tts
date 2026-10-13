# Changelog

## Unreleased

### Fixed
- An unsupported voice or output format rejects with `REFUSED` and the reason the service gives, such as "Unsupported voice xx-XX-NobodyNeural.", instead of resolving and failing later with "No audio data available".
- An empty text rejects with `INVALID_OPTION` without connecting.

## 1.9.0

Everything from 1.8.x keeps working: same methods, same signatures and the same error messages.

### Added
- `new EdgeTTS(options)`: `wssUrl`, `voicesUrl`, `secMsGecVersion`, `headers`, `timeout` and `voicesCacheTtl`, so a change on Microsoft's side can be handled without a new release.
- `generate()` returns the audio, the word and sentence boundaries and the duration in its own object, so one instance can run several syntheses at once.
- Sentence boundaries (`getSentenceBoundaries()`) and subtitles: `toSRT()`, `toVTT()`, and the `toSRT` / `toVTT` functions. Opening punctuation such as ¿ and ¡, which the service drops, is restored.
- `EdgeTTSError` with a `code` (`HANDSHAKE`, `NETWORK`, `TIMEOUT`, `NO_AUDIO`, `INVALID_OPTION`, `VOICES`) and `status` when there is one. Messages are unchanged; Node.js network errors pass through untouched.
- `signal` (`AbortSignal`) and `timeout` per call.
- Node.js: when the computer's clock is off and the service refuses the connection, the time is read from the server and the connection retried once.
- The voice list is cached for 10 minutes per instance.
- Browser: word and sentence boundaries, `outputFormat`, `generate()` and subtitles. `examples/relay-server.mjs` lets Chrome, Firefox and Safari synthesize through a relay.
- CLI: `--format`, `--subtitles`, `-f -` to read from stdin, and `voice-list --locale --gender`.

### Fixed
- Node.js 18: every call failed with `crypto is not defined`.
- `toFile('speech.mp3')` wrote `speech.mp3.mp3`.
- Leaving a `synthesizeStream()` loop early kept the connection open until the service finished.
- An invalid `pitch`, `rate` or `volume` opened a connection before failing and never closed it.
- The no-audio error now also points at the output format when it is not one the service supports.
- The CLI version is read from `package.json`.
- The README listed 36 output formats; the service accepts three.

## 1.8.3

- Synthesis goes through `api.msedgeservices.com`; the old endpoint answers 403 since October 2026.
- Headers match Edge 155.
- Removed the `typescript` peer dependency, which blocked installing with TypeScript 7 (#22), and the unused `@types/uuid`, `events` and `fs` dependencies.
- TLS certificates are verified.
- Word boundaries are reset on each synthesis.
- `getDuration()` was 12 times too short.
- Browser: the last audio chunks could be lost.
- CLI errors are reported without a stack trace.
