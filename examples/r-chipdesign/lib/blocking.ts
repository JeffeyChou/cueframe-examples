// blocking: where each element stands in each layout, as a table, for ctx.layouts (cueframe/docs/guide/continuity.md).
// const b = blocking(['spec', 'circuit', 'ladder'])
// b.set(card, { spec: { x: 870, y: 360, w: 560, h: 400 }, circuit: { x: 590, y: 360, w: 460, h: 400 }, ladder: null })
// const lay = ctx.layouts(b.ids.map((id, i) => ({ id, at: times[i] })), b.apply)
// An element stands at its spot from that layout on, until the next one; `null` hides it there
// (opacity 0, still laid out at its last spot, so it can fade or move out). Before its first spot
// it is hidden at that spot.

export interface Spot { x: number; y: number; w: number; h: number; opacity?: number }

export function blocking(ids: readonly string[]) {
  const rows: { el: HTMLElement; spots: { at: Spot; shown: boolean }[] }[] = []
  const index = new Map(ids.map((id, i) => [id, i]))
  return {
    ids,
    /** Where `el` stands from each named layout on; `null` hides it from there. */
    set<E extends HTMLElement>(el: E, spots: Readonly<Record<string, Spot | null>>): E {
      for (const id of Object.keys(spots)) if (!index.has(id)) throw new Error(`blocking: unknown layout "${id}" (known: ${ids.join(', ')})`)
      const first = ids.map((id) => spots[id]).find((s) => s)
      if (!first) throw new Error('blocking: an element needs at least one spot')
      let at: Spot = first
      let shown = false
      rows.push({
        el,
        spots: ids.map((id) => {
          const s = spots[id]
          if (s) { at = s; shown = true } else if (s === null) shown = false
          return { at, shown }
        }),
      })
      el.style.position = 'absolute'
      return el
    },
    /** The spot `el` has in layout `id` (where it stands, hidden or not). */
    spot(el: HTMLElement, id: string): Spot {
      const i = index.get(id)
      if (i === undefined) throw new Error(`blocking: unknown layout "${id}"`)
      const r = rows.find((x) => x.el === el)
      if (!r) throw new Error('blocking: spot() of an element that was never set')
      return r.spots[i]!.at
    },
    /** Puts every element where layout `id` says. */
    apply(id: string) {
      const i = index.get(id)
      if (i === undefined) throw new Error(`blocking: unknown layout "${id}"`)
      for (const r of rows) {
        const { at, shown } = r.spots[i]!
        const st = r.el.style
        st.left = `${at.x}px`
        st.top = `${at.y}px`
        st.width = `${at.w}px`
        st.height = `${at.h}px`
        st.opacity = shown ? String(at.opacity ?? 1) : '0'
      }
    },
  }
}
