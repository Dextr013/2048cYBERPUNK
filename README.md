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
- Yandex Games: Zip the whole repo contents; ensure `index.html` is at the root. Optional: include Yandex SDK if needed. Game fires `gameready` event and calls `YaGames.adv.showFullscreenAdv` if available.
- Samsung Instant Play: Zip and upload. The game posts `{ type: 'game_ready' }` and calls `samsungInstant.setLoadingProgress(100)` if available; `Platform.submitScore(score)` will call `samsungInstant.setScore` when present.
- YouTube Playables: Zip and upload. The game calls `YTPlayable.gameReady()` when present. Keep assets local and under 10MB total if possible.

Controls:
- Keyboard: Arrows or WASD. R = restart.
- Touch: Swipe on the canvas.

Build:
- No build step required. Plain HTML5/ESM. Ensure your CDN or host serves with correct MIME types.