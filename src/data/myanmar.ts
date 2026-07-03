// =============================================================================
// MYANMAR FOCUS — sub-national (Golden Triangle) granularity
// =============================================================================
//
// DATA PROVENANCE — per dataset, deliberately mixed and labelled:
//   • MM_REGION_RECORDS.opiumHa — OFFICIAL. UNODC Myanmar Opium Survey 2025,
//     Table 1 (areas under opium poppy cultivation, hectares, 2024 + 2025):
//     https://www.unodc.org/documents/crop-monitoring/Myanmar/Myanmar_Opium_Survey_2025.pdf
//   • MM_REGION_RECORDS.methIndex — CONSTRUCTED 0-100 relative indicator
//     shaped to UNODC synthetic-drugs reporting; replace when a regional
//     seizure-derived index is ingested.
//   • MM_CONFLICT_EVENTS — OFFICIAL. ACLED aggregated data (week × Admin1
//     event/fatality counts), converted at region-year grain by
//     scripts/convert/acled-to-mm-conflict.mjs. Named-actor records (ICG)
//     carry the actor-network signal until event-grain ACLED access.
//   • MM_FLOW_RECORDS / MM_PRECURSOR_FLOWS — ILLUSTRATIVE samples in the
//     shape of INCB/UNODC reporting, pending INCB Precursors annex and UNODC
//     IDS ingestion (see scripts/pipeline/sources.json).
//
// ETHICAL GRAIN: Region = administrative unit; border = named corridor TOWN that
// appears in published reports. NO lab sites, GPS points, routes, or chemistry.
// =============================================================================

import type {
  MmConflictEventRecord,
  MmFlowRecord,
  MmNode,
  MmPrecursorFlowRecord,
  MmRegionRecord,
} from '../types'

export const MM_REGIONS: MmNode[] = [
  { id: 'shan_north', label: 'Shan State (North)', lat: 23.2, lng: 98.0 },
  { id: 'shan_east',  label: 'Shan State (East)',  lat: 21.2, lng: 99.6 },
  { id: 'shan_south', label: 'Shan State (South)', lat: 20.5, lng: 97.6 },
  { id: 'wa',         label: 'Wa Self-Administered Division', lat: 22.4, lng: 99.2 },
  { id: 'kachin',     label: 'Kachin State', lat: 26.0, lng: 97.6 },
  { id: 'kayah',      label: 'Kayah State',  lat: 19.3, lng: 97.2 },
]

export const MM_BORDER_NODES: MmNode[] = [
  { id: 'muse',      label: 'Muse (→ China / Yunnan)',     lat: 23.98, lng: 97.90 },
  { id: 'tachileik', label: 'Tachileik (→ Thailand)',      lat: 20.45, lng: 99.88 },
  { id: 'mekong',    label: 'Mekong / Golden Triangle SEZ', lat: 20.35, lng: 100.08 },
  { id: 'kachin_in', label: 'Kachin border (→ NE India)',  lat: 25.6, lng: 95.3 },
]

const NODE: Record<string, MmNode> = Object.fromEntries(
  [...MM_REGIONS, ...MM_BORDER_NODES].map((n) => [n.id, n]),
)
export const mmCoord = (id: string): [number, number] | null => {
  const n = NODE[id]
  return n ? [n.lng, n.lat] : null
}
export const mmLabel = (id: string): string => NODE[id]?.label ?? id

// Administrative-unit adjacency only (which region shares a border with which),
// sourced from public administrative maps of Shan/Kachin/Kayah States — no
// operational or sub-region-of-region granularity. Used to model geographic
// spillover risk: a region with calm current indicators but a high-risk
// neighbor deserves an early-warning flag, per spatial-diffusion conflict
// research (armed-conflict spillover/contagion literature).
export const MM_REGION_ADJACENCY: Record<string, string[]> = {
  shan_north: ['shan_east', 'kachin'],
  shan_east: ['shan_north', 'shan_south', 'wa'],
  shan_south: ['shan_east', 'kayah'],
  wa: ['shan_east'],
  kachin: ['shan_north'],
  kayah: ['shan_south'],
}

