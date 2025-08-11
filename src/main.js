import { loadI18n, setLanguage, populateLanguageSelect, t } from './modules/i18n.js'
import { AudioManager } from './modules/audio.js'
import { Game } from './modules/game.js'
import { Renderer } from './modules/renderer.js'
import { Input } from './modules/input.js'
import { Platform } from './modules/platform.js'
import { AdConfig } from './config.js'
import { Achievements } from './modules/achievements.js'

// Prevent page scrolling globally
try {
  window.addEventListener('wheel', (e) => { e.preventDefault() }, { passive: false })
  window.addEventListener('touchmove', (e) => { e.preventDefault() }, { passive: false })
} catch {}

const canvas = document.getElementById('game-canvas')
const ctx = canvas.getContext('2d', { alpha: true })
const container = document.querySelector('.game-container')

const state = {
  started: false,
  lastTs: 0,
  locale: 'ru',
  lastInterstitial: 0,
  achievements: null,
  audio: null,
  mode: 'classic',
  timerMs: 0,
  hardInterval: null,
  startedAt: 0,
  reached512At: null,
  enduranceShown: false,
}

function setUiTexts() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n')
    el.textContent = t(key)
  })
  const pl = document.getElementById('preloader-text')
  if (pl) pl.textContent = t('loading')
  // Force game name everywhere
  try { document.title = t('title') } catch {}
}

function tryShowInterstitial() {
  const now = Date.now()
  if (now - state.lastInterstitial < AdConfig.interstitialCooldownMs) return
  state.lastInterstitial = now
  Platform.showInterstitial().catch(() => {})
}

