# 2048 Cybergrid

Run locally:

- Serve statically from the repo root. For example:
  `python3 -m http.server 8080` then open `http://localhost:8080/`.

Structure:
- `index.html` — entry point
- `styles.css` — neon cyber UI
- `src/` — JS modules (`main.js`, `modules/*`, `i18n/*`)
- Assets in repo root: `bg6.png`, `digit *.png`, music `.ogg`

Internationalization:
- Languages: `en`, `ru`. Switcher in the top bar.

Audio:
- Music is muted by default (policy safe). Toggle with the sound button.

Platforms:
- Yandex Games: SDK v2 is loaded dynamically when detected. Game signals ready and supports interstitial and rewarded ads, leaderboards, and cloud saves.
- Samsung Instant Play: Game posts `{ type: 'game_ready' }` and calls `samsungInstant.setLoadingProgress(100)` if available; `Platform.submitScore(score)` calls `samsungInstant.setScore` when present; cloud save attempts via available storage API (`saveData/setData/setItem`).
- YouTube Playables: Calls `YTPlayable.gameReady()`.

Yandex Extras:
- Interstitial: shown based on config.
- Rewarded: used for Continue after Game Over if enabled.
- Leaderboards: default id `score` (override with `?lb=YOUR_ID`).
- Cloud Save: syncs `save` and `best` using player data.

Ad Config (`src/config.js`):
- `interstitialOnNew` — boolean
- `interstitialOnRestart` — boolean
- `interstitialOnGameOver` — boolean
- `interstitialCooldownMs` — number (ms)
- `rewardedOnContinue` — boolean

UI Additions:
- "Sign In" button for Yandex auth; becomes "Signed In" after success.
- "Leaderboard" button opens a modal with top players (Yandex only). Others show empty list.

Controls:
- Keyboard: Arrows or WASD. R = restart.
- Touch: Swipe on the canvas.

Build:
- No build step required. Plain HTML5/ESM. Ensure your host serves correct MIME types.

## Tests

- Open `tests/index.html` in a browser via HTTP (not file://). It runs unit tests for core logic (move/merge/spawn/isGameOver).
- Or serve repo root and open `http://localhost:8080/tests/`.

## Dev server

- `npx http-server -p 8080 -c-1` then visit `http://localhost:8080/`.