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
  return new Promise((resolve, reject) => {
    const img = new Image()
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

    // Grid background glow
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
    ctx.fillRect(0, 0, canvas.width, canvas.height)

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
    for (let r = 0; r < layout.n; r++) {
      for (let c = 0; c < layout.n; c++) {
        const value = grid[r][c]
        if (!value) continue
        const img = await this.getTileImage(value)
        const x = layout.startX + c * (layout.cellSize + layout.cellGap)
        const y = layout.startY + r * (layout.cellSize + layout.cellGap)
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
    }
  }

  render(game) {
    const { ctx, canvas } = this
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const layout = this.drawGrid(game.grid)
    // Draw synchronously; images may still be loading
    this.drawTiles(game.grid, layout)
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