// Room shell shared by every game: setup, invite link, PeerJS sync, clocks, offers,
// persistence and the side panel. Games plug in through an adapter (see chess/ and gomoku/).
//
// The host (or the page itself in local mode) is the authority: it validates every move,
// runs the clock, and resolves offers, then pushes a full `sync` when state changes in
// ways other than a plain move.

import { Net } from "./net.js"
import { Clock, TIME_CONTROLS, timeControl, formatTime } from "./clock.js"
import * as store from "./storage.js"

const PROTOCOL = 1

export function startRoom(adapter) {
  const room = new Room(adapter)
  room.init()
  window.gameRoom = room // handy for debugging and automated tests
  return room
}

function randomCode() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789"
  let s = ""
  const buf = new Uint32Array(8)
  crypto.getRandomValues(buf)
  for (const n of buf) s += chars[n % chars.length]
  return `${s.slice(0, 4)}-${s.slice(4)}`
}

function el(html) {
  const t = document.createElement("template")
  t.innerHTML = html.trim()
  return t.content.firstElementChild
}

class Room {
  constructor(adapter) {
    this.a = adapter
    this.params = new URLSearchParams(location.search)
    this.state = null
    this.clock = null
    this.net = null
    this.netNote = ""
    this.incomingOffer = null
    this.outgoingOffer = null
    this.notice = ""
    this.chat = []
    this.lastChatAt = 0
    this.unackedPly = null // guest: ply of our last move the host has not confirmed yet
  }

  // ---------- lifecycle ----------

  init() {
    this.buildPanel()
    this.a.mount(document.getElementById("board"), { onMove: move => this.onBoardMove(move) })
    const room = this.params.get("room")
    if (this.params.has("local")) this.startLocal()
    else if (room && /^[a-z0-9-]{4,20}$/.test(room)) this.joinOrResume(room)
    else this.showSetup()
    setInterval(() => this.tick(), 200)
    armExtras(this)
  }

  storeKey() {
    return this.state.role === "local" ? `game:${this.a.id}:local` : `game:${this.a.id}:room:${this.state.room}`
  }

  persist() {
    if (!this.state) return
    store.save(this.storeKey(), { ...this.state, clock: this.clock ? this.clock.serialize(true) : null })
  }

  newState(role, room, rules) {
    return {
      v: PROTOCOL,
      game: this.a.id,
      role,
      room,
      rules,
      phase: role === "local" ? "playing" : "waiting",
      start: null,
      moves: [],
      result: null,
      gameNo: 1,
    }
  }

  readSetup() {
    const tcId = this.ui.setup.querySelector("[name=tc]").value
    const variant = this.ui.setup.querySelector("[name=variant]").value
    let side = this.ui.setup.querySelector("[name=side]").value
    side = side === "random" ? (Math.random() < 0.5 ? 0 : 1) : Number(side)
    return { tcId, variant, hostSide: side }
  }

  showSetup() {
    this.state = null
    this.render()
  }

  createRoom() {
    const code = randomCode()
    this.state = this.newState("host", code, this.readSetup())
    this.clock = new Clock(this.state.rules.tcId)
    this.rebuild()
    history.replaceState(null, "", `${location.pathname}?room=${code}`)
    this.persist()
    this.startNet()
    this.render()
  }

  startLocal(fromSetup = false) {
    const startParam = this.params.get("start")
    const variantParam = this.params.get("variant")
    let saved = !fromSetup && !startParam ? store.load(`game:${this.a.id}:local`) : null
    if (saved && variantParam && saved.rules.variant !== variantParam) saved = null
    if (saved && saved.v === PROTOCOL) {
      this.state = saved
      this.clock = new Clock(saved.rules.tcId)
      this.clock.load(saved.clock)
    } else {
      const rules = fromSetup ? this.readSetup() : { tcId: "none", variant: this.a.variants[0].value, hostSide: 0 }
      if (this.params.get("variant") && this.a.variants.some(v => v.value === this.params.get("variant"))) {
        rules.variant = this.params.get("variant")
      }
      this.state = this.newState("local", null, rules)
      if (startParam) {
        const parsed = this.a.parseStart(startParam, rules.variant)
        if (parsed) {
          this.state.start = parsed.start
          this.state.moves = parsed.moves
        }
      }
      this.clock = new Clock(rules.tcId)
    }
    // Drop start/variant from the URL so a refresh resumes this game instead of restarting it.
    history.replaceState(null, "", `${location.pathname}?local=1`)
    this.params = new URLSearchParams("local=1")
    this.rebuild()
    this.checkResult()
    this.persist()
    this.render()
  }

