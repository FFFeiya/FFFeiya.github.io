// Chess adapter for the room shell: rules via chess.js, board via cm-chessboard.

import { Chess } from "./vendor/chess.js/chess.js"
import { Chessboard, COLOR, INPUT_EVENT_TYPE, BORDER_TYPE } from "./vendor/cm-chessboard/src/Chessboard.js"
import { Markers, MARKER_TYPE } from "./vendor/cm-chessboard/src/extensions/markers/Markers.js"
import { PromotionDialog, PROMOTION_DIALOG_RESULT_TYPE } from "./vendor/cm-chessboard/src/extensions/promotion-dialog/PromotionDialog.js"

const LAST_MOVE = MARKER_TYPE.square
const CHECK = MARKER_TYPE.circleDangerFilled

export function createChessAdapter() {
  let chess = new Chess()
  let board = null
  let onMove = null
  let last = null
  let interactive = null
  let shownFen = null
  let shownOrientation = null
  let inputSide = null
  let startSide = 0

  const sideOf = color => (color === "w" ? 0 : 1)
  const colorOf = side => (side === 0 ? COLOR.white : COLOR.black)

  function inputHandler(event) {
    if (interactive === null) return false
    switch (event.type) {
      case INPUT_EVENT_TYPE.moveInputStarted: {
        const piece = chess.get(event.squareFrom)
        return !!piece && sideOf(piece.color) === interactive && chess.moves({ square: event.squareFrom }).length > 0
      }
      case INPUT_EVENT_TYPE.validateMoveInput: {
        const { squareFrom: from, squareTo: to } = event
        const candidates = chess.moves({ square: from, verbose: true }).filter(m => m.to === to)
        if (candidates.length === 0) return false
        if (candidates.some(m => m.promotion)) {
          board.showPromotionDialog(to, colorOf(interactive), result => {
            if (result.type === PROMOTION_DIALOG_RESULT_TYPE.pieceSelected) {
              if (!onMove({ from, to, promotion: result.piece.charAt(1) })) forceRedraw()
            } else {
              forceRedraw()
            }
          })
          return true
        }
        // Hand the move to the room after cm-chessboard finishes its own input handling.
        setTimeout(() => {
          if (!onMove({ from, to })) forceRedraw()
        })
        return true
      }
      default:
        return true
    }
  }

  function forceRedraw() {
    shownFen = null
    redraw()
  }

  function redraw() {
    if (!board) return
    const fen = chess.fen()
    if (fen !== shownFen) {
      const animate = shownFen !== null
      shownFen = fen
      board.setPosition(fen, animate)
    }
    board.removeMarkers(LAST_MOVE)
    board.removeMarkers(CHECK)
    if (last) {
      board.addMarker(LAST_MOVE, last.from)
      board.addMarker(LAST_MOVE, last.to)
    }
    if (chess.inCheck()) {
      const king = chess.findPiece({ type: "k", color: chess.turn() })[0]
      if (king) board.addMarker(CHECK, king)
    }
  }

  function hasOnlyKing(side) {
    const color = side === 0 ? "w" : "b"
    return chess.board().flat().filter(p => p && p.color === color).length === 1
  }

  return {
    id: "chess",
    sideNames: ["白方", "黑方"],
    variants: [{ value: "standard", label: "标准" }],

    mount(el, handlers) {
      onMove = handlers.onMove
      board = new Chessboard(el, {
        position: chess.fen(),
        assetsUrl: new URL("./vendor/cm-chessboard/assets/", import.meta.url).href,
        style: { cssClass: "green", borderType: BORDER_TYPE.frame, animationDuration: 150 },
        extensions: [{ class: Markers, props: { autoMarkers: MARKER_TYPE.frame } }, { class: PromotionDialog, props: { language: "en" } }],
      })
    },

    reset(variant, start) {
      chess = new Chess(start || undefined)
      startSide = sideOf(chess.turn())
      last = null
    },

    play(move) {
      try {
        const m = chess.move(move)
        last = { from: m.from, to: m.to, ...(m.promotion ? { promotion: m.promotion } : {}) }
        return true
      } catch {
        return false
      }
    },

    lastMove() {
      return last
    },

    turn() {
      return sideOf(chess.turn())
    },

    fen() {
      return chess.fen()
    },

    result() {
      if (chess.isCheckmate()) return { winner: 1 - sideOf(chess.turn()), reason: "将死" }
      if (chess.isStalemate()) return { winner: null, reason: "逼和" }
      if (chess.isInsufficientMaterial()) return { winner: null, reason: "子力不足" }
      if (chess.isThreefoldRepetition()) return { winner: null, reason: "三次重复局面" }
      if (chess.isDrawByFiftyMoves()) return { winner: null, reason: "五十回合规则" }
      return null
    },

    timeoutResult(flagSide) {
      if (hasOnlyKing(1 - flagSide)) return { winner: null, reason: "超时（对方子力不足以将死）" }
      return { winner: 1 - flagSide, reason: "超时" }
    },

    setView({ orientation, interactive: side }) {
      if (!board) return
      interactive = side
      if (orientation !== shownOrientation) {
        shownOrientation = orientation
        board.setOrientation(colorOf(orientation))
      }
      redraw()
      // Only touch move input when the side changes, so a re-render never cancels a drag in progress.
      if (side !== inputSide) {
        inputSide = side
        board.disableMoveInput()
        if (side !== null) board.enableMoveInput(inputHandler, colorOf(side))
      }
    },

    moveRows() {
      const sans = chess.history()
      const list = startSide === 1 ? ["…", ...sans] : sans
      const rows = []
      for (let i = 0; i < list.length; i += 2) rows.push(list.slice(i, i + 2).join("  "))
      return rows
    },

    exportRecord({ result, date, names }) {
      const stamp = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`
      const res = !result ? "*" : result.winner === null ? "1/2-1/2" : result.winner === 0 ? "1-0" : "0-1"
      chess.setHeader("Event", "Friendly game")
      chess.setHeader("Site", location.origin + location.pathname)
      chess.setHeader("Date", stamp)
      chess.setHeader("White", names[0])
      chess.setHeader("Black", names[1])
      chess.setHeader("Result", res)
      if (result) chess.setHeader("Termination", result.reason)
      return { filename: `chess-${stamp.replaceAll(".", "")}.pgn`, text: chess.pgn() + "\n" }
    },

    parseStart(str) {
      try {
        new Chess(str)
        return { start: str, moves: [] }
      } catch {
        return null
      }
    },
  }
}
