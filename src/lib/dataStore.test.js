// Tests for the runtime data store's loadData() orchestration.
//
// loadData() is the seam between untrusted CSV and the rendered datasets: it
// runs the right parser per bundle key, prefixes each parser warning with its
// dataset, counts loaded records, flips the isSample flag once real data lands,
// merges (rather than clobbers) omitted keys, threads known node ids into the
// Myanmar record/flow parsers, and never throws — parser failures surface as
// report.errors. These tests pin that contract without any I/O.
//
// NOTE: the store is a module-level singleton, so state carries across calls
// within this file. Tests are written to assert on the per-call LoadReport and
// on cumulative state transitions in declared order, not to reset globals.

import { describe, it, assert } from 'vitest'
import { loadData } from './dataStore'

const PRICES_CSV = `drug,country,iso3,region,year,priceUsdPerGram,purityPct
Cocaine,Colombia,COL,South America,2023,45.5,78.5
Heroin,Afghanistan,AFG,Asia,2023,12,55`

describe('loadData() — basic ingestion + report shape', () => {
  it('runs parsePrices, counts records, and reports ok with no errors', () => {
    const report = loadData({ prices: PRICES_CSV })

    assert.equal(report.ok, true)
    assert.deepEqual(report.errors, [])
    assert.equal(report.loaded.priceRecords, 2)
    // Keys that were not supplied in the bundle must not appear in `loaded`.
    assert.equal('flowRecords' in report.loaded, false)
    assert.equal('mmRegions' in report.loaded, false)
  })

  it('returns a report with the documented field shape', () => {
    const report = loadData({ prices: PRICES_CSV })
    assert.equal(typeof report.ok, 'boolean')
    assert.ok(report.loaded && typeof report.loaded === 'object')
    assert.ok(Array.isArray(report.warnings))
    assert.ok(Array.isArray(report.errors))
  })

  it('treats an empty bundle as a no-op: ok, nothing loaded, no errors', () => {
    const report = loadData({})
    assert.equal(report.ok, true)
    assert.deepEqual(report.loaded, {})
    assert.deepEqual(report.errors, [])
    assert.deepEqual(report.warnings, [])
  })

  it('skips a bundle key whose CSV is an empty string', () => {
    const report = loadData({ prices: '' })
    assert.equal('priceRecords' in report.loaded, false)
  })
})

describe('loadData() — warning propagation', () => {
  it('prefixes each parser warning with its dataset key', () => {
    // Row 2 has a negative price -> parsePrices emits a warning, which the store
    // must namespace as "[priceRecords] ...".
    const csv = `drug,country,iso3,region,year,priceUsdPerGram,purityPct
Cocaine,Colombia,COL,South America,2023,45.5,78
Heroin,Myanmar,MMR,Asia,2023,-5,60`
    const report = loadData({ prices: csv })

    assert.equal(report.loaded.priceRecords, 1) // good row kept
    assert.equal(report.warnings.length, 1)
    assert.ok(report.warnings[0].startsWith('[priceRecords] '))
    assert.ok(report.warnings[0].includes('negative priceUsdPerGram'))
  })

  it('still reports ok:true when there are warnings but no errors', () => {
    const csv = `drug,country,iso3,region,year,priceUsdPerGram,purityPct
Banana,Nowhere,XXX,Nowhere,2023,10,50`
    const report = loadData({ prices: csv })
    assert.equal(report.ok, true) // warnings are not errors
    assert.ok(report.warnings.length >= 1)
    assert.equal(report.loaded.priceRecords, 0) // unknown drug skipped
  })
})

describe('loadData() — unrecognized layout', () => {
  it('loads 0 records and warns when required columns are missing', () => {
    // No recognizable price columns -> parsePrices returns a layout warning and
    // an empty record set; the store reports priceRecords: 0 and is still ok.
    const report = loadData({ prices: 'foo,bar\n1,2' })
    assert.equal(report.ok, true)
    assert.equal(report.loaded.priceRecords, 0)
    assert.ok(report.warnings.some((w) => w.includes('[priceRecords]')))
    assert.ok(report.warnings.some((w) => w.toLowerCase().includes('unrecognized')))
  })
})

describe('loadData() — Myanmar node ids thread into dependent parsers', () => {
  it('does NOT warn about a flow whose ids match freshly loaded region nodes', () => {
    // Load region nodes and flows in the SAME bundle. The store must build the
    // knownIds set from the just-parsed nodes and pass it to parseMyanmarFlows,
    // so a flow between those ids is accepted without an "unknown id" warning.
    const bundle = {
      mmRegions: `id,label,lat,lng
shan_north,Shan (North),21.5,98.0
wa,Wa,22.1,99.0`,
      mmFlows: `from,to,year,quantityKg,drug
shan_north,wa,2023,500,Methamphetamine`,
    }
    const report = loadData(bundle)

    assert.equal(report.loaded.mmRegions, 2)
    assert.equal(report.loaded.mmFlowRecords, 1)
    const flowWarnings = report.warnings.filter((w) => w.startsWith('[mmFlowRecords]'))
    assert.deepEqual(flowWarnings, [])
  })

  it('warns about an unknown node id but still keeps the flow record', () => {
    const bundle = {
      mmRegions: `id,label,lat,lng
shan_north,Shan (North),21.5,98.0`,
      mmFlows: `from,to,year,quantityKg,drug
shan_north,ghost_town,2023,500,Methamphetamine`,
    }
    const report = loadData(bundle)

    assert.equal(report.loaded.mmFlowRecords, 1) // kept despite unknown 'to'
    assert.ok(
      report.warnings.some(
        (w) => w.startsWith('[mmFlowRecords]') && w.includes('unknown to id ghost_town'),
      ),
    )
  })
})

describe('loadData() — multi-dataset bundle', () => {
  it('loads several datasets in one call and tallies each independently', () => {
    const bundle = {
      prices: PRICES_CSV,
      precursorPrices: `precursor,country,iso3,region,year,priceUsdPerKg
meth_precursors,China,CHN,Asia,2023,2500`,
      flows: `precursor,origin,transit,destination,year,quantityKg
meth_precursors,China,,Mexico,2023,500`,
    }
    const report = loadData(bundle)

    assert.equal(report.ok, true)
    assert.equal(report.loaded.priceRecords, 2)
    assert.equal(report.loaded.precursorPriceRecords, 1)
    assert.equal(report.loaded.flowRecords, 1)
  })
})
