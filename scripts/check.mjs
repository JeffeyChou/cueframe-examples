#!/usr/bin/env node
// For every project under examples/ (a folder with timeline.ts): `check types`, then a still at
// t=1 s, with the CueFrame of the submodule. Run after bumping it: `pnpm check [--strict] [name…]`.
// An example lists the files it imports from build/ in its package.json (`cueframe.generated`,
// with what building them `needs`); while one of those is missing the project is SKIP (FAIL with
// --strict). A missing import that is not listed always fails, and so does an unknown name.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const argv = process.argv.slice(2)
const strict = argv.includes('--strict')
const only = argv.filter((a) => a !== '--strict')
const projects = []
const walk = (dir, depth) => {
  if (existsSync(join(dir, 'timeline.ts'))) { projects.push(dir); return }
  if (depth === 0) return
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && !['node_modules', 'out', 'build', '.cache'].includes(e.name)) walk(join(dir, e.name), depth - 1)
  }
}
walk(join(root, 'examples'), 2)
const nameOf = (p) => relative(join(root, 'examples'), p)
const selected = (name) => !only.length || only.some((o) => name === o || name.startsWith(`${o}/`))
const unknown = only.filter((o) => !projects.some((p) => nameOf(p) === o || nameOf(p).startsWith(`${o}/`)))
if (unknown.length) {
  console.log(`FAIL  no example named ${unknown.join(', ')} (known: ${[...new Set(projects.map((p) => nameOf(p).split('/')[0]))].join(', ')})`)
  process.exit(1)
}

const tsFiles = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  if (e.isDirectory()) return ['node_modules', 'out', 'build', '.cache'].includes(e.name) ? [] : tsFiles(join(dir, e.name))
  return e.name.endsWith('.ts') ? [join(dir, e.name)] : []
})
/** build/ files the project's sources import that do not exist, relative to `base`. */
const missingBuild = (p, base) => {
  const missing = new Set()
  for (const f of tsFiles(p)) {
    for (const m of readFileSync(f, 'utf8').matchAll(/from\s+['"]((?:\.\.?\/)+build\/[^'"?]+)(?:\?[^'"]*)?['"]/g)) {
      const target = resolve(dirname(f), m[1])
      if (!existsSync(target)) missing.add(relative(base, target))
    }
  }
  return [...missing].sort()
}
/** The example's declaration: the folder up to examples/<name> whose package.json has `cueframe`. */
const declared = (p) => {
  for (let d = p; d.startsWith(join(root, 'examples')); d = dirname(d)) {
    const pkg = join(d, 'package.json')
    if (!existsSync(pkg)) continue
    const c = JSON.parse(readFileSync(pkg, 'utf8')).cueframe
    if (c) return { dir: d, generated: new Set(c.generated ?? []), needs: c.needs ?? 'its make.sh' }
  }
  return { dir: p, generated: new Set(), needs: '' }
}

const out = mkdtempSync(join(tmpdir(), 'cf-examples-'))
let failed = 0
let skipped = 0
for (const p of projects.sort()) {
  const name = nameOf(p)
  if (!selected(name)) continue
  const decl = declared(p)
  const missing = missingBuild(p, decl.dir)
  const undeclared = missing.filter((m) => !decl.generated.has(m))
  if (undeclared.length) {
    failed++
    console.log(`FAIL  ${name.padEnd(28)} imports missing files it does not declare as generated: ${undeclared.join(', ')}`)
    continue
  }
  if (missing.length) {
    if (strict) failed++
    else skipped++
    console.log(`${strict ? 'FAIL' : 'SKIP'}  ${name.padEnd(28)} not built yet: ${missing.join(', ')} (needs ${decl.needs})`)
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
console.log(`${failed} failed, ${skipped} skipped${strict ? ' (strict)' : ''} (stills in ${out})`)
process.exitCode = failed ? 1 : 0
