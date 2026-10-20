// PeerJS wrapper. The host owns a fixed peer id derived from the room code so the
// guest can find it again after either side refreshes; the guest uses a random id.

const PeerCtor = () => window.Peer || (window.peerjs && window.peerjs.Peer)
const PREFIX = "fffeiya-game-"
const PING_MS = 3000
const DEAD_MS = 10000
const RETRY_MS = 3000

// Relay (TURN) servers are needed when neither side can be reached directly (mobile data,
// campus networks). Short-lived credentials come from a small Worker; without them we fall
// back to STUN only, which still works on friendlier networks.
const ICE_URL = "https://game-ice.fffeiya.workers.dev"
const STUN = [{ urls: "stun:stun.cloudflare.com:3478" }, { urls: "stun:stun.l.google.com:19302" }]
const ICE_FRESH_MS = 3600 * 1000
let ice = null // { at, servers }

async function iceServers() {
  if (ice && Date.now() - ice.at < ICE_FRESH_MS) return ice.servers
  try {
    const res = await fetch(ICE_URL, { signal: AbortSignal.timeout(4000) })
    const data = res.ok ? await res.json() : null
    if (data && Array.isArray(data.iceServers) && data.iceServers.length) {
      ice = { at: Date.now(), servers: [...data.iceServers, STUN[1]] }
      return ice.servers
    }
  } catch {}
  return STUN
}

export class Net extends EventTarget {
  constructor(game, room, isHost) {
    super()
    this.hostId = `${PREFIX}${game}-${room}`
    this.isHost = isHost
    this.peer = null
    this.conn = null
    this.status = "idle"
    this.lastSeen = 0
    this.closed = false
    this.retryTimer = null
    this.pingTimer = setInterval(() => this.heartbeat(), PING_MS)
  }

  start() {
    const Peer = PeerCtor()
    if (!Peer) {
      this.setStatus("error", "联机组件加载失败")
      return
    }
    this.setStatus("connecting")
    iceServers().then(servers => {
      if (!this.closed && !this.peer) this.open(Peer, { config: { iceServers: servers } })
    })
  }

  open(Peer, options) {
    this.peer = this.isHost ? new Peer(this.hostId, options) : new Peer(options)
    this.peer.on("open", () => {
      if (this.isHost) this.setStatus("waiting")
      else this.connectToHost()
    })
    this.peer.on("connection", conn => {
      if (!this.isHost) { conn.close(); return }
      this.attachCandidate(conn)
    })
    this.peer.on("disconnected", () => {
      // Lost the signaling server only; the data channel may still be alive.
      if (!this.closed && !this.peer.destroyed) setTimeout(() => this.peer && !this.peer.destroyed && this.peer.reconnect(), RETRY_MS)
    })
    this.peer.on("error", err => {
      if (this.closed) return
      if (err.type === "unavailable-id") {
        // Our previous session (before a refresh) still holds the id on the server for a few seconds.
        this.setStatus("connecting", "房间 ID 仍被占用，正在重试…")
        this.restartLater()
      } else if (err.type === "peer-unavailable") {
        this.setStatus("waiting", "房主不在线，正在重试…")
        this.scheduleRetry()
      } else if (["network", "server-error", "socket-error", "socket-closed"].includes(err.type)) {
        this.setStatus("connecting", "连接服务器失败，正在重试…")
        this.restartLater()
      } else {
        this.setStatus("error", `联机错误：${err.type}`)
      }
    })
  }

  restartLater() {
    this.teardown()
    clearTimeout(this.retryTimer)
    this.retryTimer = setTimeout(() => !this.closed && this.start(), RETRY_MS)
  }

  scheduleRetry() {
    clearTimeout(this.retryTimer)
    this.retryTimer = setTimeout(() => !this.closed && this.connectToHost(), RETRY_MS)
  }

  connectToHost() {
    if (this.closed || !this.peer || this.peer.destroyed) return
    if (this.peer.disconnected) { this.peer.reconnect(); this.scheduleRetry(); return }
    this.setStatus("connecting", "正在连接房主…")
    this.attach(this.peer.connect(this.hostId, { reliable: true, serialization: "json" }))
  }

  // Host side: a new connection only becomes the active guest after its hello is accepted
  // (see promote/reject), so a stranger with the link cannot kick the real guest out.
  attachCandidate(conn) {
    const timer = setTimeout(() => conn.close(), DEAD_MS)
    conn.on("data", data => {
      if (this.conn === conn || !data || data.type !== "hello") return
      clearTimeout(timer)
      this.dispatchEvent(new CustomEvent("hello", { detail: { conn, data } }))
    })
    conn.on("close", () => clearTimeout(timer))
  }

  promote(conn) {
    if (this.conn && this.conn !== conn) this.conn.close()
    this.attach(conn, true)
  }

  reject(conn, msg) {
    try { conn.send(msg) } catch {}
    setTimeout(() => conn.close(), 500)
  }

  attach(conn, alreadyOpen = false) {
    this.conn = conn
    const opened = () => {
      if (this.conn !== conn) return
      this.lastSeen = Date.now()
      this.setStatus("connected")
      this.dispatchEvent(new CustomEvent("open"))
    }
    if (alreadyOpen) opened()
    else conn.on("open", opened)
    conn.on("data", data => {
      if (this.conn !== conn) return
      this.lastSeen = Date.now()
      if (data && data.type === "ping") return
      this.dispatchEvent(new CustomEvent("message", { detail: data }))
    })
    const lost = () => {
      if (this.conn !== conn) return
      this.conn = null
      this.setStatus(this.isHost ? "waiting" : "connecting", "对方已断开")
      if (!this.isHost) this.scheduleRetry()
    }
    conn.on("close", lost)
    conn.on("error", lost)
  }

  heartbeat() {
    if (!this.conn || !this.conn.open) return
    if (Date.now() - this.lastSeen > DEAD_MS) {
      const c = this.conn
      this.conn = null
      c.close()
      this.setStatus(this.isHost ? "waiting" : "connecting", "连接超时")
      if (!this.isHost) this.scheduleRetry()
      return
    }
    this.conn.send({ type: "ping" })
  }

  send(msg) {
    if (this.conn && this.conn.open) {
      this.conn.send(msg)
      return true
    }
    return false
  }

  get connected() {
    return !!(this.conn && this.conn.open)
  }

  setStatus(status, note = "") {
    this.status = status
    this.dispatchEvent(new CustomEvent("status", { detail: { status, note } }))
  }

  teardown() {
    if (this.conn) { try { this.conn.close() } catch {} }
    this.conn = null
    if (this.peer) { try { this.peer.destroy() } catch {} }
    this.peer = null
  }

  close() {
    this.closed = true
    clearInterval(this.pingTimer)
    clearTimeout(this.retryTimer)
    this.teardown()
  }
}
