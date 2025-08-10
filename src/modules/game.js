function createEmptyGrid(size) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => 0))
}

function randomChoice(list) { return list[Math.floor(Math.random() * list.length)] }

export class Game {
  constructor(size = 4) {
    this.size = size
    this.grid = createEmptyGrid(size)
    this.score = 0
    this.won = false
  }

  reset() {
    this.grid = createEmptyGrid(this.size)
    this.score = 0
    this.won = false
    this.spawn()
    this.spawn()
  }

  getEmptyCells() {
    const cells = []
    for (let r = 0; r < this.size; r++) for (let c = 0; c < this.size; c++) if (this.grid[r][c] === 0) cells.push([r, c])
    return cells
  }

  spawn() {
    const empties = this.getEmptyCells()
    if (empties.length === 0) return false
    const [r, c] = randomChoice(empties)
    this.grid[r][c] = Math.random() < 0.9 ? 2 : 4
    return true
  }

  move(dir) {
    let moved = false
    let wonNow = false
    const size = this.size

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
        if (!value) continue
        let nr = r, nc = c
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
          if (target === 0) { tr = nr; tc = nc; nr = tr; nc = tc; continue }
          if (target === value && !mergedThisMove[nr][nc]) {
            // merge
            set(r, c, 0)
            set(nr, nc, value * 2)
            mergedThisMove[nr][nc] = true
            this.score += value * 2
            if (value * 2 === 2048) wonNow = true
            moved = true
          }
          break
        }
        // Move to last free spot if not merged
        if (get(r, c) !== 0) {
          const sr = nr, sc = nc
          // step back one to last valid
          if (dir === 'up') nr += 1
          if (dir === 'down') nr -= 1
          if (dir === 'left') nc += 1
          if (dir === 'right') nc -= 1
          if (nr !== r || nc !== c) {
            set(nr, nc, value)
            set(r, c, 0)
            moved = true
          }
        }
      }
    }

    if (moved) this.spawn()
    this.won = this.won || wonNow
    return { moved, won: wonNow }
  }

  isGameOver() {
    if (this.getEmptyCells().length > 0) return false
    // Check merges available
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const v = this.grid[r][c]
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
}