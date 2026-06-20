// =============================================================================
// HERO SCENE DATA — derived straight from the real corridor dataset.
// The globe is not decoration: every node is a COUNTRY_CENTROID and every arc
// is a leg of a FLOW_RECORD, coloured with the same source=coral / transit=cyan
// semantics as the 2D Flow Map.
// =============================================================================
import { COUNTRY_CENTROIDS, FLOW_RECORDS } from '../data/flows'

export interface HeroNode { name: string; lat: number; lng: number; isSource: boolean }
export interface HeroArc { from: [number, number]; to: [number, number]; fromSource: boolean }

// A country is a "source" if it originates any corridor (China, India, …).
const SOURCE_NAMES = new Set(FLOW_RECORDS.map((r) => r.origin))

export const HERO_NODES: HeroNode[] = Object.entries(COUNTRY_CENTROIDS).map(
  ([name, c]) => ({ name, lat: c.lat, lng: c.lng, isSource: SOURCE_NAMES.has(name) }),
)

// Break each corridor into origin→transit→destination legs (skipping nulls).
export const HERO_ARCS: HeroArc[] = FLOW_RECORDS.flatMap((rec) => {
  const stops = [rec.origin, rec.transit, rec.destination].filter(
    (s): s is string => Boolean(s),
  )
  const arcs: HeroArc[] = []
  for (let i = 0; i < stops.length - 1; i++) {
    const a = COUNTRY_CENTROIDS[stops[i]]
    const b = COUNTRY_CENTROIDS[stops[i + 1]]
    if (!a || !b) continue
    arcs.push({
      from: [a.lat, a.lng],
      to: [b.lat, b.lng],
      fromSource: SOURCE_NAMES.has(stops[i]),
    })
  }
  return arcs
})

export const COLOR_HOT = '#ffab98'   // coral — source
export const COLOR_COOL = '#a1ecff'  // cyan — transit / destination
