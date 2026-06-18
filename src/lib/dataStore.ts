// =============================================================================
// RUNTIME DATA STORE
// =============================================================================
// Holds the datasets the UI renders. Starts on bundled sample data; loadData()
// runs the ingest parsers and swaps in real data, then notifies subscribers.
// External-mutable state + useSyncExternalStore = tear-free updates, no Context.

import { useSyncExternalStore } from 'react'
import { PRICE_RECORDS } from '../data/prices'
import { FLOW_RECORDS, PRECURSOR_PRICE_RECORDS } from '../data/flows'
import { MM_REGIONS, MM_BORDER_NODES, MM_REGION_RECORDS, MM_FLOW_RECORDS } from '../data/myanmar'
import * as ingest from './ingest'
import type { DataState, LoadBundle, LoadReport, MmNode } from '../types'

/** Dataset keys (everything in DataState except the isSample flag). */
type RecordKey = Exclude<keyof DataState, 'isSample'>

let state: DataState = {
  isSample: true,
  priceRecords: PRICE_RECORDS,
  precursorPriceRecords: PRECURSOR_PRICE_RECORDS,
  flowRecords: FLOW_RECORDS,
  mmRegions: MM_REGIONS,
  mmBorderNodes: MM_BORDER_NODES,
  mmRegionRecords: MM_REGION_RECORDS,
  mmFlowRecords: MM_FLOW_RECORDS,
}

const listeners = new Set<() => void>()
const subscribe = (l: () => void): (() => void) => {
  listeners.add(l)
  return () => { listeners.delete(l) }
}
const getSnapshot = (): DataState => state

/** React hook — returns the current datasets and re-renders on loadData(). */
export function useData(): DataState {
  return useSyncExternalStore(subscribe, getSnapshot)
}

// ingest.js is plain JS; type its parser surface loosely at the boundary.
type Parser = (csv: string, extra?: unknown) => unknown
const parsers = ingest as unknown as Record<string, Parser | undefined>

/**
 * Ingest real CSV exports and swap them in for the sample data.
 * Omitted bundle keys keep their current data. Nothing changes if a parser throws.
 */
export function loadData(bundle: LoadBundle = {}): LoadReport {
  const report: LoadReport = { ok: true, loaded: {}, warnings: [], errors: [] }
  const next: DataState = { ...state }

  const apply = (stateKey: RecordKey, parserName: string, csv?: string, extraArg?: unknown): void => {
    if (csv == null || csv === '') return
    const parser = parsers[parserName]
    if (typeof parser !== 'function') {
      report.errors.push(`ingest.js is missing export ${parserName}()`)
      return
    }
    try {
      const out = parser(csv, extraArg) as { records?: unknown[]; warnings?: string[] } | unknown[]
      const records = (Array.isArray(out) ? out : out?.records ?? []) as never[]
      const warnings = Array.isArray(out) ? [] : out?.warnings ?? []
      next[stateKey] = records
      report.loaded[stateKey] = records.length
      warnings.forEach((w) => report.warnings.push(`[${stateKey}] ${w}`))
    } catch (err) {
      report.errors.push(`[${stateKey}] ${(err as Error).message}`)
    }
  }

  apply('priceRecords', 'parsePrices', bundle.prices)
  apply('precursorPriceRecords', 'parsePrecursorPrices', bundle.precursorPrices)
  apply('flowRecords', 'parseFlows', bundle.flows)

  // Myanmar node tables FIRST — the records below reference their ids.
  apply('mmRegions', 'parseMyanmarRegions', bundle.mmRegions)
  apply('mmBorderNodes', 'parseMyanmarBorderNodes', bundle.mmBorderNodes)

  const knownIds = new Set<string>(
    [...(next.mmRegions as MmNode[]), ...(next.mmBorderNodes as MmNode[])].map((n) => n.id),
  )
  apply('mmRegionRecords', 'parseMyanmarRegionRecords', bundle.mmRegionRecords, knownIds)
  apply('mmFlowRecords', 'parseMyanmarFlows', bundle.mmFlows, knownIds)

  report.ok = report.errors.length === 0
  if (Object.keys(report.loaded).length > 0) {
    next.isSample = false
    state = next
    listeners.forEach((l) => l())
  }
  return report
}
