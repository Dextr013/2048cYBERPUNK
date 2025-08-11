function createEmptyGrid(size) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => 0))
}

function randomChoice(list, rnd = Math.random) { return list[Math.floor(rnd() * list.length)] }

function isBlocker(v) { return false }

export class Game {
  constructor(size = 4, seed = null) {
    this.size = size
    this.grid = createEmptyGrid(size)
    this.score = 0
    this.won = false
    this._seed = seed
    this._prng = seed != null ? createPrng(seed) : Math.random
  }

  reset() {
    this.grid = createEmptyGrid(this.size)
    this.score = 0
    this.won = false
    this.spawn()
    const s2 = this.spawn()
    return s2
  }

  resize(newSize) {
    const n = Number(newSize)
    if (!Number.isFinite(n) || n < 3 || n > 8) return false
    this.size = n
    this.reset()
    return true
  }

  getEmptyCells() {
    const cells = []
    for (let r = 0; r < this.size; r++) for (let c = 0; c < this.size; c++) if (this.grid[r][c] === 0) cells.push([r, c])
    return cells
  }

  spawn() {
    const empties = this.getEmptyCells()
    if (empties.length === 0) return false
    const [r, c] = randomChoice(empties, this._prng)
    const v = this._prng() < 0.9 ? 2 : 4
    this.grid[r][c] = v
    return [r, c]
  }

  // Hard mode removed
  addRandomBlocker() { return false }

  move(dir) {
    let moved = false
    let wonNow = false
    const size = this.size
    const mergesPositions = []
    let mergesCount = 0
    const moves = [] // { fromR, fromC, toR, toC, value }

    const get = (r, c) => this.grid[r][c]
    const set = (r, c, v) => (this.grid[r][c] = v)

    function traverse(dir) {
      const order = { rows: [], cols: [] }
      const range = [...Array(size).keys()]
      if (dir === 'up') { order.rows = range; order.cols = range }
      if (dir === 'down') { order.rows = range.slice().reverse(); order.cols = range }
      if (dir === 'left') { order.rows = range; order.cols = range }
      if (dir === 'right') { order.rows = range; order.cols = range.slice().reverse() }
      return order
    }

    const mergedThisMove = createEmptyGrid(size).map((row) => row.map(() => false))

    const order = traverse(dir)
    for (const r of order.rows) {
      for (const c of order.cols) {
        const value = get(r, c)
        if (!value || isBlocker(value)) continue
        let nr = r, nc = c
        const startR = r, startC = c
        let mergedAt = null
        const step = (d) => {
          if (d === 'up') nr -= 1
          if (d === 'down') nr += 1
          if (d === 'left') nc -= 1
          if (d === 'right') nc += 1
        }
        while (true) {
          let tr = nr, tc = nc
          step(dir)
          if (nr < 0 || nr >= size || nc < 0 || nc >= size) break
          const target = get(nr, nc)
          if (isBlocker(target)) break
          if (target === 0) { tr = nr; tc = nc; nr = tr; nc = tc; continue }
          if (target === value && !mergedThisMove[nr][nc]) {
            // merge
            set(startR, startC, 0)
            set(nr, nc, value * 2)
            mergedThisMove[nr][nc] = true
            this.score += value * 2
            mergesCount += 1
            mergesPositions.push([nr, nc])
            mergedAt = [nr, nc]
            if (value * 2 === 2048) wonNow = true
            moved = true
          }
          break
        }
        // Move to last free spot if not merged
        if (get(startR, startC) !== 0) {
          // step back one to last valid
          if (dir === 'up') nr += 1
          if (dir === 'down') nr -= 1
          if (dir === 'left') nc += 1
          if (dir === 'right') nc -= 1
          // do not move into blocker
          if (!(nr === startR && nc === startC) && !isBlocker(get(nr, nc))) {
            set(nr, nc, value)
            set(startR, startC, 0)
            moves.push({ fromR: startR, fromC: startC, toR: nr, toC: nc, value })
            moved = true
          }
        } else if (mergedAt) {
          // was merged directly
          moves.push({ fromR: startR, fromC: startC, toR: mergedAt[0], toC: mergedAt[1], value })
        }
      }
    }

    let spawnedAt = null
    if (moved) spawnedAt = this.spawn()
    this.won = this.won || wonNow
    return { moved, won: wonNow, mergesCount, mergesPositions, spawnedAt, moves }
  }

  isGameOver() {
    if (this.getEmptyCells().length > 0) return false
    // Check merges available
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const v = this.grid[r][c]
        if (isBlocker(v)) continue
        if (r + 1 < this.size && this.grid[r + 1][c] === v) return false
        if (c + 1 < this.size && this.grid[r][c + 1] === v) return false
      }
    }
    return true
  }

  getState() {
    return {
      size: this.size,
      grid: this.grid.map((row) => row.slice()),
      score: this.score,
      won: this.won,
    }
  }

  setState(state) {
    if (!state || !Array.isArray(state.grid)) return false
    const n = state.grid.length
    if (n !== this.size) return false
    this.grid = state.grid.map((row) => row.slice())
    this.score = Number(state.score || 0)
    this.won = Boolean(state.won)
    return true
  }

  setSeed(seed) {
    this._seed = seed
    this._prng = seed != null ? createPrng(seed) : Math.random
  }
}

function createPrng(seed) {
  let s = Number(seed) >>> 0
  if (!Number.isFinite(s)) s = 123456789
  if (s === 0) s = 123456789
  return function rnd() {
    // xorshift32
    s ^= s << 13; s >>>= 0
    s ^= s >> 17; s >>>= 0
    s ^= s << 5;  s >>>= 0
    return (s >>> 0) / 4294967296
  }
}