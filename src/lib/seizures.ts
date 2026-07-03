// =============================================================================
// SEIZURE DATASET SELECTORS  (official UNODC data — see src/data/seizures.json)
// =============================================================================
// The bundled JSON is a compact columnar encoding (string tables + integer-
// indexed rows) produced by scripts/convert/wdr-seizures-to-json.mjs from the
// UNODC World Drug Report 2025 Statistical Annex 7.1 (kilograms, 2019-2023).
// This module decodes it once and exposes the query surface the globe needs.
// Seized volume is the standard public proxy for trafficking pressure at a
// location — it reflects both flow and enforcement, which is why every display
// site labels it "seizures", never "consumption" or "production".

import rawJson from '../data/seizures.json'

interface SeizuresDataset {
  meta: { source: string; url: string; downloaded: string; unit: string; years: number[] }
  groups: string[]
  drugs: [name: string, groupIndex: number][]
  countries: [iso3: string, name: string, region: string][]
  records: [countryIndex: number, drugIndex: number, year: number, kg: number][]
}

const raw = rawJson as unknown as SeizuresDataset

export const SEIZURE_META = raw.meta
export const SEIZURE_YEARS: number[] = raw.meta.years
export const SEIZURE_GROUPS: string[] = raw.groups

/** Short display labels for the UNODC drug-group names (chips, legends). */
export const GROUP_SHORT_LABEL: Record<string, string> = {
  'Opioids': 'Opioids',
  'Cannabis-type drugs (excluding synthetic cannabinoids)': 'Cannabis',
  'Amphetamine-type stimulants (excluding “ecstasy”)': 'Meth & amphetamine',
  'Sedatives and tranquillizers': 'Sedatives',
  'Cocaine-type': 'Cocaine',
  'Hallucinogens': 'Hallucinogens',
  '“Ecstasy”-type substances': 'Ecstasy',
  'NPS': 'NPS',
  'Any other drugs/substances': 'Other',
  'Precursors': 'Precursors',
  'Solvents and Inhalants': 'Solvents',
}

export const shortGroupLabel = (group: string): string => GROUP_SHORT_LABEL[group] ?? group

export interface SeizureCountry { iso3: string; name: string; region: string }

export const SEIZURE_COUNTRIES: SeizureCountry[] = raw.countries.map(([iso3, name, region]) => ({ iso3, name, region }))
const countryByIndex = SEIZURE_COUNTRIES

export interface CountryDrugTotal { drug: string; group: string; kg: number }
export interface CountryGroupTotal { group: string; groupIndex: number; kg: number }

/**
 * Sum of seized kg per country for one year, optionally restricted to a drug
 * group. Returned as iso3 -> kg. groupIndex null = all drugs.
 */
export function totalsByCountry(groupIndex: number | null, year: number): Map<string, number> {
  const totals = new Map<string, number>()
  for (const [c, d, y, kg] of raw.records) {
    if (y !== year) continue
    if (groupIndex !== null && raw.drugs[d][1] !== groupIndex) continue
    const iso3 = countryByIndex[c].iso3
    totals.set(iso3, (totals.get(iso3) ?? 0) + kg)
  }
  return totals
}

/**
 * Largest single-country total across ALL years for the group. The globe keeps
 * its colour scale fixed across the year slider (same honest-scale rule as the
 * corridor map's arc widths), so a country that doubles actually reads darker.
 */
export function maxCountryTotal(groupIndex: number | null): number {
  const perYearMax = SEIZURE_YEARS.map((y) => {
    let max = 0
    for (const kg of totalsByCountry(groupIndex, y).values()) max = Math.max(max, kg)
    return max
  })
  return Math.max(0, ...perYearMax)
}

/** Top individual drugs seized in a country in a year, largest first. */
export function topDrugs(iso3: string, year: number, limit = 8): CountryDrugTotal[] {
  const c = countryByIndex.findIndex((x) => x.iso3 === iso3)
  if (c === -1) return []
  const byDrug = new Map<number, number>()
  for (const [ci, d, y, kg] of raw.records) {
    if (ci !== c || y !== year) continue
    byDrug.set(d, (byDrug.get(d) ?? 0) + kg)
  }
  return [...byDrug.entries()]
    .map(([d, kg]) => ({ drug: raw.drugs[d][0], group: raw.groups[raw.drugs[d][1]], kg }))
    .sort((a, b) => b.kg - a.kg)
    .slice(0, limit)
}

/** Per-group totals for a country in a year, largest first. */
export function countryGroupTotals(iso3: string, year: number): CountryGroupTotal[] {
  const c = countryByIndex.findIndex((x) => x.iso3 === iso3)
  if (c === -1) return []
  const byGroup = new Map<number, number>()
  for (const [ci, d, y, kg] of raw.records) {
    if (ci !== c || y !== year) continue
    const g = raw.drugs[d][1]
    byGroup.set(g, (byGroup.get(g) ?? 0) + kg)
  }
  return [...byGroup.entries()]
    .map(([g, kg]) => ({ group: raw.groups[g], groupIndex: g, kg }))
    .sort((a, b) => b.kg - a.kg)
}

/** Country total per year (for the trend mini-chart). groupIndex null = all. */
export function countryTrend(iso3: string, groupIndex: number | null): [year: number, kg: number][] {
  const c = countryByIndex.findIndex((x) => x.iso3 === iso3)
  if (c === -1) return []
  const byYear = new Map<number, number>()
  for (const y of SEIZURE_YEARS) byYear.set(y, 0)
  for (const [ci, d, y, kg] of raw.records) {
    if (ci !== c) continue
    if (groupIndex !== null && raw.drugs[d][1] !== groupIndex) continue
    byYear.set(y, (byYear.get(y) ?? 0) + kg)
  }
  return [...byYear.entries()].sort((a, b) => a[0] - b[0])
}

/** World total (sum over reporting countries) for a group and year. */
export function worldTotal(groupIndex: number | null, year: number): number {
  let sum = 0
  for (const kg of totalsByCountry(groupIndex, year).values()) sum += kg
  return sum
}

/** Drug-group indexes ordered by world total in the latest year, largest first. */
export function groupsByVolume(): { group: string; groupIndex: number; kg: number }[] {
  const latest = SEIZURE_YEARS[SEIZURE_YEARS.length - 1]
  return raw.groups
    .map((group, groupIndex) => ({ group, groupIndex, kg: worldTotal(groupIndex, latest) }))
    .sort((a, b) => b.kg - a.kg)
}

/**
 * Log-scaled position of a value on the colour ramp: log10(1+kg) against
 * log10(1+max). Linear would let the handful of mega-seizure countries crush
 * everything else to the base colour.
 */
export function logShare(kg: number, max: number): number {
  if (max <= 0 || kg <= 0) return 0
  return Math.min(1, Math.log10(1 + kg) / Math.log10(1 + max))
}

/** Human-readable seized mass: tonnes above 1 t, kg below. */
export function fmtKg(kg: number): string {
  if (kg >= 1000) {
    const t = kg / 1000
    return `${t >= 100 ? Math.round(t).toLocaleString('en-US') : t.toFixed(1)} t`
  }
  if (kg >= 1) return `${kg >= 100 ? Math.round(kg) : kg.toFixed(1)} kg`
  return `${kg.toFixed(2)} kg`
}
