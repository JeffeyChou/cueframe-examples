// Pictures of the ladder: gate, adder, core and chip icons, parts names and the NAND schematic.

export const ICON = {
  gate: `<svg viewBox="0 0 100 60"><path d="M14 8h30a22 22 0 0 1 0 44H14z" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="72" cy="30" r="5" fill="none" stroke="currentColor" stroke-width="4"/><path d="M0 20h14M0 40h14M77 30h23" stroke="currentColor" stroke-width="4"/></svg>`,
  nor: `<svg viewBox="0 0 100 60"><path d="M10 8q22 0 40 6q16 8 22 16q-6 8-22 16q-18 6-40 6q12-22 0-44z" fill="none" stroke="currentColor" stroke-width="4"/><path d="M72 30h28M0 20h16M0 40h16" stroke="currentColor" stroke-width="4"/></svg>`,
  not: `<svg viewBox="0 0 100 60"><path d="M20 8l44 22l-44 22z" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="70" cy="30" r="5" fill="none" stroke="currentColor" stroke-width="4"/><path d="M0 30h20M75 30h25" stroke="currentColor" stroke-width="4"/></svg>`,
  add: `<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="26" fill="none" stroke="currentColor" stroke-width="4"/><path d="M30 16v28M16 30h28" stroke="currentColor" stroke-width="5"/></svg>`,
  core: `<svg viewBox="0 0 60 60">${[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => `<rect x="${6 + c * 17}" y="${6 + r * 17}" width="14" height="14" fill="currentColor" opacity="${0.45 + 0.18 * ((r + c) % 3)}"/>`)).join('')}</svg>`,
  chip: `<svg viewBox="0 0 60 60"><rect x="12" y="12" width="36" height="36" rx="3" fill="none" stroke="currentColor" stroke-width="4"/><rect x="21" y="21" width="18" height="18" fill="currentColor" opacity=".6"/>${[18, 26, 34, 42].map((p) => `<path d="M${p} 4v8M${p} 48v8M4 ${p}h8M48 ${p}h8" stroke="currentColor" stroke-width="3"/>`).join('')}</svg>`,
}
/** One MOSFET in a 12-unit cell (an SVG symbol, `color` sets its colour), for a field of them. */
export const FET = `<g id="fet" fill="none" stroke="currentColor" stroke-width=".7"><path d="M0 6h4M4 3.2v5.6M5.6 2.4v7.2M5.6 3.2h4.4V0M5.6 8.8h4.4V12"/></g>`
export const PARTS = ['REG', 'MUX', 'ALU', 'CMP', 'SHL', 'DEC', 'REG', 'ADD', 'MUX', 'REG', 'CMP', 'ALU', 'SHL', 'REG', 'MUX', 'ADD', 'DEC', 'REG', 'ALU', 'MUX', 'CMP', 'REG', 'ADD', 'SHL']
export const LEVELS = ['晶体管', '逻辑门', '加法器', '计算核心', '整颗芯片']
export const CARDS = [
  { label: '逻辑门', en: 'LOGIC GATE', icon: ICON.gate, badge: ['≈4', '个晶体管'] },
  { label: '加法器', en: 'ADDER', icon: ICON.add, badge: ['几十~上百', '个逻辑门'] },
  { label: '计算核心', en: 'CORE', icon: ICON.core, badge: ['成千上万', '个部件'] },
  { label: '整颗芯片', en: 'CHIP', icon: ICON.chip, badge: ['>1000亿', '个晶体管'] },
]

/** A transistor-level NAND gate, as SVG markup. */
export function nandSchematic() {
  const fet = (x: number, y: number, p: boolean) => `<g transform="translate(${x} ${y})"><path d="M0 0v40M14 0v40M14 6h26M14 34h26M-30 20h30" stroke="currentColor" stroke-width="3" fill="none"/>${p ? '<circle cx="-6" cy="20" r="5" fill="none" stroke="currentColor" stroke-width="3"/>' : ''}</g>`
  return `<svg viewBox="0 0 470 290" width="100%" height="100%">
      <path d="M40 20h390M40 270h390" stroke="#ff8a3d" stroke-width="3"/><text x="440" y="26" fill="#7b8a93" font-size="16" font-family="monospace">VDD</text><text x="440" y="276" fill="#7b8a93" font-size="16" font-family="monospace">GND</text>
      ${fet(150, 40, true)}${fet(290, 40, true)}${fet(220, 140, false)}${fet(220, 200, false)}
      <path d="M190 46v-26M330 46v-26M190 74v26h140v-26M260 100v46M260 174v32M260 234v36M120 60h-60v120h130M260 60h-0M260 60h0" stroke="currentColor" stroke-width="3" fill="none"/>
      <path d="M330 100h110" stroke="currentColor" stroke-width="3"/><circle cx="440" cy="100" r="5" fill="currentColor"/>
      <path d="M60 220h130M260 60v0" stroke="currentColor" stroke-width="3"/></svg>`
}
