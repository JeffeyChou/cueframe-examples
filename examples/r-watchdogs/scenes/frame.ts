import { scene, seeded } from '@cueframe/core'
import { clear, H, W } from '../lib.js'

export const END = 15.15

/** Black stage under every shot. */
export const bg = scene({
  id: 'bg',
  at: 0,
  end: END,
  mount(ctx) { ctx.root.style.background = '#000'; return {} },
  render() {},
})

/** Film grain and a soft vignette over everything. */
export const grain = scene({
  id: 'grain',
  at: 0,
  end: END,
  mount(ctx) {
    const g = ctx.canvas('grain')
    const rnd = seeded(77)
    const tiles = Array.from({ length: 8 }, () => {
      const c = Object.assign(document.createElement('canvas'), { width: 384, height: 384 })
      const x = c.getContext('2d')!
      const img = x.createImageData(384, 384)
      for (let i = 0; i < img.data.length; i += 4) {
        const v = rnd() < 0.5 ? 0 : 255
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v
        img.data[i + 3] = Math.floor(rnd() * 70)
      }
      x.putImageData(img, 0, 0)
      return g.createPattern(c, 'repeat')!
    })
    const vig = Object.assign(document.createElement('canvas'), { width: W / 4, height: H / 4 })
    const v = vig.getContext('2d')!
    const rg = v.createRadialGradient(W / 8, H / 8, H / 10, W / 8, H / 8, W / 7)
    rg.addColorStop(0, 'rgba(0,0,0,0)')
    rg.addColorStop(1, 'rgba(0,0,0,0.55)')
    v.fillStyle = rg
    v.fillRect(0, 0, W / 4, H / 4)
    return { g, tiles, vig }
  },
  render(f, s) {
    const { g } = s
    clear(g, f)
    g.drawImage(s.vig, 0, 0, W, H)
    const r = f.rng(3)
    g.save()
    g.translate(-r.int(0, 383), -r.int(0, 383))
    g.globalAlpha = 0.32
    g.fillStyle = s.tiles[f.frame % s.tiles.length]
    g.fillRect(0, 0, W + 400, H + 400)
    g.restore()
  },
})
