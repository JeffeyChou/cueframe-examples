#!/usr/bin/env node
// For every project under examples/ (a folder with timeline.ts): `check types`, then a still at
// t=1 s, with the CueFrame of the submodule. Run after bumping it: `pnpm check [name…]`.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const only = process.argv.slice(2)
const projects = []
const walk = (dir, depth) => {
  if (existsSync(join(dir, 'timeline.ts'))) { projects.push(dir); return }
  if (depth === 0) return
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && !['node_modules', 'out', 'build', '.cache'].includes(e.name)) walk(join(dir, e.name), depth - 1)
  }
}
walk(join(root, 'examples'), 2)

const out = mkdtempSync(join(tmpdir(), 'cf-examples-'))
let failed = 0
for (const p of projects.sort()) {
  const name = relative(join(root, 'examples'), p)
  if (only.length && !only.some((o) => name === o || name.startsWith(`${o}/`))) continue
  for (const [label, args] of [
    ['types', ['check', 'types', p]],
    ['still', ['stills', p, '--times', '1', '--out', join(out, name)]],
  ]) {
    const t0 = Date.now()
    const r = spawnSync('pnpm', ['exec', 'cueframe', ...args], { cwd: root, encoding: 'utf8' })
    const ok = r.status === 0
    if (!ok) failed++
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(28)} ${label.padEnd(6)} ${((Date.now() - t0) / 1000).toFixed(1)} s`)
    if (!ok) console.log((r.stdout + r.stderr).trim().split('\n').slice(-12).join('\n'))
  }
}
console.log(`(stills in ${out})`)
process.exitCode = failed ? 1 : 0
