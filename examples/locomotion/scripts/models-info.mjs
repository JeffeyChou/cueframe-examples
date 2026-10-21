// Summary of the GLB models in data/models: meshes, vertices, morph targets, animations, bounding box.
// Reads only the GLB JSON chunk; the box is the scene's world box from accessor min/max and node TRS.
// Usage: node examples/locomotion/scripts/models-info.mjs [dir]
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2] ?? new URL('../data/models', import.meta.url).pathname

function gltfJson(file) {
  const b = readFileSync(file)
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file}: not a GLB`)
  const len = b.readUInt32LE(12)
  return JSON.parse(b.subarray(20, 20 + len).toString('utf8'))
}

const mul = (a, b) => {
  const o = new Array(16).fill(0)
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]
  return o
}
function local(n) {
  if (n.matrix) return n.matrix
  const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1]
  const [sx, sy, sz] = n.scale ?? [1, 1, 1]
  const [tx, ty, tz] = n.translation ?? [0, 0, 0]
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ]
}
const apply = (m, [x, y, z]) => [0, 1, 2].map((i) => m[i] * x + m[4 + i] * y + m[8 + i] * z + m[12 + i])
const r = (v) => +v.toFixed(3)

for (const f of readdirSync(dir).filter((f) => f.endsWith('.glb')).sort()) {
  const g = gltfJson(join(dir, f))
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]
  let verts = 0, prims = 0, meshNodes = 0
  const morphs = new Set()
  const walk = (i, parent) => {
    const n = g.nodes[i]
    const m = mul(parent, local(n))
    if (n.mesh !== undefined) {
      meshNodes++
      for (const p of g.meshes[n.mesh].primitives) {
        const a = g.accessors[p.attributes.POSITION]
        verts += a.count
        prims++
        morphs.add(p.targets?.length ?? 0)
        for (const c of [0, 1, 2, 3, 4, 5, 6, 7]) {
          const v = apply(m, [0, 1, 2].map((k) => ((c >> k) & 1 ? a.max[k] : a.min[k])))
          for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]) }
        }
      }
    }
    for (const c of n.children ?? []) walk(c, m)
  }
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  for (const i of g.scenes[g.scene ?? 0].nodes) walk(i, I)
  const anims = (g.animations ?? []).map((a, i) => {
    const t = Math.max(...a.samplers.map((s) => g.accessors[s.input].max?.[0] ?? 0))
    const paths = [...new Set(a.channels.map((c) => c.target.path))].join('+')
    return `${a.name || `#${i}`} ${r(t)}s (${paths})`
  })
  const names = g.meshes.map((m) => m.name).filter(Boolean)
  console.log(`${f}: ${g.meshes.length} meshes / ${meshNodes} mesh nodes / ${prims} primitives, ${verts} vertices, ` +
    `morph targets ${[...morphs].join(',')}, skins ${g.skins?.length ?? 0}, materials ${g.materials?.length ?? 0}, ` +
    `textures ${g.textures?.length ?? 0}`)
  if (names.length) console.log(`  meshes: ${names.slice(0, 12).join(', ')}${names.length > 12 ? ', …' : ''}`)
  console.log(`  animations: ${anims.join('; ') || 'none'}`)
  console.log(`  box: min [${lo.map(r)}] max [${hi.map(r)}] size [${hi.map((v, k) => r(v - lo[k]))}]`)
}