async function withTimeout(promise, ms) {
  return await Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

function applyModeUi() {
  const timerWrap = document.getElementById('timer-wrap')
  if (timerWrap) timerWrap.style.display = state.mode === 'timed' ? 'flex' : 'none'
}

function formatTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

async function boot() {
  // Load i18n but cap its wait time to avoid blocking paint
  try {
    await withTimeout(loadI18n(['en', 'ru']), 1500)
  } catch {}
  const prefer = Platform.getLocale?.() || navigator.language || 'en'
  setLanguage(prefer.startsWith('ru') ? 'ru' : 'en')
  const langSelect = document.getElementById('lang-select')
  if (langSelect) populateLanguageSelect(langSelect)
  setUiTexts()

  // If Yandex SDK is already present (pre-injected by container), signal ready ASAP
  try {
    if (window.YaGames?.init) {
      const y = await window.YaGames.init()
      y?.features?.LoadingAPI?.ready?.()
    }
  } catch {}

    const audio = new AudioManager([
    { id: 'bgm1', src: 'Nightwalk.ogg', type: 'music' },
    { id: 'bgm2', src: 'minimum.ogg', type: 'music' },
    { id: 'bgm3', src: 'malfunction.ogg', type: 'music' },
  ])
  state.audio = audio
  // Restore saved audio prefs without downloading large files yet
  try {
    const vol = Number(localStorage.getItem('volume'))
    if (!Number.isNaN(vol)) audio.setVolume(vol / 100)
    const tid = localStorage.getItem('trackId')
    if (tid) audio.setCurrentId(tid)
  } catch {}

  // Restore mode
  try {
    const m = localStorage.getItem('mode')
    if (m === 'classic' || m === 'timed' || m === 'hard') state.mode = m
  } catch {}

  const game = new Game()
  const renderer = new Renderer(canvas)
  const input = new Input(canvas)
  input.onUndo = () => doUndo()
  input.onRedo = () => doRedo()
  input.onHint = () => doHint()
  const achievements = new Achievements()
  state.achievements = achievements

  // UI wiring
  const btnNew = document.getElementById('btn-new')
  if (btnNew) btnNew.addEventListener('click', async () => {
    if (AdConfig.interstitialOnNew) tryShowInterstitial()
    startNewRun(game, renderer)
    state.audio.playRandomBgm()
    hideOverlay()
    saveState(game)
    tick(performance.now())
  })

  // Undo/Redo/Hint buttons
  const btnUndo = document.getElementById('btn-undo')
  const btnRedo = document.getElementById('btn-redo')
  const btnHint = document.getElementById('btn-hint')
  if (btnUndo) btnUndo.addEventListener('click', () => doUndo())
  if (btnRedo) btnRedo.addEventListener('click', () => doRedo())
  if (btnHint) btnHint.addEventListener('click', () => doHint())
  const btnRestart = document.getElementById('btn-restart')
  if (btnRestart) btnRestart.addEventListener('click', async () => {
    if (AdConfig.interstitialOnRestart) tryShowInterstitial()
    startNewRun(game, renderer)
    hideOverlay()
    saveState(game)
    tick(performance.now())
  })
  const btnContinue = document.getElementById('btn-continue')
  if (btnContinue) btnContinue.addEventListener('click', async () => {
    const wasGameOver = document.getElementById('overlay-title')?.textContent === t('gameOver')
    if (wasGameOver && AdConfig.rewardedOnContinue) {
      const ok = await Platform.showRewarded()
      if (!ok) return
    }
    hideOverlay()
  })

  const btnSound = document.getElementById('btn-sound')
  if (btnSound) btnSound.addEventListener('click', () => {
    const next = !(btnSound.getAttribute('aria-pressed') === 'true')
    btnSound.setAttribute('aria-pressed', String(next))
    audio.setEnabled(next)
    if (next) audio.playRandomBgm()
  })

  const langSel = document.getElementById('lang-select')
  if (langSel) langSel.addEventListener('change', (e) => {
    const val = e.target.value
    setLanguage(val)
    setUiTexts()
    // Refresh dynamic lists
    populateTrackSelect(audio)
    renderAchievementsList(achievements)
  })

  const modeSel = document.getElementById('mode-select')
  if (modeSel) {
    if (state.mode === 'hard') state.mode = 'classic'
    modeSel.value = state.mode
    modeSel.addEventListener('change', (e) => {
      state.mode = e.target.value
      try { localStorage.setItem('mode', state.mode) } catch {}
      applyModeUi()
      startNewRun(game, renderer)
    })
  }

  const sizeSel = document.getElementById('size-select')
  if (sizeSel) {
    sizeSel.value = String(game.size)
    sizeSel.addEventListener('change', (e) => {
      const ns = Number(e.target.value)
      if (game.resize(ns)) {
        startNewRun(game, renderer)
        updateHud(game)
      }
    })
  }

  const btnAuth = document.getElementById('btn-auth')
  if (btnAuth) btnAuth.addEventListener('click', async () => {
    const ok = await Platform.auth()
    if (ok) {
      btnAuth.disabled = true
      btnAuth.textContent = t('signedIn')
      const cloud = await Platform.cloudLoad()
      if (cloud) { game.setState(cloud); updateHud(game) }
    }
  })
  const btnLb = document.getElementById('btn-lb')
  const btnLbClose = document.getElementById('btn-lb-close')
  if (btnLb) btnLb.addEventListener('click', async () => {
    openLeaderboard()
    await renderLeaderboard()
  })
  if (btnLbClose) btnLbClose.addEventListener('click', closeLeaderboard)

  // Settings overlay wiring
  const btnSettings = document.getElementById('btn-settings')
  const settingsOverlay = document.getElementById('settings-overlay')
  const btnSettingsClose = document.getElementById('btn-settings-close')
  const volumeRange = document.getElementById('volume-range')
  const trackSelect = document.getElementById('track-select')
  const btnNextTrack = document.getElementById('btn-next-track')
  const btnPrevTrack = document.getElementById('btn-prev-track')
  const btnAchievements = document.getElementById('btn-achievements')
  if (btnSettings) btnSettings.addEventListener('click', () => { settingsOverlay?.classList.remove('hidden') })
  if (btnSettingsClose) btnSettingsClose.addEventListener('click', () => { settingsOverlay?.classList.add('hidden') })
  if (volumeRange) {
    try {
      const vol = Number(localStorage.getItem('volume'))
      if (!Number.isNaN(vol)) volumeRange.value = String(vol)
    } catch {}
    volumeRange.addEventListener('input', (e) => {
      const v = Number(e.target.value)
      audio.setVolume(v / 100)
      try { localStorage.setItem('volume', String(v)) } catch {}
    })
  }
  if (trackSelect) {
    populateTrackSelect(audio)
    trackSelect.addEventListener('change', async (e) => {
      const id = e.target.value
      await audio.play(id)
      ensureSoundToggleReflects(btnSound, audio)
    })
  }
  if (btnNextTrack) btnNextTrack.addEventListener('click', async () => { await audio.nextTrack(); selectCurrentTrack(trackSelect, audio) })
  if (btnPrevTrack) btnPrevTrack.addEventListener('click', async () => { await audio.prevTrack(); selectCurrentTrack(trackSelect, audio) })
  if (btnAchievements) btnAchievements.addEventListener('click', () => { renderAchievementsList(achievements); openAchievements() })

  // Achievements overlay
  const achOverlay = document.getElementById('ach-overlay')
  const btnAchClose = document.getElementById('btn-ach-close')
  if (btnAchClose) btnAchClose.addEventListener('click', () => { achOverlay?.classList.add('hidden') })
  achievements.onUnlock = (def) => {
    showToast(t('achievementUnlocked', { name: t(def.id) }))
    renderAchievementsList(achievements)
  }

  // Input -> Game actions
  let inputLocked = false
  const undoStack = []
  const redoStack = []

  input.onMove = async (dir) => {
    if (inputLocked) return
    if (state.mode === 'timed' && state.timerMs <= 0) return
    const prev = game.getState()
    const result = game.move(dir)
    if (result.moved) {
      // stacks
      undoStack.push(prev)
      redoStack.length = 0
      state.audio?.playSfx('move')

      inputLocked = true
      if (result.moves?.length) await renderer.animateSlides(result.moves)
      // Visuals
      if (result.mergesPositions?.length) {
        renderer.bumpTiles(result.mergesPositions)
        renderer.queueMergeEffect(result.mergesPositions)
        state.audio?.playSfx('merge')
      }
      if (result.spawnedAt) {
        renderer.pulseSpawn(result.spawnedAt[0], result.spawnedAt[1])
        renderer.queueSpawnEffect(result.spawnedAt[0], result.spawnedAt[1])
        state.audio?.playSfx('spawn')
      }

      if (result.mergesCount >= 2) {
        showToast(`${t('combo')} ${result.mergesCount}!`)
      }
      if (!state.reached512At && getMaxTile(game) >= 512) {
        const elapsed = Date.now() - state.startedAt
        state.reached512At = Date.now()
        if (elapsed <= 30000) showToast(t('fast512'))
      }

      updateHud(game)
      saveState(game)
      achievements.check(game)
      if (result.won) { showOverlay(t('youWin'), t('mergeTo', { value: 2048 })); Platform.submitScore(game.score) }
      else if (game.isGameOver()) { showOverlay(t('gameOver'), t('noMoves')); Platform.submitScore(game.score); if (AdConfig.interstitialOnGameOver) tryShowInterstitial() }
      inputLocked = false
    }
  }

  function doUndo() {
    if (!undoStack.length) return
    const cur = game.getState()
    const prev = undoStack.pop()
    redoStack.push(cur)
    game.setState(prev)
    updateHud(game)
  }
  function doRedo() {
    if (!redoStack.length) return
    const cur = game.getState()
    const next = redoStack.pop()
    undoStack.push(cur)
    game.setState(next)
    updateHud(game)
  }
  function doHint() {
    const hint = suggestMove(game)
    if (hint) showToast(`Hint: ${hint}`)
  }

  input.onRestart = () => document.getElementById('btn-restart')?.click()

  // Resize
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const vw = Math.max(320, Math.min(window.innerWidth, 1920))
    const vh = Math.max(320, Math.min(window.innerHeight, 1920))

    // Prefer container bounds; container keeps square via CSS aspect-ratio
    let cw = vw, ch = vh
    if (container) {
      const cb = container.getBoundingClientRect()
      if (cb.height > 0) { cw = cb.width; ch = cb.height }
    }

    const side = Math.floor(Math.min(cw, ch))

    canvas.style.width = `${side}px`
    canvas.style.height = `${side}px`
    canvas.width = Math.floor(side * dpr)
    canvas.height = Math.floor(side * dpr)
    renderer.setDpr(dpr)
  }
  window.addEventListener('resize', resize)
  resize()

  // Reveal UI as soon as possible (cancel safety timeout if present)
  document.getElementById('preloader')?.classList.add('hidden')
  document.getElementById('app')?.classList.remove('hidden')
  if (window.__boot_timeout) { clearTimeout(window.__boot_timeout); window.__boot_timeout = null }

  // Set background on separate layer (#bg-layer) - supports ?bg=URL
  try {
    const bgLayer = document.getElementById('bg-layer')
    if (bgLayer) {
      const q = new URLSearchParams(location.search)
      const customBg = q.get('bg')
      const defaultBg = 'https://avatars.mds.yandex.net/get-games/1892995/2a00000198578acfc08bd4a514259834ed86//orig'
      const fallbackList = ['background17.webp','background18.webp','background19.webp','bg6.png']
      const chosen = customBg ? decodeURIComponent(customBg) : defaultBg
      const img = document.getElementById('bg-img')
      if (img) {
        img.src = chosen
        img.onerror = () => { img.src = fallbackList[Math.floor(Math.random()*fallbackList.length)] }
      }
    }
  } catch {}

  // Defer platform init after first paint
  requestAnimationFrame(async () => {
    try {
      await Platform.init()
      Platform.signalReady()
      await Platform.auth()
      const cloud = await Platform.cloudLoad()
      const local = loadState()
      if (cloud && game.setState(cloud)) { /* cloud */ }
      else if (local && game.setState(local)) { /* local */ }
      else { startNewRun(game, renderer) }
      updateHud(game)
      audio.setEnabled(false)
      achievements.check(game)
    } catch (e) {
      console.warn('Deferred platform init failed', e)
    }
  })

  function tick(ts) {
    const dt = Math.min(33, ts - state.lastTs)
    state.lastTs = ts

    // Timer for modes
    if (state.mode === 'timed') {
      if (state.timerMs > 0) {
        state.timerMs -= dt
        const tl = document.getElementById('time-left')
        if (tl) tl.textContent = formatTime(state.timerMs)
        if (state.timerMs <= 0) {
          state.timerMs = 0
          showOverlay(t('timeUp'), `${t('score')}: ${game.score}`)
          Platform.submitScore(game.score)
        }
      }
    }

    // Endurance 5 minutes
    if (!state.enduranceShown && Date.now() - state.startedAt >= 5 * 60 * 1000) {
      state.enduranceShown = true
      showToast(t('endurance5'))
    }

    renderer.update(dt)
    renderer.update(dt)
    renderer.render(game)
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)

  // If already authenticated, disable sign in button
  if (Platform.player) {
    const b = document.getElementById('btn-auth')
    if (b) { b.disabled = true; b.textContent = t('signedIn') }
  }

  applyModeUi()
}