  joinOrResume(room) {
    const saved = store.load(`game:${this.a.id}:room:${room}`)
    if (saved && saved.v === PROTOCOL) {
      this.state = saved
      this.clock = new Clock(saved.rules.tcId)
      this.clock.load(saved.clock)
      this.rebuild()
    } else {
      this.state = { ...this.newState("guest", room, null), phase: "joining" }
    }
    this.startNet()
    this.render()
  }

  leave() {
    if (this.net) this.net.close()
    location.href = location.pathname
  }

  startNet() {
    const isHost = this.state.role === "host"
    this.net = new Net(this.a.id, this.state.room, isHost)
    this.net.addEventListener("status", e => {
      this.netNote = e.detail.note
      this.render()
    })
    this.net.addEventListener("open", () => {
      if (isHost) this.sendSync()
      else this.net.send({ type: "hello", v: PROTOCOL, ply: this.state.moves.length, token: this.guestToken() })
      this.render()
    })
    this.net.addEventListener("hello", e => this.onHello(e.detail.conn, e.detail.data))
    this.net.addEventListener("message", e => this.onMessage(e.detail))
    this.net.start()
  }

  // A per-browser secret that ties the guest seat to the first browser that joined.
  guestToken() {
    const key = `game:${this.a.id}:token:${this.state.room}`
    let token = store.load(key)
    if (!token) {
      token = randomCode() + randomCode()
      store.save(key, token)
    }
    return token
  }

  onHello(conn, data) {
    const s = this.state
    const token = typeof data.token === "string" ? data.token : ""
    if (!s.guestToken && token) {
      s.guestToken = token
      this.persist()
    }
    if (!token || token !== s.guestToken) {
      this.net.reject(conn, { type: "full" })
      return
    }
    this.net.promote(conn)
  }

  // ---------- derived ----------

  get isAuthority() {
    return this.state && (this.state.role === "host" || this.state.role === "local")
  }

  mySide() {
    const s = this.state
    if (!s || s.role === "local" || !s.rules) return null
    return s.role === "host" ? s.rules.hostSide : 1 - s.rules.hostSide
  }

  rebuild() {
    const s = this.state
    if (!s.rules) return
    this.a.reset(s.rules.variant, s.start)
    for (const m of s.moves) {
      if (!this.a.play(m)) break
    }
  }

  checkResult() {
    if (this.state.result) return
    const r = this.a.result()
    if (r) this.finish(r)
  }

  // ---------- moves ----------

  onBoardMove(move) {
    const s = this.state
    if (!s || s.phase !== "playing" || s.result) return false
    const turn = this.a.turn()
    if (s.role !== "local" && turn !== this.mySide()) return false
    if (this.isAuthority) return this.applyMove(move, turn)
    // Guest: apply optimistically, the host confirms (or corrects with a sync).
    if (!this.net.connected) {
      this.notice = "与房主的连接已断开，重连后才能走棋"
      this.render()
      return false
    }
    if (!this.a.play(move)) return false
    s.moves.push(this.a.lastMove())
    this.clock.afterMove(turn)
    this.clearOffers()
    this.net.send({ type: "move", ply: s.moves.length, move: this.a.lastMove() })
    this.unackedPly = s.moves.length
    const r = this.a.result()
    if (r) { s.result = r; s.phase = "over"; this.clock.stop() }
    this.persist()
    this.render()
    return true
  }

  applyMove(move, side) {
    const s = this.state
    if (s.phase !== "playing" || s.result || this.a.turn() !== side) return false
    if (!this.a.play(move)) return false
    const played = this.a.lastMove()
    s.moves.push(played)
    this.clock.afterMove(side)
    this.clearOffers()
    if (this.net) this.net.send({ type: "move", ply: s.moves.length, move: played, clock: this.clock.serialize() })
    this.checkResult()
    this.persist()
    this.render()
    return true
  }

