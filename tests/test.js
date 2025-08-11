import { Game } from '../src/modules/game.js'

const out = document.getElementById('out')
function log(msg, cls='') {
  const div = document.createElement('div'); div.className = `test ${cls}`; div.textContent = msg; out.appendChild(div)
}
function assert(cond, msg) { if (!cond) throw new Error(msg) }

function run(name, fn) {
  try { fn(); log(`✔ ${name}`, 'ok') } catch (e) { console.error(e); log(`✖ ${name}: ${e.message}`, 'fail') }
}

function gridEquals(a,b){ if(a.length!==b.length)return false; for(let i=0;i<a.length;i++){ if(a[i].length!==b[i].length)return false; for(let j=0;j<a[i].length;j++){ if(a[i][j]!==b[i][j]) return false } } return true }

// Tests
run('spawn on empty creates two tiles after reset', () => {
  const g = new Game(4, 1)
  g.reset()
  let cnt = 0
  for (const r of g.grid) for (const v of r) if (v!==0) cnt++
  assert(cnt===2, `expected 2 tiles, got ${cnt}`)
})

run('move left merges equal tiles once', () => {
  const g = new Game(4, 2)
  g.grid = [
    [2,2,0,0],
    [0,0,0,0],
    [0,0,0,0],
    [0,0,0,0],
  ]
  const res = g.move('left')
  assert(res.moved, 'should move')
  assert(g.grid[0][0]===4 && g.grid[0][1]===0, 'expected merge into 4 at [0,0]')
  assert(res.mergesCount===1, 'expected one merge')
})

run('move right chain merges do not double merge', () => {
  const g = new Game(4, 3)
  g.grid = [
    [2,2,4,4],
    [0,0,0,0],
    [0,0,0,0],
    [0,0,0,0],
  ]
  const res = g.move('right')
  const row = g.grid[0]
  // Expect [0,0,4,8] after move right
  assert(row[3]===8 && row[2]===4, `bad row ${JSON.stringify(row)}`)
  assert(res.mergesCount===2, 'two merges expected')
})

run('isGameOver detects no moves', () => {
  const g = new Game(2, 4)
  g.grid = [
    [2,4],
    [8,16],
  ]
  assert(g.isGameOver()===true, 'should be game over')
})

run('isGameOver detects possible merge', () => {
  const g = new Game(2, 5)
  g.grid = [
    [2,2],
    [8,16],
  ]
  assert(g.isGameOver()===false, 'merge is possible')
})

run('deterministic RNG spawns reproducibly', () => {
  const g1 = new Game(4, 123)
  const g2 = new Game(4, 123)
  g1.reset(); g2.reset()
  const s1 = JSON.stringify(g1.grid)
  const s2 = JSON.stringify(g2.grid)
  assert(s1===s2, 'grids should be equal with same seed')
})