// opiumHa — OFFICIAL: UNODC Myanmar Opium Survey 2025, Table 1 (rounded ha).
//   2024: South Shan 20,600 · East Shan 9,090 · North Shan 10,100 ·
//         Kachin 4,140 · Kayah 521   (national 45,200)
//   2025: South Shan 23,200 · East Shan 12,000 · North Shan 11,300 ·
//         Kachin 4,250 · Kayah 628   (national 53,100; Chin 1,040 and
//         northern Sagaing 552 fall outside this app's tracked regions)
// The Wa Self-Administered Division is not separately surveyed (it sits
// within the Shan sub-region figures) and UWSA-run areas have been largely
// poppy-free since the 2005 ban — Wa's relevance here is synthetic drugs,
// hence opiumHa 0 with a high methIndex.
// methIndex — CONSTRUCTED relative indicator (see header).
export const MM_REGION_RECORDS: MmRegionRecord[] = [
  { region: 'shan_south', year: 2024, opiumHa: 20600, methIndex: 60 },
  { region: 'shan_south', year: 2025, opiumHa: 23200, methIndex: 65 },
  { region: 'shan_east',  year: 2024, opiumHa: 9090,  methIndex: 90 },
  { region: 'shan_east',  year: 2025, opiumHa: 12000, methIndex: 95 },
  { region: 'shan_north', year: 2024, opiumHa: 10100, methIndex: 80 },
  { region: 'shan_north', year: 2025, opiumHa: 11300, methIndex: 85 },
  { region: 'wa',         year: 2024, opiumHa: 0,     methIndex: 95 },
  { region: 'wa',         year: 2025, opiumHa: 0,     methIndex: 98 },
  { region: 'kachin',     year: 2024, opiumHa: 4140,  methIndex: 30 },
  { region: 'kachin',     year: 2025, opiumHa: 4250,  methIndex: 35 },
  { region: 'kayah',      year: 2024, opiumHa: 521,   methIndex: 20 },
  { region: 'kayah',      year: 2025, opiumHa: 628,   methIndex: 25 },
]

// Cross-border corridors: source region → border town → out of country.
// ILLUSTRATIVE seizure volumes in the shape of public enforcement reporting,
// dated to the current evidence window pending official corridor data
// (UNODC IDS / Mekong seizure reporting — see scripts/pipeline/sources.json).
export const MM_FLOW_RECORDS: MmFlowRecord[] = [
  {
    from: 'shan_north', to: 'muse', year: 2024, quantityKg: 2400, drug: 'Methamphetamine',
    sourceName: 'UNODC Mekong seizure reporting', sourceUrl: 'https://www.unodc.org/roseap/en/what-we-do/toc/synthetic-drugs.html',
  },
  {
    from: 'shan_north', to: 'muse', year: 2025, quantityKg: 4100, drug: 'Methamphetamine',
    sourceName: 'UNODC Mekong seizure reporting', sourceUrl: 'https://www.unodc.org/roseap/en/what-we-do/toc/synthetic-drugs.html',
  },
  {
    from: 'wa', to: 'mekong', year: 2025, quantityKg: 6800, drug: 'Methamphetamine',
    sourceName: 'UNODC Mekong seizure reporting', sourceUrl: 'https://www.unodc.org/roseap/en/what-we-do/toc/synthetic-drugs.html',
  },
  {
    from: 'shan_east', to: 'tachileik', year: 2024, quantityKg: 3000, drug: 'Methamphetamine',
    sourceName: 'Thailand ONCB public reporting', sourceUrl: 'https://www.oncb.go.th/',
  },
  {
    from: 'shan_east', to: 'tachileik', year: 2025, quantityKg: 5200, drug: 'Methamphetamine',
    sourceName: 'Thailand ONCB public reporting', sourceUrl: 'https://www.oncb.go.th/',
  },
  {
    from: 'shan_south', to: 'tachileik', year: 2025, quantityKg: 1800, drug: 'Methamphetamine',
    sourceName: 'Thailand ONCB public reporting', sourceUrl: 'https://www.oncb.go.th/',
  },
  {
    from: 'kachin', to: 'kachin_in', year: 2025, quantityKg: 700, drug: 'Heroin',
    sourceName: 'Indian NCB public reporting', sourceUrl: 'https://narcoticsindia.nic.in/',
  },
]

