export const C = {
  bg: '#f6f5f1',
  panel: '#ffffff',
  soft: '#eeece5',
  line: '#d8d4c8',
  ink: '#1c1f23',
  dim: '#5b626c',
  faint: '#979ca4',
  fin: '#d9480f',
  finSoft: '#fff0e6',
  sdp: '#1c64b8',
  sdpSoft: '#e7f0fb',
  stock: '#7a828c',
  good: '#2b8a3e',
  goodSoft: '#e6f4ea',
  bad: '#c92a2a',
  badSoft: '#fbeaea',
  warn: '#b35c00',
  warnSoft: '#fdf1df',
}

export type Tone = 'fin' | 'sdp' | 'stock' | 'good' | 'bad' | 'warn' | 'ink'

export const TONE: Record<Tone, { fg: string; bg: string }> = {
  fin: { fg: C.fin, bg: C.finSoft },
  sdp: { fg: C.sdp, bg: C.sdpSoft },
  stock: { fg: C.stock, bg: C.soft },
  good: { fg: C.good, bg: C.goodSoft },
  bad: { fg: C.bad, bg: C.badSoft },
  warn: { fg: C.warn, bg: C.warnSoft },
  ink: { fg: C.ink, bg: C.soft },
}

export const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif'
export const MONO = 'Menlo, "DejaVu Sans Mono", monospace'
