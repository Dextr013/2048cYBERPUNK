export const Platform = {
  env: 'web',
  async init() {
    // Detect platforms by globals or query params
    const q = new URLSearchParams(location.search)
    if (window.YaGames || q.get('platform') === 'yandex') this.env = 'yandex'
    else if (window.samsungInstant || q.get('platform') === 'samsung') this.env = 'samsung'
    else if (window.YTPlayable || q.get('platform') === 'youtube') this.env = 'youtube'
    else this.env = 'web'

    try {
      if (this.env === 'yandex') {
        // optional init if available
        if (window.YaGames?.init) await window.YaGames.init()
      }
      if (this.env === 'samsung') {
        // placeholder for samsung instant play sdk init
      }
      if (this.env === 'youtube') {
        // placeholder for youtube playables
      }
    } catch (e) {
      console.warn('Platform init error', e)
    }
  },

  signalReady() {
    // Generic
    try { window.dispatchEvent(new Event('gameready')) } catch {}

    // Specific SDK hooks
    try { window.parent?.postMessage({ type: 'game_ready' }, '*') } catch {}
    try { window.YTPlayable?.gameReady?.() } catch {}
    try { window.samsungInstant?.setLoadingProgress?.(100) } catch {}

    // Yandex SDK suggests showing adv after ready, we just signal
    try { window.YaGames?.adv?.showFullscreenAdv?.({ callbacks: {} }) } catch {}
  },

  submitScore(score) {
    try { window.YaGames?.leaderboards?.getLeaderboardDisplayName?.('score') } catch {}
    try { window.samsungInstant?.setScore?.(score) } catch {}
    try { window.parent?.postMessage({ type: 'score', score }, '*') } catch {}
  },
}