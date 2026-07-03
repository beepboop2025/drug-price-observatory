/**
 * Data ingestion module for drug-price-observatory.
 *
 * Parses official CSV exports (INCB/UNODC) into fixed JavaScript schemas.
 * Pure functions only: no network calls, no filesystem writes, no console spam.
 */

import type {
  PriceRecord,
  PrecursorPriceRecord,
  FlowRecord,
  MmNode,
  MmRegionRecord,
  MmFlowRecord,
  MmConflictEventRecord,
  MmPrecursorFlowRecord,
  ParseResult,
  Drug,
  PrecursorId,
  MyanmarDrug,
  MyanmarConflictActorType,
  MyanmarConflictEventType,
  SourceConfidence,
} from '../types'

// =============================================================================
// Type guards for union types
// =============================================================================

const VALID_DRUGS = ['cocaine', 'heroin', 'cannabis', 'methamphetamine'] as const
function isDrug(v: string): v is Drug {
  return (VALID_DRUGS as readonly string[]).includes(v)
}

const VALID_PRECURSORS = [
  'fentanyl_precursors',
  'meth_precursors',
  'meth_pre_precursors',
  'heroin_precursors',
] as const
function isPrecursorId(v: string): v is PrecursorId {
  return (VALID_PRECURSORS as readonly string[]).includes(v)
}

const VALID_MYANMAR_DRUGS = ['Methamphetamine', 'Heroin'] as const
function isMyanmarDrug(v: string): v is MyanmarDrug {
  return (VALID_MYANMAR_DRUGS as readonly string[]).includes(v)
}

const VALID_CONFLICT_ACTOR_TYPES = [
  'military',
  'eao',
  'militia',
  'resistance',
  'criminal',
  'state',
  'unknown',
] as const
function isMyanmarConflictActorType(v: string): v is MyanmarConflictActorType {
  return (VALID_CONFLICT_ACTOR_TYPES as readonly string[]).includes(v)
}

const VALID_CONFLICT_EVENT_TYPES = [
  'clash',
  'airstrike',
  'territorial_control',
  'ceasefire',
  'sanction',
  'seizure',
  'other',
] as const
function isMyanmarConflictEventType(v: string): v is MyanmarConflictEventType {
  return (VALID_CONFLICT_EVENT_TYPES as readonly string[]).includes(v)
}

