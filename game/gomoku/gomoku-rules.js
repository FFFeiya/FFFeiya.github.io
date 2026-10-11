// Pure gomoku rules: 15x15 board, black (1) moves first, white (2).
// "freestyle": five or more in a row wins.
// "renju": black must make exactly five; black's overline, double-four and double-three are forbidden.

export const SIZE = 15
export const EMPTY = 0
export const BLACK = 1
export const WHITE = 2
const LETTERS = "abcdefghijklmno"
const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]]
const MAX_DEPTH = 4

export function emptyBoard() {
  return Array.from({ length: SIZE }, () => new Array(SIZE).fill(EMPTY))
}

// "h8" <-> {x: 7, y: 7}; y counts rows from the bottom (row 1 = y 0).
export function parseMove(s) {
  const m = /^([a-o])(1[0-5]|[1-9])$/.exec(String(s).trim().toLowerCase())
  return m ? { x: LETTERS.indexOf(m[1]), y: Number(m[2]) - 1 } : null
}

export function moveName(x, y) {
  return `${LETTERS[x]}${y + 1}`
}

const inside = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE

function runLength(b, x, y, dx, dy, color) {
  let n = 1
  for (let i = 1; inside(x + dx * i, y + dy * i) && b[y + dy * i][x + dx * i] === color; i++) n++
  for (let i = 1; inside(x - dx * i, y - dy * i) && b[y - dy * i][x - dx * i] === color; i++) n++
  return n
}

// Offsets k along (dx, dy) from the black stone at (x, y) where one more black stone
// would form exactly five that passes through (x, y).
function fivePoints(b, x, y, dx, dy) {
  const out = []
  for (let k = -4; k <= 4; k++) {
    if (k === 0) continue
    const qx = x + dx * k
    const qy = y + dy * k
    if (!inside(qx, qy) || b[qy][qx] !== EMPTY) continue
    b[qy][qx] = BLACK
    // The run through q must also contain the origin: every cell between them is black.
    let joined = true
    const step = Math.sign(k)
    for (let i = step; i !== k; i += step) if (b[y + dy * i][x + dx * i] !== BLACK) { joined = false; break }
    if (joined && runLength(b, qx, qy, dx, dy, BLACK) === 5) out.push(k)
    b[qy][qx] = EMPTY
  }
  return out
}

function countFours(points) {
  if (points.length === 2 && Math.abs(points[0] - points[1]) === 5) return 1 // one straight (open) four
  return points.length
}

function isStraightFour(points) {
  return points.length === 2 && Math.abs(points[0] - points[1]) === 5
}

// Returns null if black may play (x, y), otherwise the reason it is forbidden.
export function forbiddenReason(b, x, y, depth = 0) {
  if (b[y][x] !== EMPTY) return null
  b[y][x] = BLACK
  try {
    const runs = DIRS.map(([dx, dy]) => runLength(b, x, y, dx, dy, BLACK))
    if (runs.some(n => n === 5)) return null
    if (runs.some(n => n > 5)) return "长连禁手"
    let fours = 0
    let threes = 0
    for (const [dx, dy] of DIRS) {
      const points = fivePoints(b, x, y, dx, dy)
      if (points.length > 0) {
        fours += countFours(points)
        continue
      }
      if (depth >= MAX_DEPTH) continue
      for (let k = -4; k <= 4; k++) {
        if (k === 0) continue
        const qx = x + dx * k
        const qy = y + dy * k
        if (!inside(qx, qy) || b[qy][qx] !== EMPTY) continue
        b[qy][qx] = BLACK
        const straight = isStraightFour(fivePoints(b, x, y, dx, dy))
        b[qy][qx] = EMPTY
        if (straight && !forbiddenReason(b, qx, qy, depth + 1)) {
          threes++
          break
        }
      }
    }
    if (fours >= 2) return "四四禁手"
    if (threes >= 2) return "三三禁手"
    return null
  } finally {
    b[y][x] = EMPTY
  }
}

export class Gomoku {
  constructor(variant = "freestyle") {
    this.variant = variant
    this.board = emptyBoard()
    this.moves = []
    this.winLine = null
  }

  get turnColor() {
    return this.moves.length % 2 === 0 ? BLACK : WHITE
  }

  // Why the side to move may not play here, or null if legal.
  illegalReason(x, y) {
    if (!inside(x, y)) return "超出棋盘"
    if (this.board[y][x] !== EMPTY) return "此处已有棋子"
    if (this.winLine || this.moves.length >= SIZE * SIZE) return "对局已结束"
    if (this.variant === "renju" && this.turnColor === BLACK) return forbiddenReason(this.board, x, y)
    return null
  }

  play(name) {
    const p = parseMove(name)
    if (!p || this.illegalReason(p.x, p.y)) return false
    const color = this.turnColor
    this.board[p.y][p.x] = color
    this.moves.push(moveName(p.x, p.y))
    this.winLine = this.findWin(p.x, p.y, color)
    return true
  }

  undo() {
    const name = this.moves.pop()
    if (!name) return
    const p = parseMove(name)
    this.board[p.y][p.x] = EMPTY
    this.winLine = null
  }

  findWin(x, y, color) {
    const exact = this.variant === "renju" && color === BLACK
    for (const [dx, dy] of DIRS) {
      const n = runLength(this.board, x, y, dx, dy, color)
      if (exact ? n === 5 : n >= 5) {
        let sx = x, sy = y
        while (inside(sx - dx, sy - dy) && this.board[sy - dy][sx - dx] === color) { sx -= dx; sy -= dy }
        return Array.from({ length: n }, (_, i) => ({ x: sx + dx * i, y: sy + dy * i }))
      }
    }
    return null
  }

  // {winner: 0 (black) | 1 (white) | null, reason} or null while the game goes on.
  result() {
    if (this.winLine) return { winner: this.moves.length % 2 === 1 ? 0 : 1, reason: "五连" }
    if (this.moves.length >= SIZE * SIZE) return { winner: null, reason: "棋盘已满" }
    return null
  }
}
