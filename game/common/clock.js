// Two-sided game clock. Times are remaining milliseconds; `running` is the side whose
// time is ticking (null before the first move or after the game ends).

export const TIME_CONTROLS = [
  { id: "none", label: "不限时", base: 0, inc: 0 },
  { id: "3+2", label: "3 分钟 + 2 秒", base: 180000, inc: 2000 },
  { id: "5+3", label: "5 分钟 + 3 秒", base: 300000, inc: 3000 },
  { id: "10+5", label: "10 分钟 + 5 秒", base: 600000, inc: 5000 },
  { id: "15+10", label: "15 分钟 + 10 秒", base: 900000, inc: 10000 },
  { id: "30+0", label: "30 分钟", base: 1800000, inc: 0 },
]

export function timeControl(id) {
  return TIME_CONTROLS.find(t => t.id === id) || TIME_CONTROLS[0]
}

export class Clock {
  constructor(tcId) {
    this.tc = timeControl(tcId)
    this.t = [this.tc.base, this.tc.base]
    this.running = null
    this.since = Date.now()
  }

  get enabled() {
    return this.tc.base > 0
  }

  remaining(side) {
    const elapsed = this.running === side ? Date.now() - this.since : 0
    return Math.max(0, this.t[side] - elapsed)
  }

  // Called after `mover` completes a move: bank their time, add increment, start the opponent.
  afterMove(mover) {
    if (!this.enabled) return
    this.t[mover] = this.remaining(mover) + (this.running === mover ? this.tc.inc : 0)
    this.running = 1 - mover
    this.since = Date.now()
  }

  // Restart ticking for `side` (used after undo). Banks whoever was running first.
  runFor(side) {
    if (!this.enabled) return
    if (this.running !== null) this.t[this.running] = this.remaining(this.running)
    this.running = side
    this.since = Date.now()
  }

  stop() {
    if (this.running !== null) this.t[this.running] = this.remaining(this.running)
    this.running = null
  }

  flagged() {
    return this.enabled && this.running !== null && this.remaining(this.running) <= 0 ? this.running : null
  }

  // `stamped` adds a local wall-clock time so a reload can charge the time spent away
  // to the running side. Network messages are not stamped (the peers' clocks differ).
  serialize(stamped = false) {
    const data = { t: [this.remaining(0), this.remaining(1)], running: this.running }
    if (stamped) data.at = Date.now()
    return data
  }

  load(data) {
    if (!data) return
    this.t = [data.t[0], data.t[1]]
    this.running = data.running
    this.since = Date.now()
    if (data.at && this.running !== null) {
      this.t[this.running] = Math.max(0, this.t[this.running] - Math.max(0, Date.now() - data.at))
    }
  }
}

export function formatTime(ms) {
  const s = Math.ceil(ms / 1000)
  const m = Math.floor(s / 60)
  const r = s % 60
  if (ms < 10000 && ms > 0) return `0:${(ms / 1000).toFixed(1).padStart(4, "0")}`
  return `${m}:${String(r).padStart(2, "0")}`
}
