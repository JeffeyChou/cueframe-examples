// Terminal player: renders the MV into the current terminal with truecolor ANSI, synced to the
// music when a track is available.
//
//   node examples/r-ascii/term/play.ts [--audio song.mp3] [--start 29.7] [--fps 30] [--256] [--mute]
//
// Keys: space pause · ←/→ seek 5 s · ↑/↓ seek 30 s · q quit
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Cells } from '../engine/cells.ts'
import { renderFrame } from '../engine/frame.ts'
import { END, LINES } from '../engine/song.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const flag = (name: string) => process.argv.includes(name)

const FPS = Number(arg('--fps') ?? 30)
let start = Number(arg('--start') ?? 0)
const mute = flag('--mute')
const truecolor = !flag('--256') && (process.env.COLORTERM === 'truecolor' || process.env.COLORTERM === '24bit' || (process.env.TERM_PROGRAM !== 'Apple_Terminal' && !/256/.test(process.env.TERM ?? '') ) || flag('--truecolor'))

function findAudio(): string | null {
  const a = arg('--audio')
  if (a) return existsSync(a) ? resolve(a) : null
  for (const dir of [join(ROOT, 'data'), join(ROOT, 'build')]) {
    if (!existsSync(dir)) continue
    const f = readdirSync(dir).find((n) => /^(music|song|world)[^/]*\.(mp3|m4a|flac|wav|ogg|opus|aac)$/i.test(n))
    if (f) return join(dir, f)
  }
  return null
}
const AUDIO = mute ? null : findAudio()
const has = (cmd: string) => spawnSync('sh', ['-c', `command -v ${cmd}`]).status === 0
const FFPLAY = has('ffplay'), AFPLAY = has('afplay')

// ── audio ───────────────────────────────────────────────────────────────────────────────────────
let player: ChildProcess | null = null
function stopAudio() { if (player) { player.kill('SIGKILL'); player = null } }
function playAudio(at: number) {
  stopAudio()
  if (!AUDIO) return
  if (FFPLAY) player = spawn('ffplay', ['-nodisp', '-autoexit', '-loglevel', 'quiet', '-ss', at.toFixed(3), AUDIO], { stdio: 'ignore' })
  else if (AFPLAY && at < 0.05) player = spawn('afplay', [AUDIO], { stdio: 'ignore' })
}

// ── ANSI encoder with a per-cell diff against the previous frame ───────────────────────────────
const BASE_BG = 0x05080b
const LV = [0, 95, 135, 175, 215, 255]
const q6 = (v: number) => (v < 48 ? 0 : v < 115 ? 1 : Math.min(5, Math.floor((v - 35) / 40)))
function to256(c: number) {
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255
  const ir = q6(r), ig = q6(g), ib = q6(b)
  const cube = 16 + 36 * ir + 6 * ig + ib
  const gray = Math.round(((r + g + b) / 3 - 8) / 10)
  const gi = 232 + Math.max(0, Math.min(23, gray)), gv = 8 + (gi - 232) * 10
  const dc = (LV[ir]! - r) ** 2 + (LV[ig]! - g) ** 2 + (LV[ib]! - b) ** 2
  const dg = (gv - r) ** 2 + (gv - g) ** 2 + (gv - b) ** 2
  return dg < dc ? gi : cube
}
const sgrFg = (c: number) => (truecolor ? `38;2;${(c >> 16) & 255};${(c >> 8) & 255};${c & 255}` : `38;5;${to256(c)}`)
const sgrBg = (c: number) => (truecolor ? `48;2;${(c >> 16) & 255};${(c >> 8) & 255};${c & 255}` : `48;5;${to256(c)}`)

