// =============================================================================
// SHARED DOMAIN TYPES
// =============================================================================
// One source of truth for the shape of every record. These mirror exactly what
// ingest.js validates at runtime — so the parser's job is to turn untrusted CSV
// into values that satisfy these types, and everything downstream is type-safe.

/** Finished drugs tracked on the Street Prices tab. */
export type Drug = 'cocaine' | 'heroin' | 'cannabis' | 'methamphetamine'

/** Precursor-chemical classes (identified by end-drug + control status). */
export type PrecursorId =
  | 'fentanyl_precursors'
  | 'meth_precursors'
  | 'meth_pre_precursors'
  | 'heroin_precursors'
  | 'mdma_precursors'
  | 'cocaine_precursors'

/** Drugs that appear in Myanmar cross-border flow records (normalised form). */
export type MyanmarDrug = 'Methamphetamine' | 'Heroin'
export type MyanmarConflictActorType =
  | 'military'
  | 'eao'
  | 'militia'
  | 'resistance'
  | 'criminal'
  | 'state'
  | 'unknown'
export type MyanmarConflictEventType =
  | 'clash'
  | 'airstrike'
  | 'territorial_control'
  | 'ceasefire'
  | 'sanction'
  | 'seizure'
  | 'other'
export type SourceConfidence = 'official' | 'reported' | 'estimated'

export interface DrugMeta { id: Drug; label: string; unit: string }
export interface PrecursorMeta { id: PrecursorId; label: string; endDrug: string; incbScheduled: boolean }
export interface Source { name: string; url: string }
export interface Centroid { lat: number; lng: number }

export interface PriceRecord {
  drug: Drug
  country: string
  iso3: string
  region: string
  year: number
  priceUsdPerGram: number
  purityPct: number | null
}

export interface PrecursorPriceRecord {
  precursor: PrecursorId
  country: string
  iso3: string
  region: string
  year: number
  priceUsdPerKg: number
}

export interface FlowRecord {
  precursor: PrecursorId
  origin: string
  transit: string | null
  destination: string
  year: number
  quantityKg: number
  /** Attribution for the corridor figure (publisher of the seizure/incident report). */
  sourceName?: string
  sourceUrl?: string
}

/** A geographic node (Myanmar production region or border corridor town). */
export interface MmNode { id: string; label: string; lat: number; lng: number }

export interface MmRegionRecord {
  region: string
  year: number
  opiumHa: number
  /** Relative 0–100 synthetic-drug activity indicator (constructed, not a volume). */
  methIndex: number
}

export interface MmFlowRecord {
  from: string
  to: string
  year: number
  quantityKg: number
  drug: MyanmarDrug
  /**
   * Attribution for the outbound seizure figure. Optional (unlike conflict
   * events/precursor flows) to stay backward-compatible with pre-existing
   * flow CSVs that predate provenance tracking, but should be populated for
   * any newly ingested outbound-flow record so corridor-concentration and
   * cross-source disagreement checks can run on it.
   */
  sourceName?: string
  sourceUrl?: string
}

export interface MmConflictEventRecord {
  region: string
  year: number
  actor: string
  actorType: MyanmarConflictActorType
  eventType: MyanmarConflictEventType
  /** Relative 0-100 conflict-pressure indicator derived from public event reporting. */
  intensity: number
  sourceName: string
  sourceUrl: string
}

export interface MmPrecursorFlowRecord {
  originCountry: string
  transitCountry: string | null
  to: string
  year: number
  precursor: PrecursorId
  quantityKg: number
  sourceName: string
  sourceUrl: string
  confidence: SourceConfidence
}

// ---- ingest ----
/** Every parser returns validated records plus per-row warnings. */
export interface ParseResult<T> { records: T[]; warnings: string[] }

// ---- runtime data store ----
export interface DataState {
  isSample: boolean
  priceRecords: PriceRecord[]
  precursorPriceRecords: PrecursorPriceRecord[]
  flowRecords: FlowRecord[]
  mmRegions: MmNode[]
  mmBorderNodes: MmNode[]
  mmRegionRecords: MmRegionRecord[]
  mmFlowRecords: MmFlowRecord[]
  mmConflictEvents: MmConflictEventRecord[]
  mmPrecursorFlows: MmPrecursorFlowRecord[]
}

/** CSV strings keyed by dataset; any subset may be provided to loadData(). */
export interface LoadBundle {
  prices?: string
  precursorPrices?: string
  flows?: string
  mmRegions?: string
  mmBorderNodes?: string
  mmRegionRecords?: string
  mmFlows?: string
  mmConflictEvents?: string
  mmPrecursorFlows?: string
}

export interface LoadReport {
  ok: boolean
  loaded: Record<string, number>
  warnings: string[]
  errors: string[]
}
