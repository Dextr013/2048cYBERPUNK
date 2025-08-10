export class AudioManager {
  constructor(tracks) {
    this.enabled = false
    this.tracks = (tracks || []).map((t) => ({ ...t, el: null }))
    this.current = null
    this.currentId = null
    this.volume = 0.6
  }

  setEnabled(on) {
    this.enabled = on
    if (!on) this.stop()
    else if (this.currentId) this.play(this.currentId)
  }

  setVolume(v) {
    const clamped = Math.max(0, Math.min(1, Number(v) || 0))
    this.volume = clamped
    for (const t of this.tracks) if (t.el) t.el.volume = clamped
    if (this.current) this.current.volume = clamped
    try { localStorage.setItem('volume', String(Math.round(clamped * 100))) } catch {}
  }

  getMusicTracks() {
    return this.tracks.filter((t) => t.type === 'music')
  }

  getCurrentTrackId() {
    return this.currentId
  }

  async ensureLoaded(track) {
    if (track.el) return track.el
    const audio = new Audio(track.src)
    audio.loop = track.type === 'music'
    audio.preload = 'auto'
    audio.volume = this.volume
    track.el = audio
    return audio
  }

  async playRandomBgm() {
    const mus = this.getMusicTracks()
    if (mus.length === 0) return
    const pick = mus[Math.floor(Math.random() * mus.length)]
    await this.play(pick.id)
  }

  async play(id) {
    const track = this.tracks.find((t) => t.id === id)
    if (!track) return
    this.currentId = id
    await this.ensureLoaded(track)
    this.stop()
    this.current = track.el
    this.current.volume = this.volume
    if (this.enabled) {
      try { await this.current.play() } catch {}
    }
    try { localStorage.setItem('trackId', id) } catch {}
  }

  async nextTrack() {
    const mus = this.getMusicTracks()
    if (mus.length === 0) return
    const idx = Math.max(0, mus.findIndex((t) => t.id === this.currentId))
    const next = mus[(idx + 1) % mus.length]
    await this.play(next.id)
  }

  async prevTrack() {
    const mus = this.getMusicTracks()
    if (mus.length === 0) return
    const idx = Math.max(0, mus.findIndex((t) => t.id === this.currentId))
    const prev = mus[(idx - 1 + mus.length) % mus.length]
    await this.play(prev.id)
  }

  stop() {
    if (this.current) {
      this.current.pause()
      this.current.currentTime = 0
      this.current = null
    }
  }
}