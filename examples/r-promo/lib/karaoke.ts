// karaoke: a fixed caption band from words.json phrases, lit character by character at word times.
// timeline({ words, scenes: [scene({ id: 'captions', at: 0, end: cue('total'),
//   mount: (ctx) => ({ draw: karaoke(ctx, { y: 930, font: 'Archivo' }) }), render: (f, s) => s.draw(f) })] })
// Shows the original line text (punctuation kept), sizes each phrase to the band width (CJK = 1 em).

import type { Frame, MountContext, Word, WordLine } from '@cueframe/core'

export interface KaraokeOptions {
  y: number                       // band centre, logical px
  width?: number                  // band width (default: stage width − 2·160)
  max?: number                    // font size range, px
  min?: number
  font?: string
  weight?: string
  ink?: string                    // unlit / lit / emphasised colours
  lit?: string
  emph?: string
  lead?: number                   // phrase appears this long before its first word
  linger?: number                 // last phrase of a line stays this long after the line ends
  hop?: number                    // px a character jumps when it lights
  /** Return true for words to draw in `emph` (e.g. all-caps, or words listed in the script). */
  emphasis?: (w: Word, line: WordLine) => boolean
}

const CJK = /[⺀-鿿豈-﫿＀-￯　-〿]/

/** Width of a string in em: CJK and full-width punctuation 1, space 0.3, everything else 0.58. */
export const ems = (s: string) => Array.from(s).reduce((n, c) => n + (CJK.test(c) ? 1 : c === ' ' ? 0.3 : 0.58), 0)

export const captionSize = (s: string, width: number, max = 64, min = 40) =>
  Math.max(min, Math.min(max, Math.floor(width / Math.max(1, ems(s)))))

interface Phrase { a: number; b: number; start: number; end: number; size: number }
interface Line { spans: HTMLSpanElement[]; litAt: number[]; emph: boolean[]; phrases: Phrase[] }

export function karaoke(ctx: MountContext, o: KaraokeOptions) {
  const width = o.width ?? ctx.stage.w - 320
  const { max = 64, min = 40, ink = '#f4f1ea', lit = '#ffd166', emph = '#ef476f', lead = 0.08, linger = 0.6, hop = 8 } = o
  const band = document.createElement('div')
  Object.assign(band.style, {
    position: 'absolute', left: '50%', top: `${o.y}px`, transform: 'translate(-50%, -50%)', whiteSpace: 'nowrap',
    fontFamily: o.font ?? 'sans-serif', fontWeight: o.weight ?? '800', color: ink, textAlign: 'center',
    textShadow: '0 4px 18px rgba(0,0,0,.55)',
  })
  ctx.root.append(band)

  const lines = new Map<string, Line>()
  for (const w of ctx.data.words().words) {
    if (!w.line || lines.has(w.line)) continue
    const line = ctx.data.words(w.line).line!
    const text = line.text
    const spans = Array.from(text, (ch) => {
      const s = document.createElement('span')
      s.textContent = ch
      Object.assign(s.style, { position: 'relative', display: 'none' })
      band.append(s)
      return s
    })
    const litAt = Array.from(text, () => Infinity)
    const em = Array.from(text, () => false)
    for (const lw of line.words) {
      const e = o.emphasis?.(lw, line) ?? false
      for (const i of lw.chars ?? []) { litAt[i] = Math.min(litAt[i]!, lw.t0); em[i] = e }
    }
    // punctuation and spaces light with the character before them
    const first = line.words[0]?.t0 ?? line.start
    for (let i = 0; i < litAt.length; i++) if (litAt[i] === Infinity) litAt[i] = i ? litAt[i - 1]! : first
    const ph = line.phrases.length ? line.phrases : [{ text, chars: [0, text.length], start: line.start, end: line.end }]
    const phrases = ph.map((p, k) => {
      let a = p.chars[0]!
      let b = k + 1 < ph.length ? ph[k + 1]!.chars[0]! : text.length   // extend to keep trailing punctuation
      while (a < b && text[a] === ' ') a++
      while (b > a && text[b - 1] === ' ') b--
      return { a, b, start: p.start, end: p.end, size: captionSize(text.slice(a, b), width, max, min) }
    })
    lines.set(line.id, { spans, litAt, emph: em, phrases })
  }

  return (f: Frame) => {
    const cur = f.words({ at: f.t }).line
    const L = cur && lines.get(cur.id)
    let show: Phrase | null = null
    if (L && cur) {
      for (let k = 0; k < L.phrases.length; k++) {
        const p = L.phrases[k]!
        const until = (L.phrases[k + 1]?.start ?? cur.end + linger) - lead
        if (f.t >= p.start - lead && f.t < until) show = p
      }
    }
    for (const [, M] of lines) {
      M.spans.forEach((s, i) => {
        const on = M === L && show !== null && i >= show.a && i < show.b
        s.style.display = on ? 'inline' : 'none'
        if (!on) return
        const age = f.t - M.litAt[i]!
        s.style.color = age >= 0 ? (M.emph[i] ? emph : lit) : ink
        const h = age >= 0 && age < 0.14 ? -hop * (M.emph[i] ? 1.6 : 1) * Math.sin((Math.PI * age) / 0.14) : 0
        s.style.top = `${h.toFixed(2)}px`
      })
    }
    band.style.fontSize = `${show?.size ?? max}px`
    band.style.opacity = show ? String(Math.min(1, (f.t - (show.start - lead)) / 0.1)) : '0'
  }
}
