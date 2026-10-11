import { INK, type Board, type Item, type Pt } from '../../../recipes/doodle.js'
import { outBack, outCubic, seg, spring } from '../../../recipes/motion.js'

/** Per-frame motion a shot adds on top of the drawn strokes; t = board time, T = t + idle. */
export type Live = (t: number, T: number) => void

const move = (g: SVGGElement, x: number, y: number, rot = 0, cx = 0, cy = 0) =>
  g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})${rot ? ` rotate(${rot.toFixed(2)} ${cx} ${cy})` : ''}`)

/** Right edge of a drawn text item, for underlines and bursts. */
const span = (it: Item): [number, number] => [it.text!.x + it.text!.w * 0.1, it.text!.x + it.text!.w * 0.9]

// 1 · The pain: unknown output length, a sweating GPU.
export function pain(b: Board): Live {
  const title = b.text(90, 130, 'Why is GPU memory never enough?', { size: 64, dur: 1.2 })
  const [tx0, tx1] = span(title)
  b.underline(tx0, tx1, 158, { color: INK.yellow, dur: 0.5 })
  b.text(92, 210, 'autoregressive decoding: nobody knows the output length', { size: 30, color: INK.dim, at: 'with' })

  b.wait(0.3)
  b.figure(250, 860, { scale: 1.5, pose: 'stand', mood: ['puzzled'] })
  b.text(250, 920, 'User', { size: 30, anchor: 'middle', at: 'with' })
  b.bubble(90, 300, 520, 190, [220, 545], { width: 3 })
  b.text(130, 368, '"Write me a', { size: 38 })
  b.text(130, 418, '2000-word essay"', { size: 38 })
  b.text(130, 466, 'prompt tokens: 12', { size: 28, color: INK.blue, mono: true })

  b.wait(0.2)
  const upper: Pt[] = [[620, 660], [760, 630], [900, 690], [1040, 650], [1180, 665]]
  b.path(upper, { dur: 0.6 })
  b.path(upper.map(([x, y]) => [x, y + 70] as Pt), { dur: 0.6, at: 'with' })
  const flow = b.group()
  const tokens = b.inside(flow, () => Array.from({ length: 6 }, (_, i) => {
    const g = b.group()
    b.inside(g, () => b.rect(-11, -11, 22, 22, { color: INK.blue, width: 3, dur: 0.15, at: b.cursor - (i ? 0.1 : 0) }))
    return g
  }))
  const flowAt = b.cursor
  b.text(900, 800, 'output length = ???', { size: 34, color: INK.coral, anchor: 'middle' })

  b.wait(0.2)
  const gpu = b.group()
  b.inside(gpu, () => {
    b.rect(1230, 380, 520, 470, { width: 4.5, dur: 0.9 })
    b.text(1265, 438, 'GPU · 80 GB', { size: 34, color: INK.dim })
    b.ellipse(1405, 570, 16, 18, { width: 4, dur: 0.25 })
    b.ellipse(1575, 570, 16, 18, { width: 4, dur: 0.25 })
    b.line([1375, 520], [1430, 535], { dur: 0.15 })
    b.line([1605, 520], [1550, 535], { dur: 0.15 })
    b.path([[1420, 735], [1490, 700], [1560, 735]], { width: 4, dur: 0.3 })
    for (const cx of [1320, 1640]) {
      for (let i = 0; i < 3; i++) b.line([cx + i * 18, 645], [cx + i * 18 - 14, 675], { color: INK.coral, width: 3, dur: 0.12 })
    }
    b.path([[1715, 455], [1724, 475], [1717, 486], [1708, 476], [1715, 455]], { color: INK.blue, dur: 0.25 })
  })
  const smoke = b.group()
  b.inside(smoke, () => {
    b.ellipse(1300, 340, 34, 26, { color: INK.dim, dur: 0.25 })
    b.ellipse(1262, 300, 26, 20, { color: INK.dim, dur: 0.2 })
    b.ellipse(1340, 290, 22, 17, { color: INK.dim, dur: 0.2 })
  })
  const shakeAt = b.cursor
  const oom = b.text(1460, 255, 'OOM (Out of Memory)?', { size: 50, color: INK.yellow, anchor: 'middle' })
  const [o0, o1] = [oom.text!.x, oom.text!.x + oom.text!.w]
  b.burst(o0 - 4, 238, 14, 56, { color: INK.yellow, n: 2, from: 160, to: 200, dur: 0.25 })
  b.burst(o1 + 4, 238, 14, 56, { color: INK.yellow, n: 2, from: -20, to: 20, dur: 0.25 })

  return (t, T) => {
    tokens.forEach((g, i) => {
      const u = ((Math.max(0, T - flowAt) * 0.35 + i / 6) % 1)
      const x = 640 + u * 520
      const y = 695 + Math.sin(u * Math.PI * 2.4) * 18
      move(g, x, y, Math.sin(T * 2 + i) * 12)
    })
    flow.style.opacity = String(seg(t, flowAt - 0.4, flowAt))
    const amp = seg(t, shakeAt, shakeAt + 0.6)
    move(gpu, Math.sin(T * 41) * 2.2 * amp, Math.cos(T * 33) * 1.6 * amp)
    move(smoke, Math.sin(T * 1.3) * 6, -((T * 9) % 14))
  }
}

// 2 · Static pre-allocation: a filing cabinet with 10 drawers, 2 used, 8 reserved.
export function drawers(b: Board): Live {
  b.text(180, 190, 'static pre-allocation: reserve max_seq_len = 2048 up front', { size: 34 })
  const x0 = 470, y0 = 300, cw = 172, ch = 190
  b.rect(x0, y0, cw * 5, ch * 2, { width: 4.5, dur: 0.8 })
  for (let i = 1; i < 5; i++) b.line([x0 + cw * i, y0], [x0 + cw * i, y0 + ch * 2], { dur: 0.15 })
  b.line([x0, y0 + ch], [x0 + cw * 5, y0 + ch], { dur: 0.3 })
  for (let i = 0; i < 10; i++) {
    const cx = x0 + cw * (i % 5) + cw / 2, cy = y0 + ch * Math.floor(i / 5)
    b.line([cx - 22, cy + 30], [cx + 22, cy + 30], { width: 4, dur: 0.08 })
  }

  b.wait(0.2)
  b.figure(320, 690, { scale: 1.05, pose: 'carry', mood: ['happy'] })
  b.text(320, 740, 'User A', { size: 28, anchor: 'middle', at: 'with' })
  for (let i = 0; i < 2; i++) {
    const cx = x0 + cw * i
    b.rect(cx + 40, y0 + 80, 34, 96, { width: 3, dur: 0.2 })
    b.rect(cx + 82, y0 + 96, 30, 80, { width: 3, dur: 0.2 })
  }
  b.hatch(x0 + 6, y0 + 50, cw * 2 - 12, ch - 56, { color: INK.mint, gap: 16, opacity: 0.45, dur: 0.6 })
  b.text(470, 262, 'Actual Used (20%)', { size: 36, color: INK.mint })
  b.arrow([890, 225], [770, 335], { color: INK.mint, bend: 0.3, dur: 0.4 })

  b.wait(0.3)
  for (let i = 2; i < 10; i++) {
    const cx = x0 + cw * (i % 5), cy = y0 + ch * Math.floor(i / 5)
    b.hatch(cx + 10, cy + 50, cw - 20, ch - 60, { color: INK.coral, gap: 26, width: 6, opacity: 0.85, dur: 0.18 })
    b.cross(cx + 30, cy + 60, cw - 60, ch - 80, { color: INK.coral, width: 5, dur: 0.14 })
  }
  b.text(1330, 740, 'Reserved Waste (80%)!', { size: 38, color: INK.coral, anchor: 'end' })
  b.arrow([1150, 765], [1030, 860], { color: INK.coral, bend: 0.25, width: 4, dur: 0.4 })
  const frag = b.text(900, 920, 'Memory Fragmentation', { size: 58, color: INK.coral, anchor: 'middle' })
  const [f0, f1] = span(frag)
  b.underline(f0, f1, 942, { color: INK.coral, passes: 3, dur: 0.4 })

  b.wait(0.2)
  const walker = b.group()
  const walkAt = b.cursor
  b.inside(walker, () => {
    b.figure(1530, 690, { scale: 1.05, pose: 'carry', mood: ['angry'], dur: 0.5 })
    for (let i = 0; i < 4; i++) b.rect(1576, 556 - i * 22, 66, 20, { width: 2.5, dur: 0.08, passes: 1 })
  })
  b.text(1530, 740, 'User B', { size: 28, anchor: 'middle', at: 'with' })
  b.dashed([1395, 260], [1395, 710], { color: INK.chalk, width: 3.5, dur: 0.6 })
  b.text(1412, 440, 'no room?!', { size: 30, color: INK.yellow, rotate: -8 })

  return (t) => {
    const k = seg(t, walkAt, walkAt + 1.2, outCubic)
    move(walker, (1 - k) * 300, Math.abs(Math.sin(k * Math.PI * 4)) * -8 * (1 - k))
  }
}

// 3 · Borrow from the OS: a locked hardcover book versus a ring binder of loose pages.
export function paging(b: Board): Live {
  const book = b.group()
  b.inside(book, () => {
    b.rect(180, 330, 400, 480, { width: 4.5, dur: 0.7 })
    b.line([225, 330], [225, 810], { dur: 0.25 })
    b.rect(555, 540, 50, 60, { width: 3.5, dur: 0.2 })
    b.path([[565, 540], [565, 515], [580, 505], [595, 515], [595, 540]], { width: 3.5, dur: 0.2 })
    b.text(400, 470, 'KV cache', { size: 40, anchor: 'middle' })
    b.text(400, 520, 'one block per request', { size: 26, anchor: 'middle', color: INK.dim })
    b.cross(200, 360, 360, 420, { color: INK.coral, width: 7, dur: 0.4 })
  })
  b.text(380, 880, 'Contiguous Memory', { size: 36, anchor: 'middle', at: 'with' })
  const dimAt = b.cursor + 0.2

  b.wait(0.3)
  const head = b.text(960, 160, 'PagedAttention', { size: 76, color: INK.yellow, anchor: 'middle', dur: 0.9 })
  const [h0, h1] = span(head)
  b.underline(h0, h1, 190, { color: INK.yellow, passes: 2, width: 4.5, dur: 0.5 })
  b.text(960, 245, 'borrowed from OS virtual memory: paging', { size: 30, color: INK.dim, anchor: 'middle' })

  b.wait(0.2)
  b.rect(1300, 330, 460, 480, { width: 4.5, dur: 0.7 })
  for (const y of [420, 570, 720]) b.ellipse(1300, y, 16, 26, { width: 3.5, dur: 0.15 })
  b.text(1530, 880, 'Loose pages, fixed size', { size: 36, anchor: 'middle', at: 'with' })

  const sched = b.group()
  const dropAt = b.cursor
  b.inside(sched, () => {
    b.figure(900, 790, { scale: 1.3, pose: 'wand', mood: ['glasses', 'happy'], dur: 0.4, at: dropAt - 0.4 })
    b.line([962, 618], [1012, 566], { color: INK.blue, width: 5, dur: 0.15, at: dropAt })
    b.burst(1016, 562, 8, 26, { color: INK.yellow, n: 5, from: -180, to: 60, dur: 0.15, at: dropAt })
  })
  b.text(900, 850, 'scheduler', { size: 30, color: INK.blue, anchor: 'middle', at: dropAt + 0.2 })
  b.goto(dropAt + 0.9)

  const pages = [0, 1, 2].map((i) => {
    const g = b.group()
    const y = 370 + i * 140
    const at = b.cursor
    b.inside(g, () => {
      b.rect(1345, y, 380, 112, { width: 3, dur: 0.3 })
      b.text(1375, y + 52, `Block ${i}`, { size: 36, color: INK.yellow })
      b.text(1375, y + 92, '16 tokens', { size: 24, color: INK.dim, mono: true })
    })
    b.wait(0.5)
    b.dashed([1010, 580], [1335, y + 56], { color: INK.blue, width: 3, dash: 14, gap: 12, dur: 0.3 })
    b.wait(0.3)
    return { g, at, y }
  })

  return (t) => {
    book.style.opacity = String(1 - 0.65 * seg(t, dimAt, dimAt + 0.8))
    const d = seg(t, dropAt - 0.6, dropAt, outBack)
    move(sched, 0, (1 - d) * -760)
    for (const p of pages) {
      const k = seg(t, p.at + 0.2, p.at + 0.8, outBack)
      move(p.g, (1 - k) * -330, (1 - k) * (560 - p.y), (1 - k) * -18, 1535, p.y + 56)
    }
  }
}

// 4 · The page table: logical blocks in order, physical slots anywhere.
export function pageTable(b: Board): Live {
  const t0 = b.text(100, 130, 'Page Table', { size: 64, dur: 0.6 })
  const [p0, p1] = span(t0)
  b.underline(p0, p1, 158, { color: INK.yellow, dur: 0.4 })

  b.text(100, 250, 'Logical KV Blocks', { size: 32, color: INK.blue })
  for (let i = 0; i < 3; i++) {
    b.rect(100 + i * 180, 280, 140, 110, { color: INK.blue, width: 4, dur: 0.3 })
    b.text(170 + i * 180, 352, String(i), { size: 50, color: INK.blue, anchor: 'middle', at: 'with' })
  }
  b.text(100, 440, 'contiguous, as the model sees it', { size: 26, color: INK.dim })

  b.wait(0.3)
  const tx = 100, ty = 490, tw = 520, rh = 76
  b.rect(tx, ty, tw, rh * 4, { width: 4, dur: 0.6 })
  b.line([tx + tw / 2, ty], [tx + tw / 2, ty + rh * 4], { dur: 0.2 })
  b.line([tx, ty + rh], [tx + tw, ty + rh], { dur: 0.2 })
  b.text(tx + tw / 4, ty + 50, 'Logical', { size: 34, anchor: 'middle' })
  b.text(tx + (tw * 3) / 4, ty + 50, 'Physical', { size: 34, anchor: 'middle' })

  b.text(1080, 230, 'Physical GPU DRAM', { size: 34, at: 'with' })
  const gx = 1080, gy = 260, cs = 160
  b.rect(gx, gy, cs * 4, cs * 4, { width: 4, dur: 0.7 })
  for (let i = 1; i < 4; i++) {
    b.line([gx + cs * i, gy], [gx + cs * i, gy + cs * 4], { dur: 0.12 })
    b.line([gx, gy + cs * i], [gx + cs * 4, gy + cs * i], { dur: 0.12 })
  }
  const cell = (i: number): [number, number] => [gx + cs * (i % 4), gy + cs * Math.floor(i / 4)]
  for (let i = 0; i < 16; i++) b.text(cell(i)[0] + 12, cell(i)[1] + 32, String(i), { size: 24, color: INK.dim, mono: true, dur: 0.05 })
  for (const i of [0, 5, 7, 10, 14]) {
    const [cx, cy] = cell(i)
    b.hatch(cx + 10, cy + 44, cs - 20, cs - 54, { color: INK.faint, gap: 18, opacity: 0.9, dur: 0.15 })
  }
  b.text(gx + cs * 2, gy + cs * 4 + 60, 'gray: blocks of other requests', { size: 26, color: INK.dim, anchor: 'middle' })

  b.wait(0.3)
  const map: Array<[number, number]> = [[0, 3], [1, 9], [2, 12]]
  map.forEach(([l, p], r) => {
    const y = ty + rh * (r + 1) + 52
    b.text(tx + tw / 4, y, String(l), { size: 44, color: INK.blue, anchor: 'middle', dur: 0.25 })
    b.text(tx + (tw * 3) / 4, y, String(p), { size: 44, color: INK.mint, anchor: 'middle', dur: 0.25 })
    const [cx, cy] = cell(p)
    b.arrow([tx + tw + 12, y - 14], [cx + 30, cy + cs / 2 + 10], { color: INK.mint, width: 4, bend: [-0.08, 0.04, 0.12][r]!, dur: 0.6 })
    b.hatch(cx + 10, cy + 44, cs - 20, cs - 54, { color: INK.mint, gap: 16, opacity: 0.5, dur: 0.35 })
    b.text(cx + cs / 2 + 22, cy + cs / 2 + 34, `L${l}`, { size: 40, color: INK.chalk, anchor: 'middle', dur: 0.2 })
    b.wait(0.3)
  })
  b.text(100, 900, 'In order for the model, scattered in memory:', { size: 32 })
  b.text(100, 950, 'no reservation, waste < 4%', { size: 32, color: INK.mint })
  return () => {}
}

// 5 · Shared prefix: two users point at the same system-prompt blocks; throughput goes up.
export function sharing(b: Board): Live {
  const t0 = b.text(100, 130, 'Prefix Sharing', { size: 64, dur: 0.6 })
  const [p0, p1] = span(t0)
  b.underline(p0, p1, 158, { color: INK.yellow, dur: 0.4 })

  b.figure(220, 470, { scale: 1.1, pose: 'wave', mood: ['happy'] })
  b.text(220, 520, 'User 1', { size: 28, anchor: 'middle', at: 'with' })
  b.figure(220, 860, { scale: 1.1, pose: 'stand', mood: ['happy'] })
  b.text(220, 910, 'User 2', { size: 28, anchor: 'middle', at: 'with' })

  b.wait(0.2)
  b.arrow([300, 380], [600, 560], { color: INK.blue, width: 4, bend: -0.1, dur: 0.5 })
  b.arrow([300, 770], [600, 640], { color: INK.blue, width: 4, bend: 0.1, dur: 0.5, at: 'with' })
  const shared = b.group()
  const flashAt = b.cursor
  b.inside(shared, () => {
    b.rect(620, 520, 460, 150, { color: INK.mint, width: 4.5, dur: 0.5 })
    b.text(650, 580, 'System: "You are a', { size: 32, mono: false })
    b.text(650, 630, 'helpful assistant..."', { size: 32 })
  })
  b.loop(850, 595, 285, 105, { color: INK.mint, width: 5, dur: 0.8, turns: 2 })
  b.text(850, 770, 'Shared Prefix Cache (0 compute cost)', { size: 32, color: INK.mint, anchor: 'middle' })

  b.wait(0.2)
  b.arrow([1110, 555], [1220, 450], { color: INK.chalk, width: 3.5, bend: -0.2, dur: 0.35 })
  b.rect(1230, 390, 410, 110, { color: INK.yellow, width: 4, dur: 0.4 })
  b.text(1255, 458, 'Q1: summarize a PDF', { size: 30, color: INK.yellow })
  b.arrow([1110, 640], [1220, 760], { color: INK.chalk, width: 3.5, bend: 0.2, dur: 0.35 })
  b.rect(1230, 710, 410, 110, { color: INK.yellow, width: 4, dur: 0.4 })
  b.text(1255, 778, 'Q2: translate to French', { size: 30, color: INK.yellow })
  b.text(1435, 870, 'private blocks per user', { size: 26, color: INK.dim, anchor: 'middle' })

  b.wait(0.3)
  const gc: Pt = [1720, 220], gr = 100
  const arc = (a0: number, a1: number): Pt[] => Array.from({ length: 9 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / 8) * Math.PI) / 180
    return [gc[0] + Math.cos(a) * gr, gc[1] + Math.sin(a) * gr]
  })
  b.path(arc(180, 240), { color: INK.coral, width: 9, dur: 0.25 })
  b.path(arc(242, 298), { color: INK.yellow, width: 9, dur: 0.25 })
  b.path(arc(300, 360), { color: INK.mint, width: 9, dur: 0.25 })
  b.line([gc[0] - gr - 20, gc[1]], [gc[0] + gr + 20, gc[1]], { dur: 0.2 })
  const needle = b.group()
  b.inside(needle, () => b.line(gc, [gc[0] + gr * 0.85, gc[1]], { width: 5, dur: 0.2 }))
  b.ellipse(gc[0], gc[1], 9, 9, { width: 5, dur: 0.1 })
  const swingAt = b.cursor + 0.2
  b.wait(1.2)
  b.arrow([1560, 250], [1560, 110], { color: INK.yellow, width: 7, bend: 0.02, head: 28, dur: 0.35 })
  b.text(1830, 310, 'Throughput: 2x - 4x', { size: 36, color: INK.yellow, anchor: 'end' })
  b.text(1830, 1000, '*workload dependent', { size: 30, color: INK.coral, anchor: 'end' })

  return (t) => {
    const fl = seg(t, flashAt + 0.5, flashAt + 1.1)
    shared.style.opacity = String(fl > 0 && fl < 1 ? 0.55 + 0.45 * Math.cos(fl * Math.PI * 4) : 1)
    const k = spring(seg(t, swingAt, swingAt + 1.4), 0.35, 2.5)
    move(needle, 0, 0, 200 + 140 * k, gc[0], gc[1])
  }
}
