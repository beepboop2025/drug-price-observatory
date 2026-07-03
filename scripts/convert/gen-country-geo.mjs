#!/usr/bin/env node
/**
 * Generate src/data/countryGeo.ts: for every country in src/data/seizures.json,
 * a map centroid [lon, lat] plus the atlas feature id → ISO3 mapping the globe
 * choropleth needs to colour polygons.
 *
 * The atlas is src/data/countries-ind.json — Natural Earth 10m admin-0
 * countries, INDIA POINT OF VIEW variant (ne_10m_admin_0_countries_ind),
 * simplified with mapshaper. This is Natural Earth's published de-jure
 * depiction as mandated by the Government of India: India includes the full
 * former state of Jammu & Kashmir (incl. Gilgit-Baltistan and Aksai Chin).
 * Feature ids are ADM0_A3 codes, which match UNODC msCode ISO3 for almost
 * every country; the remainder resolve by name via ALIASES.
 *
 * Centroids come from d3-geo's geoCentroid (no network). Territories with no
 * polygon get hand-maintained coordinates below. Run after regenerating
 * seizures.json:
 *   node scripts/convert/gen-country-geo.mjs
 */

import fs from 'node:fs'
import { geoCentroid } from 'd3-geo'
import topojsonPkg from 'topojson-client'
import { createRequire } from 'node:module'

const { feature } = topojsonPkg
const require = createRequire(import.meta.url)
const topology = require('../../src/data/countries-ind.json')
const seizures = JSON.parse(fs.readFileSync('src/data/seizures.json', 'utf8'))

/** seizure-data country name → atlas feature name, for ids that don't match directly. */
const ALIASES = {
  'Bolivia (Plurinational State of)': 'Bolivia',
  'Bosnia and Herzegovina': 'Bosnia and Herz.',
  'Brunei Darussalam': 'Brunei',
  'Central African Republic': 'Central African Rep.',
  "Côte d'Ivoire": "Côte d'Ivoire",
  'Democratic Republic of the Congo': 'Dem. Rep. Congo',
  'Dominican Republic': 'Dominican Rep.',
  'Iran (Islamic Republic of)': 'Iran',
  "Lao People's Democratic Republic": 'Laos',
  'Republic of Korea': 'South Korea',
  'Republic of Moldova': 'Moldova',
  'Russian Federation': 'Russia',
  'South Sudan': 'S. Sudan',
  'Syrian Arab Republic': 'Syria',
  'United Kingdom (England and Wales)': 'United Kingdom',
  'United Kingdom (Northern Ireland)': 'United Kingdom',
  'United Kingdom (Scotland)': 'United Kingdom',
  'United Republic of Tanzania': 'Tanzania',
  'United States of America': 'United States of America',
  'Venezuela (Bolivarian Republic of)': 'Venezuela',
  'Viet Nam': 'Vietnam',
  'Türkiye': 'Turkey',
  'North Macedonia': 'Macedonia',
  'Eswatini': 'eSwatini',
  'Equatorial Guinea': 'Eq. Guinea',
  'State of Palestine': 'Palestine',
  'Solomon Islands': 'Solomon Is.',
  'Timor-Leste': 'Timor-Leste',
  "Democratic People's Republic of Korea": 'North Korea',
  'China, Taiwan Province of China': 'Taiwan',
}

/** Territories absent from the 110m atlas: hand-maintained [lon, lat]. */
const MANUAL_CENTROIDS = {
  HKG: [114.17, 22.32], MAC: [113.55, 22.19], SGP: [103.82, 1.35],
  MLT: [14.38, 35.94], BHR: [50.55, 26.05], BRB: [-59.55, 13.18],
  MDV: [73.4, 3.25], MUS: [57.55, -20.28], SYC: [55.49, -4.68],
  CPV: [-23.6, 15.1], COM: [43.87, -11.87], STP: [6.72, 0.32],
  GRD: [-61.68, 12.11], LCA: [-60.98, 13.9], VCT: [-61.2, 13.25],
  ATG: [-61.8, 17.08], DMA: [-61.36, 15.42], KNA: [-62.75, 17.33],
  BHS: [-77.4, 24.25], BRN: [114.73, 4.53], TON: [-175.2, -21.18],
  KIR: [-157.36, 1.87], FSM: [158.22, 6.92], PLW: [134.58, 7.51],
  WSM: [-172.1, -13.76], AND: [1.52, 42.51], LIE: [9.55, 47.16],
  MCO: [7.42, 43.74], SMR: [12.46, 43.94], BMU: [-64.75, 32.3],
  CYM: [-81.25, 19.31], TCA: [-71.8, 21.75], VGB: [-64.62, 18.42],
  ABW: [-69.97, 12.52], CUW: [-68.99, 12.17], SXM: [-63.05, 18.04],
  MHL: [171.18, 7.13], NRU: [166.92, -0.52], TUV: [179.2, -7.11],
  GIB: [-5.35, 36.14], VAT: [12.45, 41.9],
}

const features = feature(topology, topology.objects.countries).features
const byId = new Map(features.map((f) => [String(f.id), f]))
const byName = new Map(features.map((f) => [f.properties?.name, f]))

const numericToIso3 = {}
const centroids = {}
const unmatched = []

for (const [iso3, name] of seizures.countries) {
  const f = byId.get(iso3) ?? byName.get(ALIASES[name] ?? name)
  if (f) {
    numericToIso3[f.id] = iso3
    if (!centroids[iso3]) {
      const [lon, lat] = geoCentroid(f)
      // Micro-territories can simplify into degenerate polygons whose
      // centroid is NaN — fall back to the hand-maintained coordinates.
      centroids[iso3] = Number.isFinite(lon) && Number.isFinite(lat)
        ? [Math.round(lon * 100) / 100, Math.round(lat * 100) / 100]
        : MANUAL_CENTROIDS[iso3]
      if (!centroids[iso3]) { delete centroids[iso3]; unmatched.push(`${iso3} ${name} (degenerate centroid)`) }
    }
  } else if (MANUAL_CENTROIDS[iso3]) {
    centroids[iso3] = MANUAL_CENTROIDS[iso3]
  } else {
    unmatched.push(`${iso3} ${name}`)
  }
}

if (unmatched.length) {
  console.error('UNMATCHED (no atlas polygon, no manual centroid):')
  unmatched.forEach((u) => console.error('  ' + u))
}

const ts = `// =============================================================================
// GENERATED FILE — do not edit by hand.
// Regenerate with: node scripts/convert/gen-country-geo.mjs
// Atlas: src/data/countries-ind.json (Natural Earth 10m admin-0, India-POV
// variant — GoI-mandated boundaries). Centroids via d3-geo geoCentroid;
// territories without polygons use hand-maintained coordinates (see the
// generator script). Used by the seizure globe (WorldMap).
// =============================================================================

/** Atlas feature id (ADM0_A3) -> UNODC ISO3 (seizure-reporting countries only). */
export const FEATURE_TO_ISO3: Record<string, string> = ${JSON.stringify(numericToIso3)}

/** ISO3 -> [longitude, latitude] map centroid. */
export const COUNTRY_CENTROID: Record<string, [number, number]> = ${JSON.stringify(centroids)}
`
fs.writeFileSync('src/data/countryGeo.ts', ts)
console.log(`mapped polygons: ${Object.keys(numericToIso3).length}, centroids: ${Object.keys(centroids).length} / ${seizures.countries.length} countries, unmatched: ${unmatched.length}`)