  finish(result) {
    const s = this.state
    s.result = result
    s.phase = "over"
    if (this.clock) this.clock.stop()
    this.clearOffers()
    this.persist()
    this.sendSync()
    this.render()
  }

  tick() {
    if (this.state && this.isAuthority && this.state.phase === "playing" && this.clock) {
      const flagged = this.clock.flagged()
      if (flagged !== null) this.finish(this.a.timeoutResult(flagged))
    }
    this.renderClocks()
  }

  // ---------- network messages ----------

  publicState() {
    const { role, guestToken, ...rest } = this.state
    return { ...rest, clock: this.clock ? this.clock.serialize() : null }
  }

  sendSync() {
    if (this.net && this.state.role === "host") this.net.send({ type: "sync", state: this.publicState() })
  }

  onMessage(msg) {
    if (!msg || typeof msg.type !== "string") return
    const s = this.state
    if (s.role === "host") this.onHostMessage(msg)
    else this.onGuestMessage(msg)
    this.render()
  }

  onHostMessage(msg) {
    const s = this.state
    const guestSide = 1 - s.rules.hostSide
    switch (msg.type) {
      case "hello":
        this.sendSync()
        break
      case "accept":
        if (s.phase === "waiting") {
          s.phase = "playing"
          this.clock = new Clock(s.rules.tcId)
          this.persist()
          this.sendSync()
        }
        break
      case "move":
        if (msg.ply !== s.moves.length + 1 || !this.applyMove(msg.move, guestSide)) this.sendSync()
        break
      case "resign":
        if (s.phase === "playing") this.finish({ winner: s.rules.hostSide, reason: "认输" })
        break
      case "offer":
        this.receiveOffer(msg.kind)
        break
      case "reply":
        this.receiveReply(msg.kind, msg.accept, s.rules.hostSide)
        break
      case "syncReq":
        this.sendSync()
        break
      case "chat":
        this.receiveChat(msg.e)
        break
    }
  }

  onGuestMessage(msg) {
    const s = this.state
    switch (msg.type) {
      case "full":
        this.notice = "这个房间已经有对手了。请向房主要一个新的邀请链接。"
        s.phase = "full"
        this.net.close()
        break
      case "sync": {
        const incoming = msg.state
        if (!incoming || incoming.game !== this.a.id) return
        if (incoming.v !== PROTOCOL) {
          this.notice = "对方页面版本不同，请双方刷新页面"
          return
        }
        const prevGame = s.gameNo
        // A move made in the seconds before we noticed the host was gone never arrived.
        if (this.unackedPly && prevGame === incoming.gameNo && incoming.moves.length < this.unackedPly) {
          this.notice = "你的上一步没有送达对方，已撤回，请重新走"
        } else if (this.notice === "已确认，等待开局…" && incoming.phase !== "waiting") {
          this.notice = ""
        }
        this.unackedPly = null
        this.state = { ...incoming, role: "guest" }
        delete this.state.clock
        this.clock = new Clock(incoming.rules.tcId)
        this.clock.load(incoming.clock)
        if (prevGame !== incoming.gameNo) this.clearOffers()
        this.rebuild()
        this.persist()
        break
      }
      case "move":
        if (msg.ply === s.moves.length + 1) {
          if (!this.a.play(msg.move)) { this.net.send({ type: "syncReq" }); return }
          s.moves.push(this.a.lastMove())
          this.clearOffers()
          const r = this.a.result()
          if (r) { s.result = r; s.phase = "over" }
        } else if (msg.ply !== s.moves.length) {
          this.net.send({ type: "syncReq" })
          return
        }
        if (msg.ply === this.unackedPly) this.unackedPly = null // the host accepted our move
        if (msg.clock) this.clock.load(msg.clock)
        this.persist()
        break
      case "offer":
        this.receiveOffer(msg.kind)
        break
      case "reply":
        this.receiveReply(msg.kind, msg.accept, null)
        break
      case "chat":
        this.receiveChat(msg.e)
        break
    }
  }

  // ---------- offers: draw / undo / rematch ----------

