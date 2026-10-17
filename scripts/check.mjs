#!/usr/bin/env node
// For every project under examples/ (a folder with timeline.ts): `check types`, then a still at
// t=1 s, with the CueFrame of the submodule. Run after bumping it: `pnpm check [name…]`.
// A project that imports generated files (build/…) it does not have yet is reported as SKIP with
// the missing files: run its make.sh first (see its README for what that needs).
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'

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

const tsFiles = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  if (e.isDirectory()) return ['node_modules', 'out', 'build', '.cache'].includes(e.name) ? [] : tsFiles(join(dir, e.name))
  return e.name.endsWith('.ts') ? [join(dir, e.name)] : []
})
const missingBuild = (p) => {
  const missing = new Set()
  for (const f of tsFiles(p)) {
    for (const m of readFileSync(f, 'utf8').matchAll(/from\s+['"]((?:\.\.?\/)+build\/[^'"]+)['"]/g)) {
      const target = resolve(dirname(f), m[1])
      if (!existsSync(target.replace(/\?.*$/, ''))) missing.add(relative(p, target).replace(/\?.*$/, ''))
    }
  }
  return [...missing].sort()
}

const out = mkdtempSync(join(tmpdir(), 'cf-examples-'))
let failed = 0
let skipped = 0
for (const p of projects.sort()) {
  const name = relative(join(root, 'examples'), p)
  if (only.length && !only.some((o) => name === o || name.startsWith(`${o}/`))) continue
  const missing = missingBuild(p)
  if (missing.length) {
    skipped++
    console.log(`SKIP  ${name.padEnd(28)} not built yet: ${missing.join(', ')} (run its make.sh)`)
    continue
  }
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
console.log(`${failed} failed, ${skipped} skipped (stills in ${out})`)
process.exitCode = failed ? 1 : 0
