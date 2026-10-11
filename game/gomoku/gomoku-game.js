// Gomoku adapter for the room shell: rules in gomoku-rules.js, board drawn on a canvas.

import { Gomoku, SIZE, EMPTY, BLACK, WHITE, parseMove, moveName, forbiddenReason } from "./gomoku-rules.js"

const LETTERS = "ABCDEFGHIJKLMNO"
const STARS = [[3, 3], [11, 3], [7, 7], [3, 11], [11, 11]]

export function createGomokuAdapter() {
  let game = new Gomoku()
  let canvas = null
  let ctx = null
  let onMove = null
  let interactive = null
  let hover = null
  let forbiddenCache = { key: "", points: [] }

  function geometry() {
    const size = canvas.clientWidth
    const margin = size * 0.08
    const step = (size - margin * 2) / (SIZE - 1)
    return { size, margin, step }
  }

  // Board coordinates (x right, y up from row 1) to canvas pixels.
  function toPixel(x, y) {
    const { margin, step } = geometry()
    return [margin + x * step, margin + (SIZE - 1 - y) * step]
  }

  function fromPixel(px, py) {
    const { margin, step } = geometry()
    const x = Math.round((px - margin) / step)
    const y = SIZE - 1 - Math.round((py - margin) / step)
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return null
    const [cx, cy] = toPixel(x, y)
    return Math.hypot(px - cx, py - cy) <= step * 0.48 ? { x, y } : null
  }

  function forbiddenPoints() {
    if (game.variant !== "renju" || game.turnColor !== BLACK || game.result()) return []
    const key = game.moves.join(",")
    if (forbiddenCache.key === key) return forbiddenCache.points
    const points = []
    const near = (x, y) => {
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && game.board[ny][nx] !== EMPTY) return true
        }
      return false
    }
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++)
        if (game.board[y][x] === EMPTY && near(x, y) && forbiddenReason(game.board, x, y)) points.push({ x, y })
    forbiddenCache = { key, points }
    return points
  }

  function drawStone(x, y, color, alpha = 1) {
    const { step } = geometry()
    const [cx, cy] = toPixel(x, y)
    const r = step * 0.46
    const grad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r)
    if (color === BLACK) {
      grad.addColorStop(0, "#5a5a5a")
      grad.addColorStop(1, "#0a0a0a")
    } else {
      grad.addColorStop(0, "#ffffff")
      grad.addColorStop(1, "#cfcfc8")
    }
    ctx.globalAlpha = alpha
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()
    if (color === WHITE) {
      ctx.strokeStyle = "rgba(0,0,0,0.35)"
      ctx.lineWidth = 1
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  function draw() {
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const cssSize = canvas.clientWidth
    if (canvas.width !== Math.round(cssSize * dpr)) {
      canvas.width = Math.round(cssSize * dpr)
      canvas.height = Math.round(cssSize * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const { size, margin, step } = geometry()

    ctx.fillStyle = "#dcb35c"
    ctx.fillRect(0, 0, size, size)

    ctx.strokeStyle = "#3b2f1e"
    ctx.lineWidth = 1
    for (let i = 0; i < SIZE; i++) {
      const p = margin + i * step
      ctx.beginPath(); ctx.moveTo(margin, p); ctx.lineTo(size - margin, p); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(p, margin); ctx.lineTo(p, size - margin); ctx.stroke()
    }
    ctx.lineWidth = 2
    ctx.strokeRect(margin, margin, size - margin * 2, size - margin * 2)
    ctx.fillStyle = "#3b2f1e"
    for (const [x, y] of STARS) {
      const [cx, cy] = toPixel(x, y)
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(2.5, step * 0.09), 0, Math.PI * 2); ctx.fill()
    }

    ctx.fillStyle = "#4a3b24"
    ctx.font = `${Math.round(step * 0.36)}px system-ui, sans-serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    for (let i = 0; i < SIZE; i++) {
      const [lx] = toPixel(i, 0)
      ctx.fillText(LETTERS[i], lx, size - margin * 0.3)
      const [, ly] = toPixel(0, i)
      ctx.fillText(String(i + 1), margin * 0.3, ly)
    }

    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++)
        if (game.board[y][x] !== EMPTY) drawStone(x, y, game.board[y][x])

    const lastName = game.moves[game.moves.length - 1]
    if (lastName) {
      const p = parseMove(lastName)
      const [cx, cy] = toPixel(p.x, p.y)
      ctx.fillStyle = "#e0402a"
      ctx.beginPath(); ctx.arc(cx, cy, step * 0.12, 0, Math.PI * 2); ctx.fill()
    }

    if (game.winLine) {
      const a = toPixel(game.winLine[0].x, game.winLine[0].y)
      const b = toPixel(game.winLine[game.winLine.length - 1].x, game.winLine[game.winLine.length - 1].y)
      ctx.strokeStyle = "rgba(224,64,42,0.85)"
      ctx.lineWidth = Math.max(3, step * 0.12)
      ctx.lineCap = "round"
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke()
      ctx.lineCap = "butt"
    }

    if (interactive !== null) {
      ctx.strokeStyle = "#b4412f"
      ctx.lineWidth = 2
      for (const f of forbiddenPoints()) {
        const [cx, cy] = toPixel(f.x, f.y)
        const d = step * 0.18
        ctx.beginPath(); ctx.moveTo(cx - d, cy - d); ctx.lineTo(cx + d, cy + d); ctx.moveTo(cx + d, cy - d); ctx.lineTo(cx - d, cy + d); ctx.stroke()
      }
      if (hover && !game.illegalReason(hover.x, hover.y)) drawStone(hover.x, hover.y, game.turnColor, 0.45)
    }
  }

  function pointerPos(e) {
    const rect = canvas.getBoundingClientRect()
    return fromPixel(e.clientX - rect.left, e.clientY - rect.top)
  }

  return {
    id: "gomoku",
    sideNames: ["黑方", "白方"],
    variants: [
      { value: "freestyle", label: "无禁手" },
      { value: "renju", label: "禁手（黑棋）" },
    ],

    mount(el, handlers) {
      onMove = handlers.onMove
      canvas = document.createElement("canvas")
      canvas.style.width = "100%"
      canvas.style.height = "100%"
      canvas.style.display = "block"
      canvas.style.cursor = "pointer"
      canvas.style.borderRadius = "4px"
      el.appendChild(canvas)
      ctx = canvas.getContext("2d")
      canvas.addEventListener("pointermove", e => {
        const p = pointerPos(e)
        if (p?.x !== hover?.x || p?.y !== hover?.y) { hover = p; draw() }
      })
      canvas.addEventListener("pointerleave", () => { hover = null; draw() })
      canvas.addEventListener("click", e => {
        if (interactive === null) return
        const p = pointerPos(e)
        if (!p || game.illegalReason(p.x, p.y)) return
        onMove(moveName(p.x, p.y))
      })
      new ResizeObserver(draw).observe(el)
    },

    reset(variant) {
      game = new Gomoku(variant)
      forbiddenCache = { key: "", points: [] }
    },

    play(move) {
      return game.play(move)
    },

    lastMove() {
      return game.moves[game.moves.length - 1]
    },

    turn() {
      return game.moves.length % 2
    },

    stones() {
      return game.board.map(row => row.slice())
    },

    result() {
      return game.result()
    },

    timeoutResult(flagSide) {
      return { winner: 1 - flagSide, reason: "超时" }
    },

    setView({ interactive: side }) {
      interactive = side
      if (side === null) hover = null
      draw()
    },

    moveRows() {
      return game.moves.map(m => m.toUpperCase())
    },

    exportRecord({ result, date, names, variant }) {
      const stamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
      const res = !result ? "未结束" : result.winner === null ? `和棋（${result.reason}）` : `${this.sideNames[result.winner]}胜（${result.reason}）`
      const lines = [
        `# 五子棋对局`,
        `日期: ${stamp}`,
        `规则: ${variant === "renju" ? "禁手" : "无禁手"}，15 路`,
        `黑方: ${names[0]}`,
        `白方: ${names[1]}`,
        `结果: ${res}`,
        ``,
        game.moves.map((m, i) => `${i + 1}. ${m}`).join(" "),
        ``,
      ]
      return { filename: `gomoku-${stamp.replaceAll("-", "")}.txt`, text: lines.join("\n") }
    },

    parseStart(str) {
      const moves = str.split(/[\s,]+/).filter(Boolean)
      return moves.every(m => parseMove(m)) ? { start: null, moves: moves.map(m => m.toLowerCase()) } : null
    },
  }
}
