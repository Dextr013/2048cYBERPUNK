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
        await this.ensureYandexSdk()
        this.ysdk = await window.YaGames.init()
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

  getLocale() {
    try { return this.ysdk?.i18n?.getLocale?.() || navigator.language || 'en' } catch { return navigator.language || 'en' }
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
      if (this.env === 'yandex' && this.player?.getData) {
        const data = await this.player.getData(['save', 'best'])
        return data?.save || null
      }
      if (this.env === 'samsung') {
        const si = window.samsungInstant
        if (si?.loadData) {
          const d = await si.loadData(['save'])
          return d?.save || null
        }
        if (si?.getData) {
          const d = await si.getData(['save'])
          return d?.save || null
        }
        if (si?.getItem) {
          return si.getItem('save') || null
        }
      }
    } catch (e) { console.warn('cloudLoad failed', e) }
    return null
  },

  async cloudSave(state, best) {
    try {
      if (this.env === 'yandex' && this.player?.setData) {
        await this.player.setData({ save: state, best: Number(best || 0) })
        return true
      }
      if (this.env === 'samsung') {
        const si = window.samsungInstant
        if (si?.saveData) {
          await si.saveData({ save: state, best: Number(best || 0) })
          return true
        }
        if (si?.setData) {
          await si.setData({ save: state, best: Number(best || 0) })
          return true
        }
        if (si?.setItem) {
          si.setItem('save', state)
          si.setItem('best', Number(best || 0))
          return true
        }
      }
    } catch (e) { console.warn('cloudSave failed', e) }
    return false
  },

  async getLeaderboardTop(limit = 10) {
    try {
      if (this.env === 'yandex' && this.ysdk?.getLeaderboards) {
        const lb = await this.ysdk.getLeaderboards()
        const res = await lb.getLeaderboardEntries(this.config.leaderboardId, { quantityTop: limit })
        return (res?.entries || []).map((e, idx) => ({
          rank: e.rank ?? idx + 1,
          name: e.player?.publicName || e.player?.uniqueID || 'Player',
          score: e.score || 0,
        }))
      }
    } catch (e) { console.warn('getLeaderboardTop error', e) }
    return []
  },

  signalReady() {
    try { this.ysdk?.features?.LoadingAPI?.ready?.() } catch {}
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

  async ensureYandexSdk() {
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