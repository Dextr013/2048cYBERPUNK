export class Achievements {
  constructor() {
    this.defs = [
      { id: 'ach_128', type: 'tile', value: 128 },
      { id: 'ach_256', type: 'tile', value: 256 },
      { id: 'ach_512', type: 'tile', value: 512 },
      { id: 'ach_1024', type: 'tile', value: 1024 },
      { id: 'ach_2048', type: 'tile', value: 2048 },
      { id: 'ach_score_1000', type: 'score', value: 1000 },
      { id: 'ach_score_5000', type: 'score', value: 5000 },
      { id: 'ach_win', type: 'win' },
    ]
    this.unlocked = new Set()
    this.onUnlock = null
    this.load()
  }

  load() {
    try {
      const raw = localStorage.getItem('achievements')
      if (raw) {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr)) arr.forEach((id) => this.unlocked.add(id))
      }
    } catch {}
  }

  save() {
    try { localStorage.setItem('achievements', JSON.stringify(Array.from(this.unlocked))) } catch {}
  }

  getAll() { return this.defs.slice() }

  isUnlocked(id) { return this.unlocked.has(id) }

  unlock(id) {
    if (this.unlocked.has(id)) return false
    this.unlocked.add(id)
    this.save()
    return true
  }

  getMaxTile(game) {
    let max = 0
    for (let r = 0; r < game.size; r++) for (let c = 0; c < game.size; c++) max = Math.max(max, game.grid[r][c])
    return max
  }

  check(game) {
    const newly = []
    const maxTile = this.getMaxTile(game)
    for (const def of this.defs) {
      if (this.unlocked.has(def.id)) continue
      let ok = false
      if (def.type === 'tile') ok = maxTile >= def.value
      else if (def.type === 'score') ok = game.score >= def.value
      else if (def.type === 'win') ok = game.won === true
      if (ok) {
        if (this.unlock(def.id)) {
          newly.push(def)
          try { this.onUnlock && this.onUnlock(def) } catch {}
        }
      }
    }
    return newly
  }
}