export class AudioManager {
  constructor(tracks) {
    this.enabled = false
    this.tracks = (tracks || []).map((t) => ({ ...t, el: null }))
    this.current = null
  }
  setEnabled(on) {
    this.enabled = on
    if (!on) this.stop()
  }
  async ensureLoaded(track) {
    if (track.el) return track.el
    const audio = new Audio(track.src)
    audio.loop = track.type === 'music'
    audio.preload = 'auto'
    track.el = audio
    return audio
  }
  async playRandomBgm() {
    if (!this.enabled) return
    const mus = this.tracks.filter((t) => t.type === 'music')
    if (mus.length === 0) return
    const pick = mus[Math.floor(Math.random() * mus.length)]
    await this.play(pick.id)
  }
  async play(id) {
    if (!this.enabled) return
    const track = this.tracks.find((t) => t.id === id)
    if (!track) return
    await this.ensureLoaded(track)
    this.stop()
    this.current = track.el
    try { await this.current.play() } catch {}
  }
  stop() {
    if (this.current) {
      this.current.pause()
      this.current.currentTime = 0
      this.current = null
    }
  }
}