function startNewRun(game, renderer) {
  const lastSpawn = game.reset()
  state.startedAt = Date.now()
  state.reached512At = null
  state.enduranceShown = false
  if (state.hardInterval) { clearInterval(state.hardInterval); state.hardInterval = null }
  if (state.mode === 'timed') {
    state.timerMs = 120000
  } else {
    state.timerMs = 0
  }

  // pulse last spawned tile from reset
  if (lastSpawn) renderer.pulseSpawn(lastSpawn[0], lastSpawn[1])
}

function getMaxTile(game) {
  let max = 0
  for (let r = 0; r < game.size; r++) for (let c = 0; c < game.size; c++) max = Math.max(max, game.grid[r][c])
  return max
}

function updateHud(game) {
  const scoreEl = document.getElementById('score')
  if (scoreEl) scoreEl.textContent = String(game.score)
  const best = Math.max(game.score, Number(localStorage.getItem('best') || 0))
  const bestEl = document.getElementById('best')
  if (bestEl) bestEl.textContent = String(best)
  try { localStorage.setItem('best', String(best)) } catch {}
}

function showOverlay(title, sub) {
  const o = document.getElementById('overlay')
  const ot = document.getElementById('overlay-title')
  const os = document.getElementById('overlay-sub')
  if (!o || !ot || !os) return
  ot.textContent = title
  os.textContent = sub
  o.classList.remove('hidden')
}
function hideOverlay() {
  const o = document.getElementById('overlay')
  if (o) o.classList.add('hidden')
}