  clearOffers() {
    this.incomingOffer = null
    this.outgoingOffer = null
  }

  offer(kind) {
    const s = this.state
    if (s.role === "local") {
      this.execute(kind, this.a.turn())
      return
    }
    if (!this.net || !this.net.connected) {
      this.notice = "对方不在线"
      this.render()
      return
    }
    this.outgoingOffer = kind
    this.net.send({ type: "offer", kind })
    this.render()
  }

  receiveOffer(kind) {
    if (!["draw", "undo", "rematch"].includes(kind)) return
    this.incomingOffer = kind
  }

  answer(accept) {
    const kind = this.incomingOffer
    if (!kind) return
    this.incomingOffer = null
    this.net.send({ type: "reply", kind, accept })
    // Host accepting the guest's request executes it; a guest waits for the host's sync.
    if (accept && this.state.role === "host") this.execute(kind, 1 - this.state.rules.hostSide)
    this.render()
  }

  receiveReply(kind, accept, hostSide) {
    if (this.outgoingOffer !== kind) return
    this.outgoingOffer = null
    if (!accept) {
      this.notice = `对方拒绝了${OFFER_LABEL[kind]}请求`
      return
    }
    if (hostSide !== null) this.execute(kind, hostSide)
  }

  execute(kind, requester) {
    const s = this.state
    if (kind === "draw" && s.phase === "playing") {
      this.finish({ winner: null, reason: "双方同意和棋" })
      return
    }
    if (kind === "undo" && s.phase === "playing") {
      let n = this.a.turn() === requester ? 2 : 1
      if (s.role === "local") n = 1
      if (n > s.moves.length) return
      s.moves.splice(s.moves.length - n, n)
      this.rebuild()
      if (s.moves.length > 0) this.clock.runFor(this.a.turn())
      else this.clock.stop()
    }
    if (kind === "rematch" && s.phase === "over") {
      s.rules = { ...s.rules, hostSide: s.role === "local" ? 0 : 1 - s.rules.hostSide }
      s.moves = []
      s.start = null
      s.result = null
      s.phase = "playing"
      s.gameNo += 1
      this.clock = new Clock(s.rules.tcId)
      this.rebuild()
    }
    this.clearOffers()
    this.persist()
    this.sendSync()
    this.render()
  }

  resign() {
    const s = this.state
    if (s.phase !== "playing") return
    const side = s.role === "local" ? this.a.turn() : this.mySide()
    if (s.role === "guest") {
      if (!this.net.send({ type: "resign" })) {
        this.notice = "与房主的连接已断开，重连后才能认输"
        this.render()
        return
      }
      s.result = { winner: 1 - side, reason: "认输" }
      s.phase = "over"
      this.clock.stop()
      this.persist()
      this.render()
    } else {
      this.finish({ winner: 1 - side, reason: "认输" })
    }
  }

  acceptRules() {
    this.net.send({ type: "accept" })
    this.notice = "已确认，等待开局…"
    this.render()
  }

