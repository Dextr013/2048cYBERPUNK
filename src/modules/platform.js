export const Platform = {
  env: 'web',
  ysdk: null,
  player: null,
  config: { leaderboardId: 'score' },

  async init() {
    const q = new URLSearchParams(location.search)
    if (q.get('lb')) this.config.leaderboardId = q.get('lb')

    if (window.YaGames || q.get('platform') === 'yandex') this.env = 'yandex'
    else if (window.samsungInstant || q.get('platform') === 'samsung') this.env = 'samsung'
    else if (window.YTPlayable || q.get('platform') === 'youtube') this.env = 'youtube'
    else this.env = 'web'

    try {
      if (this.env === 'yandex') {
        await this.#ensureYandexSdk()
        this.ysdk = await window.YaGames.init()
        // Try silent auth
        try { this.player = await this.ysdk.getPlayer({ scopes: true }) } catch {}
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

  async auth() {
    if (this.env !== 'yandex' || this.player) return false
    try {
      await this.ysdk?.auth?.openAuthDialog()
      this.player = await this.ysdk.getPlayer({ scopes: true })
      return true
    } catch (e) { console.warn('Auth failed', e); return false }
  },

  async cloudLoad() {
    try {
      if (this.player?.getData) {
        const data = await this.player.getData(['save', 'best'])
        return data?.save || null
      }
    } catch (e) { console.warn('cloudLoad failed', e) }
    return null
  },

  async cloudSave(state, best) {
    try {
      if (this.player?.setData) {
        await this.player.setData({ save: state, best: Number(best || 0) })
        return true
      }
    } catch (e) { console.warn('cloudSave failed', e) }
    return false
  },

  signalReady() {
    try { window.dispatchEvent(new Event('gameready')) } catch {}
    try { window.parent?.postMessage({ type: 'game_ready' }, '*') } catch {}
    try { window.YTPlayable?.gameReady?.() } catch {}
    try { window.samsungInstant?.setLoadingProgress?.(100) } catch {}
  },

  async showInterstitial() {
    try {
      if (this.env === 'yandex' && this.ysdk?.adv?.showFullscreenAdv) {
        await this.ysdk.adv.showFullscreenAdv({ callbacks: {} })
        return true
      }
    } catch (e) { console.warn('Interstitial error', e) }
    return false
  },

  async showRewarded() {
    try {
      if (this.env === 'yandex' && this.ysdk?.adv?.showRewardedVideo) {
        return await new Promise((resolve) => {
          this.ysdk.adv.showRewardedVideo({
            callbacks: {
              onRewarded: () => resolve(true),
              onClose: () => resolve(false),
              onError: () => resolve(false),
            },
          })
        })
      }
    } catch (e) { console.warn('Rewarded error', e) }
    return false
  },

  async submitScore(score) {
    try {
      if (this.env === 'yandex' && this.ysdk?.getLeaderboards) {
        const lb = await this.ysdk.getLeaderboards()
        await lb.setLeaderboardScore(this.config.leaderboardId, Number(score))
      }
    } catch (e) { console.warn('submitScore error', e) }

    try { window.samsungInstant?.setScore?.(score) } catch {}
    try { window.parent?.postMessage({ type: 'score', score }, '*') } catch {}
  },

  async #ensureYandexSdk() {
    if (window.YaGames?.init) return
    await new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://yandex.ru/games/sdk/v2'
      s.async = true
      s.onload = resolve
      s.onerror = reject
      document.head.appendChild(s)
    })
  },
}