function openLeaderboard() {
  document.getElementById('lb-overlay')?.classList.remove('hidden')
}
function closeLeaderboard() {
  document.getElementById('lb-overlay')?.classList.add('hidden')
}
async function renderLeaderboard() {
  const list = document.getElementById('lb-list')
  if (!list) return
  list.innerHTML = `<div class="row">${t('loadingLb')}</div>`
  const entries = await Platform.getLeaderboardTop(10)
  if (!entries.length) { list.innerHTML = `<div class=\"row\">${t('noLbData')}</div>`; return }
  list.innerHTML = ''
  for (const e of entries) {
    const row = document.createElement('div')
    row.className = 'row'
    row.innerHTML = `<div class="left"><span class="rank">#${e.rank}</span><span class="name"></span></div><div class="score">${e.score}</div>`
    row.querySelector('.name').textContent = e.name
    list.appendChild(row)
  }
}

function saveState(game) {
  const save = game.getState()
  try { localStorage.setItem('save', JSON.stringify(save)) } catch {}
  const best = Number(localStorage.getItem('best') || 0)
  Platform.cloudSave(save, best).catch(() => {})
}
function loadState() {
  try {
    const raw = localStorage.getItem('save')
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

function populateTrackSelect(audio) {
  const select = document.getElementById('track-select')
  if (!select) return
  const tracks = audio.getMusicTracks()
  select.innerHTML = ''
  for (const t of tracks) {
    const opt = document.createElement('option')
    opt.value = t.id
    opt.textContent = t.id
    if (audio.getCurrentTrackId() === t.id) opt.selected = true
    select.appendChild(opt)
  }
}

function selectCurrentTrack(select, audio) {
  if (!select) return
  const id = audio.getCurrentTrackId()
  if (!id) return
  for (const opt of select.options) { opt.selected = (opt.value === id) }
}

function ensureSoundToggleReflects(btn, audio) {
  if (!btn) return
  btn.setAttribute('aria-pressed', String(audio.enabled))
}

function openAchievements() {
  document.getElementById('ach-overlay')?.classList.remove('hidden')
}

function renderAchievementsList(ach) {
  const list = document.getElementById('ach-list')
  if (!list) return
  list.innerHTML = ''
  for (const def of ach.getAll()) {
    const row = document.createElement('div')
    row.className = 'row'
    const name = t(def.id)
    const status = ach.isUnlocked(def.id) ? '✓' : '…'
    row.innerHTML = `<span class="name"></span><span class="status">${status}</span>`
    row.querySelector('.name').textContent = name
    list.appendChild(row)
  }
}

function showToast(message) {
  const el = document.getElementById('toast')
  if (!el) return
  el.textContent = message
  el.classList.remove('hidden')
  // slide in
  el.classList.add('show')
  clearTimeout(showToast._t)
  showToast._t = setTimeout(() => {
    el.classList.remove('show')
    setTimeout(() => el.classList.add('hidden'), 400)
  }, 3000)
}

function suggestMove(g) {
  const dirs = ['up','down','left','right']
  let best = null
  let bestScore = -Infinity
  for (const d of dirs) {
    const sim = new Game(g.size, 123)
    sim.setState(g.getState())
    const res = sim.move(d)
    if (!res.moved) continue
    const empties = sim.getEmptyCells().length
    const evalScore = empties * 10 + res.mergesCount * 100 + (sim.score - g.score)
    if (evalScore > bestScore) { bestScore = evalScore; best = d }
  }
  return best
}

boot().catch((err) => {
  console.warn('boot failed', err)
})