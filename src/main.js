import { loadI18n, setLanguage, populateLanguageSelect, t } from './modules/i18n.js'
import { AudioManager } from './modules/audio.js'
import { Game } from './modules/game.js'
import { Renderer } from './modules/renderer.js'
import { Input } from './modules/input.js'
import { Platform } from './modules/platform.js'
import { AdConfig } from './config.js'

const canvas = document.getElementById('game-canvas')
const ctx = canvas.getContext('2d', { alpha: false })

const state = {
  started: false,
  lastTs: 0,
  locale: 'ru',
  lastInterstitial: 0,
}

function setUiTexts() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n')
    el.textContent = t(key)
  })
  const pl = document.getElementById('preloader-text')
  if (pl) pl.textContent = t('loading')
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

  const game = new Game()
  const renderer = new Renderer(canvas)
  const input = new Input(canvas)

  // UI wiring
  const btnNew = document.getElementById('btn-new')
  if (btnNew) btnNew.addEventListener('click', async () => {
    if (AdConfig.interstitialOnNew) tryShowInterstitial()
    game.reset()
    audio.playRandomBgm()
    hideOverlay()
    saveState(game)
    tick(performance.now())
  })
  const btnRestart = document.getElementById('btn-restart')
  if (btnRestart) btnRestart.addEventListener('click', async () => {
    if (AdConfig.interstitialOnRestart) tryShowInterstitial()
    game.reset()
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
  })

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

  // Input -> Game actions
  input.onMove = (dir) => {
    const result = game.move(dir)
    if (result.moved) {
      updateHud(game)
      saveState(game)
      if (result.won) { showOverlay(t('youWin'), t('mergeTo', { value: 2048 })); Platform.submitScore(game.score) }
      else if (game.isGameOver()) { showOverlay(t('gameOver'), t('noMoves')); Platform.submitScore(game.score); if (AdConfig.interstitialOnGameOver) tryShowInterstitial() }
    }
  }

  input.onRestart = () => document.getElementById('btn-restart')?.click()

  // Resize
  function resize() {
    const bounds = canvas.getBoundingClientRect()
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.floor(bounds.width * dpr)
    canvas.height = Math.floor(bounds.height * dpr)
    renderer.setDpr(dpr)
  }
  window.addEventListener('resize', resize)
  resize()

  // Reveal UI as soon as possible (cancel safety timeout if present)
  document.getElementById('preloader')?.classList.add('hidden')
  document.getElementById('app')?.classList.remove('hidden')
  if (window.__boot_timeout) { clearTimeout(window.__boot_timeout); window.__boot_timeout = null }

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
      else { game.reset() }
      updateHud(game)
      audio.setEnabled(false)
    } catch (e) {
      console.warn('Deferred platform init failed', e)
    }
  })

  function tick(ts) {
    const dt = Math.min(33, ts - state.lastTs)
    state.lastTs = ts
    renderer.render(game)
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)

  // If already authenticated, disable sign in button
  if (Platform.player) {
    const b = document.getElementById('btn-auth')
    if (b) { b.disabled = true; b.textContent = t('signedIn') }
  }
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

boot().catch((err) => {
  console.error(err)
  const pl = document.getElementById('preloader-text')
  if (pl) pl.textContent = 'Failed to load'
})