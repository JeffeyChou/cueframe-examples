// theme: the colours and fonts an explainer's chrome (explainer.ts) and instruments (hud.ts) share.
// Colours are named by role, so a meaning keeps its colour across a piece (cueframe/docs/design/hud.md).

export interface Theme {
  text: string; dim: string; faint: string
  /** CSS background over the content while a card shows. */
  shade: string
  /** A panel's fill. */
  surface: string
  accent: string; warm: string; alert: string; good: string
  /** CSS font stacks. */
  sans: string; mono: string
}
export const THEME: Theme = {
  text: '#e6eef2', dim: '#7b8a93', faint: '#3a4a52',
  shade: 'linear-gradient(90deg, rgba(6,8,11,.96) 0%, rgba(6,8,11,.9) 50%, rgba(6,8,11,.75) 100%)',
  surface: 'rgba(12,20,26,0.88)',
  accent: '#38d6e8', warm: '#ff8a3d', alert: '#ff4766', good: '#3ee08f',
  sans: '"Noto Sans SC", sans-serif', mono: 'ui-monospace, monospace',
}

/** What a colour means: the subject, the other side, failure, success, context, plain text. */
export type Role = 'accent' | 'warm' | 'alert' | 'good' | 'dim' | 'text'
export const ROLES: readonly Role[] = ['accent', 'warm', 'alert', 'good', 'dim', 'text']

const COLOUR = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i

export interface Span { text: string; color?: string }

/** "plain **keyword** plain **other**{warm}" → spans; a keyword's colour is a role or a #hex colour. */
export function parseTitle(src: string, theme: Theme = THEME): Span[] {
  const out: Span[] = []
  let i = 0
  while (i < src.length) {
    const a = src.indexOf('**', i)
    if (a < 0) { out.push({ text: src.slice(i) }); break }
    if (a > i) out.push({ text: src.slice(i, a) })
    const b = src.indexOf('**', a + 2)
    if (b < 0) throw new Error(`explainer: "**" not closed in "${src}"`)
    let color = theme.accent
    i = b + 2
    const role = /^\{([^}]*)\}/.exec(src.slice(i))
    if (role) {
      const name = role[1]!.trim()
      if ((ROLES as readonly string[]).includes(name)) color = theme[name as Role]
      else if (COLOUR.test(name)) color = name
      else throw new Error(`explainer: unknown keyword colour "{${name}}" in "${src}" (roles: ${ROLES.join(', ')}; or #rgb, #rrggbb, #rrggbbaa)`)
      i += role[0].length
    }
    out.push({ text: src.slice(a + 2, b), color })
  }
  return out.filter((s) => s.text)
}