  download() {
    const s = this.state
    const { filename, text } = this.a.exportRecord({
      result: s.result,
      date: new Date(),
      names: this.sideLabels(),
      variant: s.rules.variant,
      start: s.start,
    })
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(link.href), 1000)
  }

  copyInvite() {
    const input = this.ui.invite.querySelector("input")
    const done = () => {
      this.notice = "邀请链接已复制"
      this.render()
    }
    if (navigator.clipboard) navigator.clipboard.writeText(input.value).then(done, () => { input.select(); document.execCommand("copy"); done() })
    else { input.select(); document.execCommand("copy"); done() }
  }

  // ---------- emoji chat ----------

  sendChat(emoji) {
    if (!EMOJIS.includes(emoji)) return
    const now = Date.now()
    if (now - this.lastChatAt < CHAT_GAP_MS) return
    if (!this.net || !this.net.send({ type: "chat", e: emoji })) {
      this.notice = "对方不在线，消息没有发出"
      this.render()
      return
    }
    this.lastChatAt = now
    this.addChat(true, emoji)
  }

  receiveChat(emoji) {
    // Only the fixed emoji set is accepted, so nothing else can be injected into the page.
    if (EMOJIS.includes(emoji)) this.addChat(false, emoji)
  }

  addChat(mine, emoji) {
    this.chat.push({ mine, emoji })
    if (this.chat.length > CHAT_KEEP) this.chat.shift()
    const log = this.ui.chat.querySelector(".chat-log")
    log.appendChild(el(`<div class="msg${mine ? " mine" : ""}"><span class="who">${mine ? "你" : "对手"}</span><span class="e">${emoji}</span></div>`))
    while (log.children.length > CHAT_KEEP) log.firstElementChild.remove()
    log.scrollTop = log.scrollHeight
    // A short-lived bubble over the board so the emoji is noticed mid-game.
    const bubble = el(`<div class="bubble ${mine ? "mine" : "theirs"}">${emoji}</div>`)
    document.getElementById("board").appendChild(bubble)
    setTimeout(() => bubble.remove(), 2600)
  }

  // ---------- rendering ----------

  sideLabels() {
    const names = this.a.sideNames
    const mine = this.mySide()
    return [0, 1].map(i => (mine === null ? names[i] : `${i === mine ? "你" : "对手"}（${names[i]}）`))
  }

  buildPanel() {
    const panel = document.getElementById("panel")
    const tcOptions = TIME_CONTROLS.map(t => `<option value="${t.id}">${t.label}</option>`).join("")
    const variantOptions = this.a.variants.map(v => `<option value="${v.value}">${v.label}</option>`).join("")
    panel.innerHTML = ""
    this.ui = {
      status: el(`<div class="status" data-testid="status"></div>`),
      net: el(`<div class="net" data-testid="net"></div>`),
      setup: el(`
        <section class="card setup">
          <h2>新对局</h2>
          <label>用时<select name="tc">${tcOptions}</select></label>
          <label class="${this.a.variants.length > 1 ? "" : "hidden"}">规则<select name="variant">${variantOptions}</select></label>
          <label>我执<select name="side">
            <option value="random">随机</option>
            <option value="0">${this.a.sideNames[0]}（先手）</option>
            <option value="1">${this.a.sideNames[1]}（后手）</option>
          </select></label>
          <div class="row">
            <button data-act="create" class="primary">创建房间</button>
            <button data-act="local">本地双人</button>
          </div>
        </section>`),
      invite: el(`
        <section class="card invite">
          <h2>邀请对手</h2>
          <p class="muted">把链接发给朋友，打开即可加入。</p>
          <div class="row"><input readonly data-testid="invite"><button data-act="copy">复制</button></div>
        </section>`),
      confirm: el(`
        <section class="card confirm">
          <h2>对局规则</h2>
          <p data-testid="rules"></p>
          <button data-act="accept" class="primary">确认开始</button>
        </section>`),
      clocks: el(`<section class="clocks"></section>`),
      offer: el(`<section class="card offer"><p></p><div class="row"><button data-act="yes" class="primary">同意</button><button data-act="no">拒绝</button></div></section>`),
      actions: el(`
        <section class="actions">
          <button data-act="undo">悔棋</button>
          <button data-act="draw">提和</button>
          <button data-act="resign">认输</button>
          <button data-act="rematch" class="primary">再来一局</button>
          <button data-act="export">导出棋谱</button>
          <button data-act="leave">新建房间</button>
        </section>`),
      notice: el(`<div class="notice" data-testid="notice"></div>`),
      moves: el(`<ol class="moves" data-testid="moves"></ol>`),
      chat: el(`
        <section class="card chat">
          <h2>聊天</h2>
          <div class="chat-log" data-testid="chat-log"></div>
          <div class="emojis">${EMOJIS.map(e => `<button data-emoji="${e}" title="发送 ${e}">${e}</button>`).join("")}</div>
        </section>`),
    }
    for (const k of ["status", "net", "setup", "invite", "confirm", "clocks", "offer", "actions", "notice", "moves", "chat"]) panel.appendChild(this.ui[k])
    panel.addEventListener("click", e => {
      const emoji = e.target.closest("[data-emoji]")?.dataset.emoji
      if (emoji) {
        this.sendChat(emoji)
        return
      }
      const act = e.target.closest("[data-act]")?.dataset.act
      if (!act) return
      this.notice = ""
      const handlers = {
        create: () => this.createRoom(),
        local: () => this.startLocal(true),
        copy: () => this.copyInvite(),
        accept: () => this.acceptRules(),
        yes: () => this.answer(true),
        no: () => this.answer(false),
        undo: () => this.offer("undo"),
        draw: () => this.offer("draw"),
        rematch: () => this.offer("rematch"),
        resign: () => this.resign(),
        export: () => this.download(),
        leave: () => this.leave(),
      }
      handlers[act]?.()
    })
  }

  rulesText() {
    const r = this.state.rules
    const variant = this.a.variants.find(v => v.value === r.variant)
    const parts = [timeControl(r.tcId).label]
    if (this.a.variants.length > 1 && variant) parts.push(variant.label)
    const mine = this.mySide()
    if (mine !== null) parts.push(`你执${this.a.sideNames[mine]}`)
    return parts.join(" · ")
  }

  statusText() {
    const s = this.state
    if (!s) return "创建房间，或者在本地和朋友轮流下"
    const names = this.a.sideNames
    const mine = this.mySide()
    if (s.phase === "joining") return "正在加入房间…"
    if (s.phase === "full") return "房间已满"
    if (s.phase === "waiting") {
      if (s.role === "host") return this.net && this.net.connected ? "对手已加入，等待对方确认规则" : "等待对手加入…"
      return "请确认规则后开始"
    }
    if (s.phase === "over" && s.result) {
      const r = s.result
      if (r.winner === null) return `和棋 · ${r.reason}`
      const who = mine === null ? `${names[r.winner]}胜` : r.winner === mine ? "你赢了" : "你输了"
      return `${who} · ${r.reason}`
    }
    const turn = this.a.turn()
    if (mine === null) return `轮到${names[turn]}`
    return turn === mine ? "轮到你走" : "等待对手走棋"
  }

  render() {
    const s = this.state
    const ui = this.ui
    const show = (node, on) => node.classList.toggle("hidden", !on)
    const online = s && s.role !== "local"
    const playing = s && s.phase === "playing"
    const over = s && s.phase === "over"
    const connected = this.net && this.net.connected

    ui.status.textContent = this.statusText()
    const netText = !online ? (s ? "本地双人" : "") : connected ? "已连接" : this.netNote || "未连接"
    ui.net.textContent = netText
    ui.net.className = `net ${online ? (connected ? "ok" : "bad") : ""}`

    show(ui.setup, !s)
    show(ui.invite, s && s.role === "host" && s.phase === "waiting")
    if (s && s.room) ui.invite.querySelector("input").value = `${location.origin}${location.pathname}?room=${s.room}`
    show(ui.confirm, s && s.role === "guest" && s.phase === "waiting")
    if (s && s.rules) ui.confirm.querySelector("p").textContent = this.rulesText()

    show(ui.offer, !!this.incomingOffer)
    if (this.incomingOffer) ui.offer.querySelector("p").textContent = `对方请求${OFFER_LABEL[this.incomingOffer]}`

    show(ui.actions, playing || over)
    const btn = act => ui.actions.querySelector(`[data-act=${act}]`)
    const waitingReply = !!this.outgoingOffer
    show(btn("undo"), playing)
    // Undo takes back the requester's own last move (two plies if it is their turn again).
    const undoPlies = !s || s.role === "local" ? 1 : playing && this.a.turn() === this.mySide() ? 2 : 1
    btn("undo").disabled = !s || s.moves.length < undoPlies || waitingReply
    show(btn("draw"), playing && online)
    btn("draw").disabled = waitingReply
    show(btn("resign"), playing)
    show(btn("rematch"), over)
    btn("rematch").disabled = waitingReply
    show(btn("export"), (playing || over) && s.moves.length > 0)
    show(btn("leave"), !playing || s.role === "local")
    btn("leave").textContent = s && s.role === "local" ? "返回设置" : "新建房间"
    btn("rematch").textContent = online ? "再来一局（交换先后）" : "再来一局"

    const note = this.outgoingOffer ? `已发送${OFFER_LABEL[this.outgoingOffer]}请求，等待对方回应…` : this.notice
    ui.notice.textContent = note
    show(ui.notice, !!note)

    show(ui.clocks, s && s.rules && s.phase !== "joining")
    this.renderClocks()

    ui.moves.innerHTML = ""
    if (s && s.rules) {
      for (const row of this.a.moveRows()) ui.moves.appendChild(el(`<li>${row}</li>`))
      ui.moves.scrollTop = ui.moves.scrollHeight
    }
    show(ui.moves, s && s.moves.length > 0)
    show(ui.chat, online && s.rules && !["joining", "full"].includes(s.phase))

    if (s && s.rules) {
      const mine = this.mySide()
      let interactive = null
      if (playing) interactive = s.role === "local" ? this.a.turn() : this.a.turn() === mine ? mine : null
      this.a.setView({ orientation: mine ?? (s.role === "local" ? 0 : 0), interactive })
    } else {
      this.a.setView({ orientation: 0, interactive: null })
    }
    document.body.dataset.phase = s ? s.phase : "setup"
  }

  renderClocks() {
    const s = this.state
    if (!s || !s.rules || !this.clock) return
    const labels = this.sideLabels()
    const mine = this.mySide()
    const bottom = mine ?? 0
    const order = [1 - bottom, bottom]
    const turn = s.phase === "playing" ? this.a.turn() : null
    const html = order
      .map(i => {
        const time = this.clock.enabled ? formatTime(this.clock.remaining(i)) : ""
        const low = this.clock.enabled && this.clock.remaining(i) < 20000 ? " low" : ""
        return `<div class="clock${turn === i ? " active" : ""}${low}" data-side="${i}"><span class="who"><i class="dot side${i}"></i>${labels[i]}</span><span class="time">${time}</span></div>`
      })
      .join("")
    if (this.ui.clocks.innerHTML !== html) this.ui.clocks.innerHTML = html
  }
}