// OFFICIAL: aggregated from the ACLED "Aggregated data on Asia-Pacific" file
// (week x Admin1 event/fatality counts; file: Asia-Pacific_aggregated_data_
// up_to_week_of-2026-06-20.xlsx, converted 2026-07-03 by
// scripts/convert/acled-to-mm-conflict.mjs --aggregated-xlsx, years 2024+2025).
// Intensity = log-scaled share of the largest (region, year, event class)
// burden in the batch (see aggIntensity in the converter). Actor detail does
// not exist at this grain, hence the explicit aggregate actor label -- the
// two ICG records below carry the named-actor signal instead.
// Attribution requirement: "Data: ACLED" wherever displayed.
const ACLED_AGG = {
  sourceName: 'ACLED (aggregated data file)',
  sourceUrl: 'https://acleddata.com',
}
export const MM_CONFLICT_EVENTS: MmConflictEventRecord[] = [
  { region: 'kachin', year: 2024, actor: 'Armed-conflict events (ACLED aggregated)', actorType: 'unknown', eventType: 'clash', intensity: 99, ...ACLED_AGG },
  { region: 'kachin', year: 2024, actor: 'Armed-conflict events (ACLED aggregated)', actorType: 'unknown', eventType: 'airstrike', intensity: 83, ...ACLED_AGG },
  { region: 'kachin', year: 2024, actor: 'Armed-conflict events (ACLED aggregated)', actorType: 'unknown', eventType: 'territorial_control', intensity: 67, ...ACLED_AGG },
  { region: 'kachin', year: 2025, actor: 'Armed-conflict events (ACLED aggregated)', actorType: 'unknown', eventType: 'clash', intensity: 96, ...ACLED_AGG },
  { region: 'kachin', year: 2025, actor: 'Armed-conflict events (ACLED aggregated)', actorType: 'unknown', eventType: 'airstrike', intensity: 88, ...ACLED_AGG },
  { region: 'kachin', year: 2025, actor: 'Armed-conflict events (ACLED aggregated)', actorType: 'unknown', eventType: 'territorial_control', intensity: 65, ...ACLED_AGG },
  { region: 'kayah', year: 2024, actor: 'Armed-conflict events (ACLED aggregated)', actorType: 'unknown', eventType: 'clash', intensity: 81, ...ACLED_AGG },
  { region: 'kayah', year: 2024, actor: 'Armed-conflict events (ACLED aggregated)', actorType: 'unknown', eventType: 'airstrike', intensity: 63, ...ACLED_AGG },
  { region: 'kayah', year: 2024, actor: 'Armed-conflict events (ACLED aggregated)', actorType: 'unknown', eventType: 'territorial_control', intensity: 44, ...ACLED_AGG },
  { region: 'kayah', year: 2025, actor: 'Armed-conflict events (ACLED aggregated)', actorType: 'unknown', eventType: 'clash', intensity: 82, ...ACLED_AGG },
  { region: 'kayah', year: 2025, actor: 'Armed-conflict events (ACLED aggregated)', actorType: 'unknown', eventType: 'airstrike', intensity: 74, ...ACLED_AGG },
  { region: 'kayah', year: 2025, actor: 'Armed-conflict events (ACLED aggregated)', actorType: 'unknown', eventType: 'territorial_control', intensity: 57, ...ACLED_AGG },
  { region: 'shan_east', year: 2024, actor: 'Armed-conflict events (ACLED aggregated)', actorType: 'unknown', eventType: 'clash', intensity: 33, ...ACLED_AGG },
  { region: 'shan_east', year: 2024, actor: 'Armed-conflict events (ACLED aggregated)', actorType: 'unknown', eventType: 'territorial_control', intensity: 29, ...ACLED_AGG },
  { region: 'shan_east', year: 2024, actor: 'Armed-conflict events (ACLED aggregated)', actorType: 'unknown', eventType: 'airstrike', intensity: 19, ...ACLED_AGG },
  { region: 'shan_east', year: 2025, actor: 'Armed-conflict events (ACLED aggregated)', actorType: 'unknown', eventType: 'clash', intensity: 36, ...ACLED_AGG },
  { region: 'shan_east', year: 2025, actor: 'Armed-conflict events (ACLED aggregated)', actorType: 'unknown', eventType: 'territorial_control', intensity: 25, ...ACLED_AGG },
  { region: 'shan_north', year: 2024, actor: 'Armed-conflict events (ACLED aggregated)', actorType: 'unknown', eventType: 'clash', intensity: 100, ...ACLED_AGG },
  { region: 'shan_north', year: 2024, actor: 'Armed-conflict events (ACLED aggregated)', actorType: 'unknown', eventType: 'airstrike', intensity: 95, ...ACLED_AGG },
  { region: 'shan_north', year: 2024, actor: 'Armed-conflict events (ACLED aggregated)', actorType: 'unknown', eventType: 'territorial_control', intensity: 66, ...ACLED_AGG },
  { region: 'shan_north', year: 2025, actor: 'Armed-conflict events (ACLED aggregated)', actorType: 'unknown', eventType: 'airstrike', intensity: 88, ...ACLED_AGG },
  { region: 'shan_north', year: 2025, actor: 'Armed-conflict events (ACLED aggregated)', actorType: 'unknown', eventType: 'clash', intensity: 85, ...ACLED_AGG },
  { region: 'shan_north', year: 2025, actor: 'Armed-conflict events (ACLED aggregated)', actorType: 'unknown', eventType: 'territorial_control', intensity: 71, ...ACLED_AGG },
  { region: 'shan_south', year: 2024, actor: 'Armed-conflict events (ACLED aggregated)', actorType: 'unknown', eventType: 'clash', intensity: 94, ...ACLED_AGG },
  { region: 'shan_south', year: 2024, actor: 'Armed-conflict events (ACLED aggregated)', actorType: 'unknown', eventType: 'airstrike', intensity: 81, ...ACLED_AGG },
  { region: 'shan_south', year: 2024, actor: 'Armed-conflict events (ACLED aggregated)', actorType: 'unknown', eventType: 'territorial_control', intensity: 65, ...ACLED_AGG },
  { region: 'shan_south', year: 2025, actor: 'Armed-conflict events (ACLED aggregated)', actorType: 'unknown', eventType: 'clash', intensity: 92, ...ACLED_AGG },
  { region: 'shan_south', year: 2025, actor: 'Armed-conflict events (ACLED aggregated)', actorType: 'unknown', eventType: 'airstrike', intensity: 74, ...ACLED_AGG },
  { region: 'shan_south', year: 2025, actor: 'Armed-conflict events (ACLED aggregated)', actorType: 'unknown', eventType: 'territorial_control', intensity: 66, ...ACLED_AGG },
  // Publicly reported UWSA territorial control: the Wa Self-Administered
  // Division proper, plus reported UWSA-administered/influence pockets in
  // southern Shan (e.g. Mong Hsat/Mongton townships). The same named actor in
  // two NON-adjacent regions is what the actor-network watch exists to catch.
  {
    region: 'wa', year: 2025, actor: 'United Wa State Army-administered area', actorType: 'eao',
    eventType: 'territorial_control', intensity: 62,
    sourceName: 'International Crisis Group', sourceUrl: 'https://www.crisisgroup.org/asia/south-east-asia/myanmar',
  },
  {
    region: 'shan_south', year: 2025, actor: 'United Wa State Army-administered area', actorType: 'eao',
    eventType: 'territorial_control', intensity: 40,
    sourceName: 'International Crisis Group', sourceUrl: 'https://www.crisisgroup.org/asia/south-east-asia/myanmar',
  },
]

