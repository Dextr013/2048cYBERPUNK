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
  document.getElementById('preloader-text').textContent = t('loading')
}

function tryShowInterstitial() {
  const now = Date.now()
  if (now - state.lastInterstitial < AdConfig.interstitialCooldownMs) return
  state.lastInterstitial = now
  Platform.showInterstitial().catch(() => {})
}

async function boot() {
  await loadI18n(['en', 'ru'])
  const prefer = Platform.getLocale?.() || navigator.language || 'en'
  setLanguage(prefer.startsWith('ru') ? 'ru' : 'en')
  populateLanguageSelect(document.getElementById('lang-select'))
  setUiTexts()

  const audio = new AudioManager([
    { id: 'bgm1', src: 'Nightwalk.ogg', type: 'music' },
    { id: 'bgm2', src: 'minimum.ogg', type: 'music' },
    { id: 'bgm3', src: 'malfunction.ogg', type: 'music' },
  ])

  const game = new Game()
  const renderer = new Renderer(canvas)
  const input = new Input(canvas)

  // UI wiring
  document.getElementById('btn-new').addEventListener('click', async () => {
    if (AdConfig.interstitialOnNew) tryShowInterstitial()
    game.reset()
    audio.playRandomBgm()
    hideOverlay()
    saveState(game)
    tick(performance.now())
  })
  document.getElementById('btn-restart').addEventListener('click', async () => {
    if (AdConfig.interstitialOnRestart) tryShowInterstitial()
    game.reset()
    hideOverlay()
    saveState(game)
    tick(performance.now())
  })
  document.getElementById('btn-continue').addEventListener('click', async () => {
    const wasGameOver = document.getElementById('overlay-title').textContent === t('gameOver')
    if (wasGameOver && AdConfig.rewardedOnContinue) {
      const ok = await Platform.showRewarded()
      if (!ok) return
    }
    hideOverlay()
  })

  const btnSound = document.getElementById('btn-sound')
  btnSound.addEventListener('click', () => {
    const next = !(btnSound.getAttribute('aria-pressed') === 'true')
    btnSound.setAttribute('aria-pressed', String(next))
    audio.setEnabled(next)
    if (next) audio.playRandomBgm()
  })

  document.getElementById('lang-select').addEventListener('change', (e) => {
    const val = e.target.value
    setLanguage(val)
    setUiTexts()
  })

  const btnAuth = document.getElementById('btn-auth')
  btnAuth.addEventListener('click', async () => {
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
  btnLb.addEventListener('click', async () => {
    openLeaderboard()
    await renderLeaderboard()
  })
  btnLbClose.addEventListener('click', closeLeaderboard)

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

  input.onRestart = () => document.getElementById('btn-restart').click()

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

  // Start
  document.getElementById('preloader').classList.add('hidden')
  document.getElementById('app').classList.remove('hidden')

  // Platform init and signal game ready
  await Platform.init()
  Platform.signalReady()

  // Try authenticate silently and load cloud save
  await Platform.auth()
  const cloud = await Platform.cloudLoad()

  // Load local or cloud state
  const local = loadState()
  if (cloud && game.setState(cloud)) { /* loaded cloud */ }
  else if (local && game.setState(local)) { /* loaded local */ }
  else { game.reset() }

  updateHud(game)
  audio.setEnabled(false)

  function tick(ts) {
    const dt = Math.min(33, ts - state.lastTs)
    state.lastTs = ts
    renderer.render(game)
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)

  // If already authenticated, disable sign in button
  if (Platform.player) {
    btnAuth.disabled = true
    btnAuth.textContent = t('signedIn')
  }
}

function updateHud(game) {
  document.getElementById('score').textContent = String(game.score)
  const best = Math.max(game.score, Number(localStorage.getItem('best') || 0))
  document.getElementById('best').textContent = String(best)
  localStorage.setItem('best', String(best))
}

function showOverlay(title, sub) {
  const o = document.getElementById('overlay')
  document.getElementById('overlay-title').textContent = title
  document.getElementById('overlay-sub').textContent = sub
  o.classList.remove('hidden')
}
function hideOverlay() {
  document.getElementById('overlay').classList.add('hidden')
}

function openLeaderboard() {
  document.getElementById('lb-overlay').classList.remove('hidden')
}
function closeLeaderboard() {
  document.getElementById('lb-overlay').classList.add('hidden')
}
async function renderLeaderboard() {
  const list = document.getElementById('lb-list')
  list.innerHTML = `<div class=\"row\">${t('loadingLb')}</div>`
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
  document.getElementById('preloader-text').textContent = 'Failed to load'
})