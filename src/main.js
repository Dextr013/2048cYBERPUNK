import { loadI18n, setLanguage, populateLanguageSelect, t } from './modules/i18n.js'
import { AudioManager } from './modules/audio.js'
import { Game } from './modules/game.js'
import { Renderer } from './modules/renderer.js'
import { Input } from './modules/input.js'
import { Platform } from './modules/platform.js'

const canvas = document.getElementById('game-canvas')
const ctx = canvas.getContext('2d', { alpha: false })

const state = {
  started: false,
  lastTs: 0,
  locale: 'ru',
}

function setUiTexts() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n')
    el.textContent = t(key)
  })
  document.getElementById('preloader-text').textContent = t('loading')
}

async function boot() {
  await loadI18n(['en', 'ru'])
  setLanguage(navigator.language.startsWith('ru') ? 'ru' : 'en')
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
  document.getElementById('btn-new').addEventListener('click', () => {
    game.reset()
    audio.playRandomBgm()
    hideOverlay()
    tick(performance.now())
  })
  document.getElementById('btn-restart').addEventListener('click', () => {
    game.reset()
    hideOverlay()
    tick(performance.now())
  })
  document.getElementById('btn-continue').addEventListener('click', () => hideOverlay())

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

  // Input -> Game actions
  input.onMove = (dir) => {
    const result = game.move(dir)
    if (result.moved) {
      updateHud(game)
      if (result.won) { showOverlay(t('youWin'), t('mergeTo', { value: 2048 })); Platform.submitScore(game.score) }
      else if (game.isGameOver()) { showOverlay(t('gameOver'), t('noMoves')); Platform.submitScore(game.score) }
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

  // Start new game
  game.reset()
  updateHud(game)
  audio.setEnabled(false)

  function tick(ts) {
    const dt = Math.min(33, ts - state.lastTs)
    state.lastTs = ts
    renderer.render(game)
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
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

boot().catch((err) => {
  console.error(err)
  document.getElementById('preloader-text').textContent = 'Failed to load'
})