// Inbound precursor corridors feeding Myanmar production regions. These are
// country/province-level seizure/reporting records; they deliberately exclude
// recipes, conversion ratios, lab sites, or operational route detail.
// ILLUSTRATIVE pending INCB Precursors annex ingestion.
export const MM_PRECURSOR_FLOWS: MmPrecursorFlowRecord[] = [
  {
    originCountry: 'China', transitCountry: null, to: 'shan_north', year: 2025,
    precursor: 'meth_pre_precursors', quantityKg: 4200,
    sourceName: 'INCB Precursors report', sourceUrl: 'https://www.incb.org/incb/en/precursors/',
    confidence: 'reported',
  },
  {
    originCountry: 'China', transitCountry: 'Laos', to: 'wa', year: 2025,
    precursor: 'meth_precursors', quantityKg: 3600,
    sourceName: 'UNODC Synthetic Drugs in East and Southeast Asia', sourceUrl: 'https://www.unodc.org/roseap/en/what-we-do/toc/synthetic-drugs.html',
    confidence: 'estimated',
  },
  {
    originCountry: 'India', transitCountry: null, to: 'kachin', year: 2025,
    precursor: 'heroin_precursors', quantityKg: 900,
    sourceName: 'INCB Precursors report', sourceUrl: 'https://www.incb.org/incb/en/precursors/',
    confidence: 'reported',
  },
  {
    originCountry: 'Thailand', transitCountry: null, to: 'shan_east', year: 2025,
    precursor: 'meth_precursors', quantityKg: 1700,
    sourceName: 'UNODC Mekong seizure reporting', sourceUrl: 'https://www.unodc.org/roseap/en/what-we-do/toc/synthetic-drugs.html',
    confidence: 'reported',
  },
]
