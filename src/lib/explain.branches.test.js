// Supplemental tests pinning under-covered branches of the legibility layer:
// the single-country price fallback, the latest-year scoping, and the China
// origin-share sentence in flow explanations.

import { describe, it, assert } from 'vitest'
import { explainPrices, explainFlows } from './explain'

describe('explainPrices — single-country fallback', () => {
  it('uses the "costs about" phrasing when only one country is in scope', () => {
    const rows = [
      { country: 'Colombia', iso3: 'COL', year: 2023, priceUsdPerGram: 45 },
    ]
    const s = explainPrices(rows, 'Cocaine')
    assert.ok(s.includes('costs about'))
    assert.ok(s.includes('Colombia'))
    assert.ok(s.includes('$45'))
    // The two-country "runs ... versus ..." phrasing must NOT appear.
    assert.equal(s.includes('versus'), false)
  })

  it('scopes to the latest year when multiple countries report that year', () => {
    const rows = [
      { country: 'OldLand', iso3: 'OLD', year: 2010, priceUsdPerGram: 999 },
      { country: 'CheapLand', iso3: 'AAA', year: 2023, priceUsdPerGram: 10 },
      { country: 'DearLand', iso3: 'BBB', year: 2023, priceUsdPerGram: 200 },
    ]
    const s = explainPrices(rows, 'Heroin')
    // 2010 outlier must be excluded; latest-year pair drives the sentence.
    assert.ok(s.includes('CheapLand'))
    assert.ok(s.includes('DearLand'))
    assert.equal(s.includes('OldLand'), false)
    assert.equal(s.includes('$999'), false)
  })

  it('falls back to all rows when the latest year has fewer than two points', () => {
    const rows = [
      { country: 'Alpha', iso3: 'AAA', year: 2010, priceUsdPerGram: 10 },
      { country: 'Beta', iso3: 'BBB', year: 2011, priceUsdPerGram: 200 },
    ]
    const s = explainPrices(rows, 'Cannabis')
    // Latest year (2011) has only one row, so scope widens back to both years.
    assert.ok(s.includes('Alpha'))
    assert.ok(s.includes('Beta'))
  })
})

describe('explainFlows — China origin share', () => {
  it('reports the rounded percentage of seized volume originating in China', () => {
    const flows = [
      { origin: 'China', destination: 'Mexico', transit: null, quantityKg: 750, drug: 'x' },
      { origin: 'India', destination: 'Mexico', transit: null, quantityKg: 250, drug: 'x' },
    ]
    const s = explainFlows(flows, 'the records shown')
    // 750 / 1000 = 75%.
    assert.ok(s.includes('China is the listed origin of 75%'))
    // Top corridor is the larger China shipment.
    assert.ok(s.includes('China → Mexico'))
  })

  it('omits the China sentence entirely when no flow originates in China', () => {
    const flows = [
      { origin: 'India', destination: 'Mexico', transit: 'UAE', quantityKg: 100, drug: 'x' },
    ]
    const s = explainFlows(flows, 'the records shown')
    assert.equal(s.includes('China is the listed origin'), false)
    // Transit annotation should render for the single corridor.
    assert.ok(s.includes('(via UAE)'))
  })
})