/** Colour quantisation mask: drops imperceptible changes so the diff stays small. */
const QM = 0xf8f8f8
let prevCh: string[] = [], prevFg = new Int32Array(0), prevBg = new Int32Array(0), prevAt = new Uint8Array(0)
function encode(c: Cells, full: boolean): string {
  const { cols, rows } = c
  if (full || prevCh.length !== cols * rows) {
    prevCh = new Array(cols * rows).fill('\u0000'); prevFg = new Int32Array(cols * rows); prevBg = new Int32Array(cols * rows); prevAt = new Uint8Array(cols * rows)
  }
  let out = ''
  let curFg = -2, curBg = -2, curAt = -1
  let cx = -1, cy = -1
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x
      let ch = c.ch[i]!
      if (ch === '') continue
      const fg = c.fg[i]! & QM, bg = (c.bg[i]! < 0 ? BASE_BG : c.bg[i]!) & QM, at = c.at[i]!
      const wide = x + 1 < cols && c.ch[i + 1] === ''
      if (!full && prevCh[i] === ch && prevFg[i] === fg && prevBg[i] === bg && prevAt[i] === at && !(wide && prevCh[i + 1] !== '')) continue
      prevCh[i] = ch; prevFg[i] = fg; prevBg[i] = bg; prevAt[i] = at
      if (wide) prevCh[i + 1] = ''
      if (cy !== y || cx !== x) out += `\x1b[${y + 1};${x + 1}H`
      let sgr = ''
      if (at !== curAt) { sgr += at & 1 ? '1;' : '22;'; curAt = at }
      if (fg !== curFg) { sgr += sgrFg(fg) + ';'; curFg = fg }
      if (bg !== curBg) { sgr += sgrBg(bg) + ';'; curBg = bg }
      if (sgr) out += `\x1b[${sgr.slice(0, -1)}m`
      if (ch === ' ' && false) ch = ' '
      out += ch
      cx = x + (wide ? 2 : 1); cy = y
      // never let the cursor wrap into the next row on the last column
      if (cx >= cols) cx = -1
    }
  }
  return out
}

// ── main loop ───────────────────────────────────────────────────────────────────────────────────
const out = process.stdout
if (!out.isTTY) { console.error('play.ts needs a terminal (stdout is not a TTY).'); process.exit(1) }

let cells = new Cells(out.columns, out.rows)
let full = true
let paused = false
let t0 = performance.now() - start * 1000
let pausedAt = start
let lastFrame = -1
let backlog = false

function now() { return paused ? pausedAt : (performance.now() - t0) / 1000 }
function seek(t: number) {
  t = Math.max(0, Math.min(END - 0.05, t))
  t0 = performance.now() - t * 1000
  pausedAt = t
  lastFrame = -1
  if (!paused) playAudio(t)
}

function cleanup() {
  stopAudio()
  out.write('\x1b[?2026l\x1b[0m\x1b[?25h\x1b[?1049l')
  if (process.stdin.isTTY) process.stdin.setRawMode(false)
}
process.on('exit', cleanup)
process.on('SIGINT', () => process.exit(0))
process.on('SIGTERM', () => process.exit(0))
out.on('resize', () => { cells = new Cells(out.columns, out.rows); full = true; out.write('\x1b[2J') })

if (process.stdin.isTTY) {
  process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.on('data', (b: Buffer) => {
    const s = b.toString()
    if (s === 'q' || s === '\u0003' || s === '\u001b') process.exit(0)
    else if (s === ' ') {
      if (paused) { paused = false; t0 = performance.now() - pausedAt * 1000; playAudio(pausedAt) }
      else { pausedAt = now(); paused = true; stopAudio() }
      lastFrame = -1
    }
    else if (s === '\u001b[C') seek(now() + 5)
    else if (s === '\u001b[D') seek(now() - 5)
    else if (s === '\u001b[A') seek(now() + 30)
    else if (s === '\u001b[B') seek(now() - 30)
  })
}

out.write('\x1b[?1049h\x1b[?25l\x1b[2J')
if (out.columns < 100 || out.rows < 30) {
  out.write(`\x1b[1;1Hterminal is ${out.columns}x${out.rows}; 160x45 or larger looks best (zoom out with Cmd/Ctrl -).`)
}
playAudio(start)
out.on('drain', () => { backlog = false })

function tick() {
  const t = now()
  if (t >= END) { process.exit(0) }
  const f = Math.floor(t * FPS)
  if (f !== lastFrame && !backlog) {
    lastFrame = f
    renderFrame(cells, t, Math.round(t * 30), 'term')
    if (paused) {
      const s = ` ❚❚ PAUSED ${t.toFixed(2)}s  ·  space resume  ←/→ ±5s  ↑/↓ ±30s  q quit `
      cells.text(Math.max(0, Math.floor((cells.cols - s.length) / 2)), Math.floor(cells.rows / 2), s, 0x05080b, 0xffffff)
    }
    const s = '\x1b[?2026h' + encode(cells, full) + '\x1b[?2026l'
    full = false
    backlog = !out.write(s)
  }
  const next = (Math.floor(t * FPS) + 1) / FPS
  setTimeout(tick, Math.max(1, (next - t) * 1000 - 1))
}
if (!AUDIO && !mute) {
  const hint = `no music found: put the track at examples/r-ascii/data/music.mp3 or pass --audio <file>  (${LINES.length} lyric lines loaded; playing silent)`
  out.write(`\x1b[1;1H\x1b[0m${hint}`)
  setTimeout(tick, 1600)
} else tick()