// ---------- extras ----------
// Optional add-ons ship encrypted in room.dat and are unlocked with a passphrase: press "~",
// or hold the clocks for 1.5 s on a touch screen. The same gesture later shows / hides them.

let extras = null

function armExtras(room) {
  const trigger = () => (extras ? extras.toggle() : askPassphrase(room))
  addEventListener("keydown", e => {
    if ((e.key === "~" || e.key === "`") && !e.target.closest?.("input, textarea, select")) { e.preventDefault(); trigger() }
  })
  const clocks = room.ui.clocks
  let since = 0
  clocks.addEventListener("pointerdown", () => { since = Date.now() })
  clocks.addEventListener("pointerup", () => { if (since && Date.now() - since > 1400) trigger(); since = 0 })
  clocks.addEventListener("pointercancel", () => { since = 0 })
  clocks.addEventListener("contextmenu", e => e.preventDefault())
}

function askPassphrase(room) {
  if (document.querySelector(".pass-box")) return
  const box = el(`<form class="pass-box"><input type="password" autocomplete="off" autocapitalize="off" aria-label="口令"></form>`)
  const input = box.querySelector("input")
  input.addEventListener("keydown", e => { if (e.key === "Escape") box.remove() })
  input.addEventListener("blur", () => setTimeout(() => box.remove(), 150))
  box.addEventListener("submit", async e => {
    e.preventDefault()
    box.remove()
    try { extras = await unlock(room, input.value) } catch { /* wrong passphrase: stay quiet */ }
  })
  document.body.appendChild(box)
  input.focus()
}

async function unlock(room, word) {
  const buf = new Uint8Array(await (await fetch(new URL("./room.dat", import.meta.url))).arrayBuffer())
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(word), "PBKDF2", false, ["deriveKey"])
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: buf.slice(0, 16), iterations: 600000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"])
  const code = await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf.slice(16, 28) }, key, buf.slice(28))
  const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }))
  return (await import(url)).default(room, word, import.meta.url)
}

const OFFER_LABEL = { draw: "和棋", undo: "悔棋", rematch: "再来一局" }
const EMOJIS = ["👍", "👏", "😂", "😮", "😅", "🤔", "😎", "😭", "😡", "🙏", "🔥", "💀", "🎉", "🤝", "⏰", "👋"]
const CHAT_KEEP = 50
const CHAT_GAP_MS = 600