const VALID_SOURCE_CONFIDENCE = ['official', 'reported', 'estimated'] as const
function isSourceConfidence(v: string): v is SourceConfidence {
  return (VALID_SOURCE_CONFIDENCE as readonly string[]).includes(v)
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Header-name mapping configuration.
 * Each key is our canonical field name; the array lists possible source
 * column names (case-insensitive, whitespace-trimmed) that UNODC or INCB
 * exports may use.
 */
export const CONFIG: Record<string, string[]> = {
  id: ['id', 'node id', 'node_id', 'code'],
  label: ['label', 'name', 'node label', 'node_label', 'town', 'location'],
  lat: ['lat', 'latitude', 'y', 'lat_wgs84'],
  lng: ['lng', 'lon', 'longitude', 'x', 'lng_wgs84'],
  drug: ['drug', 'substance', 'drug type', 'drug_name', 'drug name', 'narcotic', 'product type'],
  precursor: ['precursor', 'chemical', 'precursor_name', 'precursor name', 'substance group'],
  country: ['country', 'nation', 'state', 'territory', 'country_name', 'country name'],
  iso3: ['iso3', 'iso', 'iso code', 'country code', 'iso3 code'],
  region: [
    'region',
    'area',
    'regional group',
    'region_name',
    'region name',
    'region id',
    'region_id',
    'subregion',
  ],
  year: ['year', 'yr', 'date', 'year_text'],
  priceUsdPerGram: [
    'price usd per gram',
    'priceusdpergram',
    'price per gram',
    'retail price usd/g',
    'price_usd_per_gram',
  ],
  priceUsdPerKg: [
    'price usd per kg',
    'priceusdperkg',
    'price per kg',
    'price usd/kg',
    'price_usd_per_kg',
  ],
  purityPct: ['purity pct', 'purity', 'purity percent', 'purity %', 'purity_pct'],
  origin: ['origin', 'source', 'originating country', 'origin_country', 'origin country'],
  transit: ['transit', 'transit country', 'transiting country', 'via'],
  destination: ['destination', 'dest', 'destination country', 'destination_country'],
  from: ['from', 'from id', 'from_id'],
  to: ['to', 'to id', 'to_id'],
  quantityKg: [
    'quantity kg',
    'quantity',
    'quantity_kg',
    'amount kg',
    'weight kg',
    'seized kg',
    'seizure kg',
    'volume kg',
  ],
  actor: ['actor', 'armed actor', 'party', 'conflict actor', 'group'],
  actorType: ['actor type', 'actor_type', 'party type', 'group type'],
  eventType: ['event type', 'event_type', 'incident type', 'event'],
  intensity: ['intensity', 'conflict intensity', 'conflict index', 'pressure index'],
  sourceName: ['source name', 'source_name', 'source', 'publisher', 'report'],
  sourceUrl: ['source url', 'source_url', 'url', 'link'],
  originCountry: ['origin country', 'origin_country', 'sender country', 'source country', 'country of origin'],
  transitCountry: ['transit country', 'transit_country', 'via country', 'transit'],
  confidence: ['confidence', 'source confidence', 'method'],
  opiumHa: [
    'opium ha',
    'opium_ha',
    'opium poppy ha',
    'poppy ha',
    'cultivation ha',
    'opium cultivation hectares',
    'hectares',
  ],
  methIndex: [
    'meth index',
    'meth_index',
    'methamphetamine index',
    'synthetic index',
    'activity index',
    'meth activity',
  ],
}

// =============================================================================
// Internal helpers
// =============================================================================

/** Normalize a CSV header for matching: lowercase, split camelCase, collapse spaces. */
function normalizeHeader(header: unknown): string {
  return String(header ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[%_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Build a map from canonical field name -> column index. */
function buildHeaderMap(headers: string[], config: Record<string, string[]>): Record<string, number> {
  const map: Record<string, number> = Object.create(null)
  headers.forEach((rawHeader, index) => {
    const normalized = normalizeHeader(rawHeader)
    for (const [field, candidates] of Object.entries(config)) {
      if (candidates.some((candidate) => normalizeHeader(candidate) === normalized)) {
        map[field] = index
        break
      }
    }
  })
  return map
}

/** Tiny inline CSV parser: splits on commas, respecting double quotes. */
function parseCsv(csv: unknown): { headers: string[]; rows: string[][] } {
  const lines = String(csv ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) {
    return { headers: [], rows: [] }
  }

  const headers = splitLine(lines[0])
  const rows = lines.slice(1).map(splitLine)
  return { headers, rows }
}

/** Split one CSV line, handling quoted fields and escaped quotes (""). */
function splitLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"'
        i++ // skip the escaping quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current.trim())
  return fields
}

/** Retrieve a raw field value using the header map. */
function getField(row: string[], headerMap: Record<string, number>, field: string): string | undefined {
  const index = headerMap[field]
  if (index === undefined || index >= row.length) return undefined
  const value = row[index]
  return value === undefined || value === null ? undefined : value
}

/** Coerce a value to a string or return null. */
function coerceString(value: unknown): string | null {
  if (value === undefined || value === null) return null
  const trimmed = String(value).trim()
  return trimmed.length > 0 ? trimmed : null
}

/** Coerce a value to an integer or return null. */
function coerceInt(value: unknown): number | null {
  if (value === undefined || value === null) return null
  const trimmed = String(value).trim()
  if (trimmed === '' || trimmed === '-' || trimmed.toLowerCase() === 'n/a') return null
  const num = Number(trimmed)
  return Number.isFinite(num) ? Math.round(num) : null
}

/** Coerce a value to a number or return null. */
function coerceNumber(value: unknown): number | null {
  if (value === undefined || value === null) return null
  const trimmed = String(value).trim()
  if (trimmed === '' || trimmed === '-' || trimmed.toLowerCase() === 'n/a') return null
  const num = Number(trimmed)
  return Number.isFinite(num) ? num : null
}

/** Coerce an index value (e.g. methIndex): empty/- /n/a/% -> null, otherwise clamp to [0, 100]. */
function coerceIndex(value: unknown): number | null {
  if (value === undefined || value === null) return null
  const trimmed = String(value).trim()
  if (trimmed === '' || trimmed === '-' || trimmed.toLowerCase() === 'n/a') return null
  const num = Number(trimmed.replace('%', '').trim())
  if (!Number.isFinite(num)) return null
  return Math.max(0, Math.min(100, num))
}

/** Coerce purity: empty/- /n/a -> null, otherwise clamp to [0, 100]. */
function coercePurity(value: unknown): number | null {
  if (value === undefined || value === null) return null
  const trimmed = String(value).trim()
  if (trimmed === '' || trimmed === '-' || trimmed.toLowerCase() === 'n/a') return null
  const num = Number(trimmed.replace('%', '').trim())
  if (!Number.isFinite(num)) return null
  return Math.max(0, Math.min(100, num))
}

/** Normalize a drug id. */
function normalizeDrug(value: unknown): string | null {
  const raw = coerceString(value)
  if (!raw) return null
  return raw.toLowerCase()
}

/** Normalize a precursor id. */
function normalizePrecursor(value: unknown): string | null {
  const raw = coerceString(value)
  if (!raw) return null
  return raw.toLowerCase().replace(/\s+/g, '_')
}

/** Convert a human-readable name to a lowercase snake_case id slug. */
function toSnakeCaseSlug(value: unknown): string | null {
  const raw = coerceString(value)
  if (!raw) return null
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/** Normalize a Myanmar flow drug value to the canonical title-case name. */
function normalizeMyanmarDrug(value: unknown): string | null {
  const raw = coerceString(value)
  if (!raw) return null
  const normalized = raw.toLowerCase()
  if (
    normalized === 'methamphetamine' ||
    normalized === 'meth' ||
    normalized === 'yaba' ||
    normalized === 'ice'
  ) {
    return 'Methamphetamine'
  }
  if (normalized === 'heroin') {
    return 'Heroin'
  }
  return null
}

function normalizeActorType(value: unknown): MyanmarConflictActorType {
  const raw = toSnakeCaseSlug(value) ?? 'unknown'
  if (raw === 'ethnic_armed_organization' || raw === 'ethnic_armed_group') return 'eao'
  if (raw === 'resistance_group' || raw === 'pdf') return 'resistance'
  if (raw === 'state_actor' || raw === 'government') return 'state'
  return isMyanmarConflictActorType(raw) ? raw : 'unknown'
}

function normalizeEventType(value: unknown): MyanmarConflictEventType {
  const raw = toSnakeCaseSlug(value) ?? 'other'
  if (raw === 'territory' || raw === 'territorial' || raw === 'control') return 'territorial_control'
  if (raw === 'battle' || raw === 'armed_clash') return 'clash'
  return isMyanmarConflictEventType(raw) ? raw : 'other'
}

function normalizeConfidence(value: unknown): SourceConfidence {
  const raw = toSnakeCaseSlug(value) ?? 'reported'
  return isSourceConfidence(raw) ? raw : 'reported'
}

// =============================================================================
// Exported parsers
// =============================================================================

/**
 * Parse retail drug-price CSV.
 *
 * Required columns: drug, country, iso3, region, year, priceUsdPerGram.
 * purityPct is optional and may be null.
 */
export function parsePrices(csv: string): ParseResult<PriceRecord> {
  const records: PriceRecord[] = []
  const warnings: string[] = []
  const { headers, rows } = parseCsv(csv)
  const headerMap = buildHeaderMap(headers, CONFIG)

  const required = ['drug', 'country', 'iso3', 'region', 'year', 'priceUsdPerGram']
  const missing = required.filter((field) => !(field in headerMap))
  if (missing.length > 0) {
    warnings.push(
      `Unrecognized CSV layout: missing columns ${missing.join(', ')}. No records parsed.`
    )
    return { records, warnings }
  }

  rows.forEach((row, index) => {
    const lineNo = index + 2
    const drugRaw = normalizeDrug(getField(row, headerMap, 'drug'))
    const country = coerceString(getField(row, headerMap, 'country'))
    const iso3 = coerceString(getField(row, headerMap, 'iso3'))
    const region = coerceString(getField(row, headerMap, 'region'))
    const year = coerceInt(getField(row, headerMap, 'year'))
    const priceUsdPerGram = coerceNumber(getField(row, headerMap, 'priceUsdPerGram'))
    const purityPct = coercePurity(getField(row, headerMap, 'purityPct'))

    if (!drugRaw || !isDrug(drugRaw)) {
      warnings.push(`Row ${lineNo}: skipped due to unknown or missing drug`)
      return
    }

    if (country === null || iso3 === null || region === null || year === null || priceUsdPerGram === null) {
      warnings.push(`Row ${lineNo}: skipped due to missing required fields`)
      return
    }

    if (priceUsdPerGram < 0) {
      warnings.push(`Row ${lineNo}: skipped due to negative priceUsdPerGram`)
      return
    }

    records.push({ drug: drugRaw, country, iso3, region, year, priceUsdPerGram, purityPct })
  })

  return { records, warnings }
}

/**
 * Parse precursor-price CSV.
 *
 * Required columns: precursor, country, iso3, region, year, priceUsdPerKg.
 */
export function parsePrecursorPrices(csv: string): ParseResult<PrecursorPriceRecord> {
  const records: PrecursorPriceRecord[] = []
  const warnings: string[] = []
  const { headers, rows } = parseCsv(csv)
  const headerMap = buildHeaderMap(headers, CONFIG)

  const required = ['precursor', 'country', 'iso3', 'region', 'year', 'priceUsdPerKg']
  const missing = required.filter((field) => !(field in headerMap))
  if (missing.length > 0) {
    warnings.push(
      `Unrecognized CSV layout: missing columns ${missing.join(', ')}. No records parsed.`
    )
    return { records, warnings }
  }

  rows.forEach((row, index) => {
    const lineNo = index + 2
    const precursorRaw = normalizePrecursor(getField(row, headerMap, 'precursor'))
    const country = coerceString(getField(row, headerMap, 'country'))
    const iso3 = coerceString(getField(row, headerMap, 'iso3'))
    const region = coerceString(getField(row, headerMap, 'region'))
    const year = coerceInt(getField(row, headerMap, 'year'))
    const priceUsdPerKg = coerceNumber(getField(row, headerMap, 'priceUsdPerKg'))

    if (!precursorRaw || !isPrecursorId(precursorRaw)) {
      warnings.push(`Row ${lineNo}: skipped due to unknown or missing precursor`)
      return
    }

    if (country === null || iso3 === null || region === null || year === null || priceUsdPerKg === null) {
      warnings.push(`Row ${lineNo}: skipped due to missing required fields`)
      return
    }

    if (priceUsdPerKg < 0) {
      warnings.push(`Row ${lineNo}: skipped due to negative priceUsdPerKg`)
      return
    }

    records.push({ precursor: precursorRaw, country, iso3, region, year, priceUsdPerKg })
  })

  return { records, warnings }
}

/**
 * Parse precursor-flow CSV.
 *
 * Required columns: precursor, origin, destination, year, quantityKg.
 * transit is optional and may be null.
 */
export function parseFlows(csv: string): ParseResult<FlowRecord> {
  const records: FlowRecord[] = []
  const warnings: string[] = []
  const { headers, rows } = parseCsv(csv)
  const headerMap = buildHeaderMap(headers, CONFIG)

  const required = ['precursor', 'origin', 'destination', 'year', 'quantityKg']
  const missing = required.filter((field) => !(field in headerMap))
  if (missing.length > 0) {
    warnings.push(
      `Unrecognized CSV layout: missing columns ${missing.join(', ')}. No records parsed.`
    )
    return { records, warnings }
  }

  rows.forEach((row, index) => {
    const lineNo = index + 2
    const precursorRaw = normalizePrecursor(getField(row, headerMap, 'precursor'))
    const origin = coerceString(getField(row, headerMap, 'origin'))
    const transit = coerceString(getField(row, headerMap, 'transit'))
    const destination = coerceString(getField(row, headerMap, 'destination'))
    const year = coerceInt(getField(row, headerMap, 'year'))
    const quantityKg = coerceNumber(getField(row, headerMap, 'quantityKg'))

    if (!precursorRaw || !isPrecursorId(precursorRaw)) {
      warnings.push(`Row ${lineNo}: skipped due to unknown or missing precursor`)
      return
    }

    if (origin === null || destination === null || year === null || quantityKg === null) {
      warnings.push(`Row ${lineNo}: skipped due to missing required fields`)
      return
    }

    if (quantityKg < 0) {
      warnings.push(`Row ${lineNo}: skipped due to negative quantityKg`)
      return
    }

    records.push({ precursor: precursorRaw, origin, transit, destination, year, quantityKg })
  })

  return { records, warnings }
}

/**
 * Shared parser for Myanmar node layers (regions or border corridor towns).
 * Returns records with exactly the { id, label, lat, lng } schema.
 */
function parseMyanmarNodeLayer(csv: string, layerName: string): ParseResult<MmNode> {
  const records: MmNode[] = []
  const warnings: string[] = []
  const { headers, rows } = parseCsv(csv)
  const headerMap = buildHeaderMap(headers, CONFIG)

  const required = ['id', 'label', 'lat', 'lng']
  const missing = required.filter((field) => !(field in headerMap))
  if (missing.length > 0) {
    warnings.push(
      `Unrecognized ${layerName} CSV layout: missing columns ${missing.join(', ')}. No records parsed.`
    )
    return { records, warnings }
  }

  rows.forEach((row, index) => {
    const lineNo = index + 2
    const id = toSnakeCaseSlug(getField(row, headerMap, 'id'))
    const label = coerceString(getField(row, headerMap, 'label'))
    const lat = coerceNumber(getField(row, headerMap, 'lat'))
    const lng = coerceNumber(getField(row, headerMap, 'lng'))

    if (!id || !label || lat === null || lng === null) {
      warnings.push(`Row ${lineNo}: skipped due to missing required fields`)
      return
    }

    if (lat < -90 || lat > 90) {
      warnings.push(`Row ${lineNo}: skipped due to invalid lat ${lat}`)
      return
    }

    if (lng < -180 || lng > 180) {
      warnings.push(`Row ${lineNo}: skipped due to invalid lng ${lng}`)
      return
    }

    records.push({ id, label, lat, lng })
  })

  return { records, warnings }
}

/**
 * Parse Myanmar Golden Triangle region nodes.
 */
export function parseMyanmarRegions(csv: string): ParseResult<MmNode> {
  // Ethical grain guard: province/named-town grain only; extra source columns are dropped so output is not navigable.
  return parseMyanmarNodeLayer(csv, 'regions')
}

/**
 * Parse Myanmar cross-border corridor towns.
 */
export function parseMyanmarBorderNodes(csv: string): ParseResult<MmNode> {
  // Ethical grain guard: province/named-town grain only; extra source columns are dropped so output is not navigable.
  return parseMyanmarNodeLayer(csv, 'border nodes')
}

/**
 * Parse Myanmar region-level cultivation / synthetic-activity records.
 */
export function parseMyanmarRegionRecords(
  csv: string,
  knownIds?: Iterable<string>
): ParseResult<MmRegionRecord> {
  // Ethical grain guard: province/named-town grain only; extra source columns are dropped so output is not navigable.
  const records: MmRegionRecord[] = []
  const warnings: string[] = []
  const { headers, rows } = parseCsv(csv)
  const headerMap = buildHeaderMap(headers, CONFIG)
  const knownSet = knownIds ? new Set<string>(knownIds) : null

  const required = ['region', 'year', 'opiumHa', 'methIndex']
  const missing = required.filter((field) => !(field in headerMap))
  if (missing.length > 0) {
    warnings.push(
      `Unrecognized Myanmar region records CSV layout: missing columns ${missing.join(', ')}. No records parsed.`
    )
    return { records, warnings }
  }

  rows.forEach((row, index) => {
    const lineNo = index + 2
    const region = toSnakeCaseSlug(getField(row, headerMap, 'region'))
    const year = coerceInt(getField(row, headerMap, 'year'))
    const opiumHa = coerceNumber(getField(row, headerMap, 'opiumHa'))
    const methIndex = coerceIndex(getField(row, headerMap, 'methIndex'))

    if (!region || year === null || opiumHa === null || methIndex === null) {
      warnings.push(`Row ${lineNo}: skipped due to missing required fields`)
      return
    }

    if (opiumHa < 0) {
      warnings.push(`Row ${lineNo}: skipped due to negative opiumHa`)
      return
    }

    if (knownSet && !knownSet.has(region)) {
      warnings.push(`Row ${lineNo}: unknown region id ${region}`)
    }

    records.push({ region, year, opiumHa, methIndex })
  })

  return { records, warnings }
}

/**
 * Parse Myanmar inter-region / cross-border flow records.
 */
export function parseMyanmarFlows(
  csv: string,
  knownIds?: Iterable<string>
): ParseResult<MmFlowRecord> {
  // Ethical grain guard: province/named-town grain only; extra source columns are dropped so output is not navigable.
  const records: MmFlowRecord[] = []
  const warnings: string[] = []
  const { headers, rows } = parseCsv(csv)
  const headerMap = buildHeaderMap(headers, CONFIG)
  const knownSet = knownIds ? new Set<string>(knownIds) : null

  const required = ['from', 'to', 'year', 'quantityKg', 'drug']
  const missing = required.filter((field) => !(field in headerMap))
  if (missing.length > 0) {
    warnings.push(
      `Unrecognized Myanmar flows CSV layout: missing columns ${missing.join(', ')}. No records parsed.`
    )
    return { records, warnings }
  }

  rows.forEach((row, index) => {
    const lineNo = index + 2
    const from = toSnakeCaseSlug(getField(row, headerMap, 'from'))
    const to = toSnakeCaseSlug(getField(row, headerMap, 'to'))
    const year = coerceInt(getField(row, headerMap, 'year'))
    const quantityKg = coerceNumber(getField(row, headerMap, 'quantityKg'))
    const drugRaw = normalizeMyanmarDrug(getField(row, headerMap, 'drug'))

    if (!from || !to || year === null || quantityKg === null) {
      warnings.push(`Row ${lineNo}: skipped due to missing required fields`)
      return
    }

    if (!drugRaw || !isMyanmarDrug(drugRaw)) {
      warnings.push(`Row ${lineNo}: skipped due to unknown drug`)
      return
    }

    if (quantityKg < 0) {
      warnings.push(`Row ${lineNo}: skipped due to negative quantityKg`)
      return
    }

    if (knownSet) {
      if (!knownSet.has(from)) {
        warnings.push(`Row ${lineNo}: unknown from id ${from}`)
      }
      if (!knownSet.has(to)) {
        warnings.push(`Row ${lineNo}: unknown to id ${to}`)
      }
    }

    // sourceName/sourceUrl are optional here (unlike conflict events and
    // precursor flows) to stay backward-compatible with existing flow CSVs
    // that predate provenance tracking; populate them when the columns exist.
    const sourceName = coerceString(getField(row, headerMap, 'sourceName')) || undefined
    const sourceUrl = coerceString(getField(row, headerMap, 'sourceUrl')) || undefined

    records.push({ from, to, year, quantityKg, drug: drugRaw, ...(sourceName ? { sourceName } : {}), ...(sourceUrl ? { sourceUrl } : {}) })
  })

  return { records, warnings }
}

/**
 * Parse Myanmar civil-war / armed-actor event records at region-year grain.
 */
export function parseMyanmarConflictEvents(
  csv: string,
  knownIds?: Iterable<string>
): ParseResult<MmConflictEventRecord> {
  const records: MmConflictEventRecord[] = []
  const warnings: string[] = []
  const { headers, rows } = parseCsv(csv)
  const headerMap = buildHeaderMap(headers, CONFIG)
  const knownSet = knownIds ? new Set<string>(knownIds) : null

  const required = ['region', 'year', 'actor', 'eventType', 'intensity', 'sourceName', 'sourceUrl']
  const missing = required.filter((field) => !(field in headerMap))
  if (missing.length > 0) {
    warnings.push(
      `Unrecognized Myanmar conflict events CSV layout: missing columns ${missing.join(', ')}. No records parsed.`
    )
    return { records, warnings }
  }

  rows.forEach((row, index) => {
    const lineNo = index + 2
    const region = toSnakeCaseSlug(getField(row, headerMap, 'region'))
    const year = coerceInt(getField(row, headerMap, 'year'))
    const actor = coerceString(getField(row, headerMap, 'actor'))
    const actorType = normalizeActorType(getField(row, headerMap, 'actorType'))
    const eventType = normalizeEventType(getField(row, headerMap, 'eventType'))
    const intensity = coerceIndex(getField(row, headerMap, 'intensity'))
    const sourceName = coerceString(getField(row, headerMap, 'sourceName'))
    const sourceUrl = coerceString(getField(row, headerMap, 'sourceUrl'))

    if (!region || year === null || !actor || intensity === null || !sourceName || !sourceUrl) {
      warnings.push(`Row ${lineNo}: skipped due to missing required fields`)
      return
    }

    if (knownSet && !knownSet.has(region)) {
      warnings.push(`Row ${lineNo}: unknown region id ${region}`)
    }

    records.push({ region, year, actor, actorType, eventType, intensity, sourceName, sourceUrl })
  })

  return { records, warnings }
}

/**
 * Parse country-to-Myanmar precursor inflows at source-country / destination-region grain.
 */
export function parseMyanmarPrecursorFlows(
  csv: string,
  knownIds?: Iterable<string>
): ParseResult<MmPrecursorFlowRecord> {
  const records: MmPrecursorFlowRecord[] = []
  const warnings: string[] = []
  const { headers, rows } = parseCsv(csv)
  const headerMap = buildHeaderMap(headers, CONFIG)
  if (!('originCountry' in headerMap) && 'origin' in headerMap) {
    headerMap.originCountry = headerMap.origin
  }
  if (!('transitCountry' in headerMap) && 'transit' in headerMap) {
    headerMap.transitCountry = headerMap.transit
  }
  const knownSet = knownIds ? new Set<string>(knownIds) : null

  const required = ['originCountry', 'to', 'year', 'precursor', 'quantityKg', 'sourceName', 'sourceUrl']
  const missing = required.filter((field) => !(field in headerMap))
  if (missing.length > 0) {
    warnings.push(
      `Unrecognized Myanmar precursor flows CSV layout: missing columns ${missing.join(', ')}. No records parsed.`
    )
    return { records, warnings }
  }

  rows.forEach((row, index) => {
    const lineNo = index + 2
    const originCountry = coerceString(getField(row, headerMap, 'originCountry'))
    const transitCountry = coerceString(getField(row, headerMap, 'transitCountry'))
    const to = toSnakeCaseSlug(getField(row, headerMap, 'to'))
    const year = coerceInt(getField(row, headerMap, 'year'))
    const precursorRaw = normalizePrecursor(getField(row, headerMap, 'precursor'))
    const quantityKg = coerceNumber(getField(row, headerMap, 'quantityKg'))
    const sourceName = coerceString(getField(row, headerMap, 'sourceName'))
    const sourceUrl = coerceString(getField(row, headerMap, 'sourceUrl'))
    const confidence = normalizeConfidence(getField(row, headerMap, 'confidence'))

    if (
      !originCountry ||
      !to ||
      year === null ||
      !precursorRaw ||
      quantityKg === null ||
      !sourceName ||
      !sourceUrl
    ) {
      warnings.push(`Row ${lineNo}: skipped due to missing required fields`)
      return
    }

    if (!isPrecursorId(precursorRaw)) {
      warnings.push(`Row ${lineNo}: skipped due to unknown precursor`)
      return
    }

    if (quantityKg < 0) {
      warnings.push(`Row ${lineNo}: skipped due to negative quantityKg`)
      return
    }

    if (knownSet && !knownSet.has(to)) {
      warnings.push(`Row ${lineNo}: unknown to id ${to}`)
    }

    records.push({
      originCountry,
      transitCountry,
      to,
      year,
      precursor: precursorRaw,
      quantityKg,
      sourceName,
      sourceUrl,
      confidence,
    })
  })

  return { records, warnings }
}
