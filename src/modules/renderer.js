const tileSrcByValue = new Map([
  [2, 'digit 2.png'],
  [4, 'digit 4.png'],
  [8, 'digit 8.png'],
  [16, 'digit 16.png'],
  [32, 'digit 32.png'],
  [64, 'digit 64.png'],
  [128, 'digit 128.png'],
  [256, 'digit 256.png'],
  [512, 'digit 512.png'],
  [1024, 'digit 1024.png'],
  [2048, 'digit 2048.png'],
])

function loadImage(src) {
  return new Promise(async (resolve, reject) => {
    try {
      if (window.createImageBitmap) {
        const res = await fetch(src)
        const blob = await res.blob()
        const bmp = await createImageBitmap(blob)
        return resolve(bmp)
      }
    } catch {}
    const img = new Image()
    try { img.decoding = 'async' } catch {}
    img.src = src
    img.onload = () => resolve(img)
    img.onerror = reject
  })
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.dpr = 1
    this.cache = new Map()
    this.bump = new Map() // key: "r,c" => scale
    this.spawnPulse = new Map()
    this.slide = [] // {x,y,w,h,img/text,value,progress}
    this.particles = [] // {x,y,vx,vy,life,color,sz}
    this._queuedMerge = [] // [[r,c],...]
    this._queuedSpawn = [] // [[r,c],...]
  }
  setDpr(dpr) { this.dpr = dpr }

  async getTileImage(value) {
    const src = tileSrcByValue.get(value)
    if (!src) return null
    if (this.cache.has(src)) return this.cache.get(src)
    const img = await loadImage(src)
    this.cache.set(src, img)
    return img
  }

  drawGrid(grid) {
    const { ctx, canvas } = this
    const pad = 16 * this.dpr
    const size = Math.min(canvas.width, canvas.height) - pad * 2
    const cellGap = 8 * this.dpr
    const n = grid.length
    const cellSize = (size - cellGap * (n - 1)) / n

    const startX = (canvas.width - size) / 2
    const startY = (canvas.height - size) / 2

    // Grid background glow (confined to board area)
    const bgGrad = ctx.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      size * 0.1,
      canvas.width / 2,
      canvas.height / 2,
      size * 0.75,
    )
    bgGrad.addColorStop(0, 'rgba(0,224,255,0.08)')
    bgGrad.addColorStop(1, 'rgba(255,0,212,0.06)')
    ctx.fillStyle = bgGrad
    const glowPad = pad * 0.6
    ctx.fillRect(startX - glowPad, startY - glowPad, size + glowPad * 2, size + glowPad * 2)

    // Cells
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const x = startX + c * (cellSize + cellGap)
        const y = startY + r * (cellSize + cellGap)
        // cell frame
        ctx.fillStyle = 'rgba(10,14,20,0.85)'
        ctx.strokeStyle = 'rgba(0,224,255,0.35)'
        ctx.lineWidth = 2 * this.dpr
        roundRect(ctx, x, y, cellSize, cellSize, 8 * this.dpr)
        ctx.fill()
        ctx.stroke()
      }
    }

    return { startX, startY, cellSize, cellGap, n }
  }

  async drawTiles(grid, layout) {
    const { ctx } = this
    // draw sliding overlays first
    const movingTargets = new Set()
    if (this.slide?.length) {
      for (const s of this.slide) {
        movingTargets.add(`${s.tr},${s.tc}`)
        const cx = layout.startX + s.c * (layout.cellSize + layout.cellGap)
        const cy = layout.startY + s.r * (layout.cellSize + layout.cellGap)
        const tx = layout.startX + s.tc * (layout.cellSize + layout.cellGap)
        const ty = layout.startY + s.tr * (layout.cellSize + layout.cellGap)
        const x = cx + (tx - cx) * s.p
        const y = cy + (ty - cy) * s.p
        ctx.save()
        ctx.shadowColor = 'rgba(0,224,255,0.5)'
        ctx.shadowBlur = 12 * this.dpr
        let img = null
        try { img = await this.getTileImage(s.value) } catch {}
        if (img) drawContainedImage(ctx, img, x, y, layout.cellSize, layout.cellSize)
        else {
          ctx.fillStyle = 'white'
          ctx.font = `${Math.floor(layout.cellSize * 0.38)}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(String(s.value), x + layout.cellSize / 2, y + layout.cellSize / 2)
        }
        ctx.restore()
      }
    }

    for (let r = 0; r < layout.n; r++) {
      for (let c = 0; c < layout.n; c++) {
        const value = grid[r][c]
        if (value === 0) continue
        // if a tile is currently sliding into this cell, skip drawing base to avoid double
        if (movingTargets.has(`${r},${c}`)) continue
        const x = layout.startX + c * (layout.cellSize + layout.cellGap)
        const y = layout.startY + r * (layout.cellSize + layout.cellGap)

        // Neon outer glow
        ctx.save()
        ctx.shadowColor = value === -1 ? 'rgba(255,0,212,0.6)' : 'rgba(0,224,255,0.6)'
        ctx.shadowBlur = 16 * this.dpr

        // Scale for bump/spawn
        const key = `${r},${c}`
        const s = this.bump.get(key) ?? this.spawnPulse.get(key) ?? 1
        ctx.translate(x + layout.cellSize / 2, y + layout.cellSize / 2)
        ctx.scale(s, s)
        ctx.translate(-(x + layout.cellSize / 2), -(y + layout.cellSize / 2))

        if (value === -1) {
          // Blocker tile
          ctx.fillStyle = 'rgba(20,6,18,0.9)'
          ctx.strokeStyle = 'rgba(255,0,212,0.75)'
          ctx.lineWidth = 3 * this.dpr
          roundRect(ctx, x, y, layout.cellSize, layout.cellSize, 8 * this.dpr)
          ctx.fill()
          ctx.stroke()
          // X mark
          ctx.strokeStyle = 'rgba(255,0,212,0.9)'
          ctx.lineWidth = 4 * this.dpr
          ctx.beginPath()
          ctx.moveTo(x + layout.cellSize * 0.25, y + layout.cellSize * 0.25)
          ctx.lineTo(x + layout.cellSize * 0.75, y + layout.cellSize * 0.75)
          ctx.moveTo(x + layout.cellSize * 0.75, y + layout.cellSize * 0.25)
          ctx.lineTo(x + layout.cellSize * 0.25, y + layout.cellSize * 0.75)
          ctx.stroke()
        } else {
          let img = null
          try { img = await this.getTileImage(value) } catch (e) { img = null }
          if (img) {
            drawContainedImage(ctx, img, x, y, layout.cellSize, layout.cellSize)
          } else {
            // Fallback: neon text
            ctx.fillStyle = 'white'
            ctx.font = `${Math.floor(layout.cellSize * 0.38)}px sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(String(value), x + layout.cellSize / 2, y + layout.cellSize / 2)
          }
        }
        ctx.restore()
      }
    }
  }

  queueMergeEffect(cells) { if (Array.isArray(cells) && cells.length) this._queuedMerge.push(...cells) }
  queueSpawnEffect(r, c) { this._queuedSpawn.push([r, c]) }

  _emitParticlesForCells(cells, layout, color) {
    for (const [r, c] of cells) {
      const x = layout.startX + c * (layout.cellSize + layout.cellGap) + layout.cellSize / 2
      const y = layout.startY + r * (layout.cellSize + layout.cellGap) + layout.cellSize / 2
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2
        const sp = (Math.random() * 60 + 40) * this.dpr
        this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 300, color, sz: 2 * this.dpr })
      }
    }
  }

  update(dt) {
    // particles integration
    const p = this.particles
    for (let i = p.length - 1; i >= 0; i--) {
      const it = p[i]
      it.life -= dt
      if (it.life <= 0) { p.splice(i, 1); continue }
      const t = dt / 1000
      it.x += it.vx * t
      it.y += it.vy * t
      // friction
      it.vx *= 0.98
      it.vy *= 0.98
    }
  }

  render(game) {
    const { ctx, canvas } = this
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const layout = this.drawGrid(game.grid)

    // handle queued effects using current layout
    if (this._queuedMerge.length) {
      this._emitParticlesForCells(this._queuedMerge, layout, 'rgba(0,224,255,0.9)')
      this._queuedMerge = []
    }
    if (this._queuedSpawn.length) {
      this._emitParticlesForCells(this._queuedSpawn, layout, 'rgba(255,0,212,0.9)')
      this._queuedSpawn = []
    }

    // Draw tiles
    this.drawTiles(game.grid, layout)

    // Draw particles on top
    for (const it of this.particles) {
      ctx.fillStyle = it.color
      ctx.globalAlpha = Math.max(0, Math.min(1, it.life / 300))
      ctx.fillRect(it.x - it.sz / 2, it.y - it.sz / 2, it.sz, it.sz)
    }
    ctx.globalAlpha = 1
  }

  bumpTiles(positions) {
    if (!Array.isArray(positions)) return
    for (const [r, c] of positions) {
      const key = `${r},${c}`
      this.bump.set(key, 1.0)
      if (window.gsap) {
        window.gsap.killTweensOf({})
        window.gsap.to(this, { duration: 0.12, ease: 'power2.out', onUpdate: () => {
          this.bump.set(key, 1.15)
        }})
        window.gsap.to(this, { duration: 0.18, delay: 0.12, ease: 'back.out(2)', onUpdate: () => {
          this.bump.set(key, 1.0)
        }, onComplete: () => { this.bump.delete(key) }})
      } else {
        // Fallback without GSAP
        this.bump.set(key, 1.15)
        setTimeout(() => { this.bump.set(key, 1.0); setTimeout(() => this.bump.delete(key), 120) }, 120)
      }
    }
  }

  pulseSpawn(r, c) {
    const key = `${r},${c}`
    this.spawnPulse.set(key, 0.8)
    if (window.gsap) {
      window.gsap.to(this, { duration: 0.25, ease: 'back.out(3)', onUpdate: () => {
        const cur = this.spawnPulse.get(key) || 1
        this.spawnPulse.set(key, Math.min(1.0, cur + 0.05))
      }, onComplete: () => { this.spawnPulse.delete(key) }})
    } else {
      setTimeout(() => this.spawnPulse.set(key, 1), 180)
      setTimeout(() => this.spawnPulse.delete(key), 260)
    }
  }

  animateSlides(moves) {
    if (!moves || !moves.length) return Promise.resolve()
    this.slide = moves.map((m) => ({ r: m.fromR, c: m.fromC, tr: m.toR, tc: m.toC, value: m.value, p: 0 }))
    return new Promise((resolve) => {
      if (window.gsap) {
        window.gsap.to(this.slide, { duration: 0.18, p: 1, ease: 'power2.out', onComplete: () => { this.slide = []; resolve() } })
      } else {
        const start = performance.now()
        const dur = 180
        const tick = (ts) => {
          const t = Math.min(1, (ts - start) / dur)
          for (const s of this.slide) s.p = t
          if (t < 1) requestAnimationFrame(tick); else { this.slide = []; resolve() }
        }
        requestAnimationFrame(tick)
      }
    })
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawContainedImage(ctx, img, x, y, w, h) {
  const ir = img.width / img.height
  const r = w / h
  let dw = w, dh = h
  if (ir > r) { dh = w / ir } else { dw = h * ir }
  const dx = x + (w - dw) / 2
  const dy = y + (h - dh) / 2
  ctx.drawImage(img, dx, dy, dw, dh)
}