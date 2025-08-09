export class Input {
  constructor(target) {
    this.onMove = null
    this.onRestart = null

    window.addEventListener('keydown', (e) => {
      let dir = null
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': dir = 'up'; break
        case 'ArrowDown': case 's': case 'S': dir = 'down'; break
        case 'ArrowLeft': case 'a': case 'A': dir = 'left'; break
        case 'ArrowRight': case 'd': case 'D': dir = 'right'; break
        case 'r': case 'R': this.onRestart && this.onRestart(); break
      }
      if (dir) { e.preventDefault(); this.onMove && this.onMove(dir) }
    }, { passive: false })

    let sx = 0, sy = 0, tracking = false
    const threshold = 16
    target.addEventListener('touchstart', (e) => {
      const t = e.touches[0]
      sx = t.clientX; sy = t.clientY; tracking = true
    }, { passive: true })
    target.addEventListener('touchmove', (e) => {
      if (!tracking) return
      const t = e.touches[0]
      const dx = t.clientX - sx
      const dy = t.clientY - sy
      if (Math.hypot(dx, dy) > threshold) {
        const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')
        tracking = false
        this.onMove && this.onMove(dir)
      }
    }, { passive: true })
    target.addEventListener('touchend', () => { tracking = false }, { passive: true })
  }
}