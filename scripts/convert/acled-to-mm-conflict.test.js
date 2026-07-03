import { describe, it, assert } from 'vitest'
import {
  ADMIN1_TO_REGION,
  EVENT_TYPE_MAP,
  aggregate,
  classifyActor,
  intensityOf,
  parseCsv,
  toOutputCsv,
} from './acled-to-mm-conflict.mjs'

const row = (over = {}) => ({
  year: 2023, admin1: 'Shan-North', actor1: 'Military Forces of Myanmar (2021-)',
  event_type: 'Battles', fatalities: 3, ...over,
})

describe('acled-to-mm-conflict', () => {
  it('maps the five ACLED admin1 units onto app region ids', () => {
    assert.deepEqual(Object.values(ADMIN1_TO_REGION).sort(),
      ['kachin', 'kayah', 'shan_east', 'shan_north', 'shan_south'])
  })

  it('classifies well-known Myanmar actors', () => {
    assert.equal(classifyActor('Military Forces of Myanmar (2021-)'), 'military')
    assert.equal(classifyActor('KIA: Kachin Independence Army'), 'eao')
    assert.equal(classifyActor('UWSA: United Wa State Army'), 'eao')
    assert.equal(classifyActor("PDF: People's Defense Force"), 'resistance')
    assert.equal(classifyActor('Pyusawhti Militia'), 'militia')
    assert.equal(classifyActor('Unidentified Armed Group'), 'unknown')
  })

  it('aggregates events to (region, year, actor, event class) with a documented intensity', () => {
    const { records, skipped } = aggregate([
      row(), row(), row({ fatalities: 10 }),
      row({ admin1: 'Kachin', actor1: 'KIA: Kachin Independence Army', event_type: 'Explosions/Remote violence', fatalities: 0 }),
      row({ admin1: 'Sagaing' }),               // outside app regions
      row({ event_type: 'Protests' }),          // civil, excluded
    ])
    assert.equal(skipped, 2)
    assert.equal(records.length, 2)
    const shan = records.find((r) => r.region === 'shan_north')
    assert.equal(shan.actor, 'Military Forces of Myanmar (2021-)')
    assert.equal(shan.actorType, 'military')
    assert.equal(shan.eventType, 'clash')
    assert.equal(shan.intensity, intensityOf(3, 16))
    const kachin = records.find((r) => r.region === 'kachin')
    assert.equal(kachin.eventType, 'airstrike')
    assert.equal(kachin.actorType, 'eao')
  })

  it('intensity is clamped, floored and monotonic in events and fatalities', () => {
    assert.equal(intensityOf(0, 0), 5)
    assert.ok(intensityOf(10, 5) > intensityOf(2, 5))
    assert.ok(intensityOf(2, 50) > intensityOf(2, 5))
    assert.equal(intensityOf(10000, 10000), 100)
  })

  it('round-trips through the app CSV schema (parse -> aggregate -> csv headers)', () => {
    const csv = 'year,admin1,actor1,event_type,fatalities\n2023,Shan-East,"KIA: Kachin Independence Army",Battles,2\n'
    const rows = parseCsv(csv)
    assert.equal(rows[0].admin1, 'Shan-East')
    const out = toOutputCsv(aggregate(rows).records)
    assert.ok(out.startsWith('region,year,actor,actorType,eventType,intensity,sourceName,sourceUrl'))
    assert.ok(out.includes('shan_east,2023,KIA: Kachin Independence Army,eao,clash'))
  })

  it('handles quoted commas in ACLED actor names', () => {
    const rows = parseCsv('year,admin1,actor1,event_type,fatalities\n2022,Kayah,"KNPP, Karenni faction",Battles,1\n')
    assert.equal(rows[0].actor1, 'KNPP, Karenni faction')
  })

  it('excluded ACLED event types never leak into the output', () => {
    const civil = ['Protests', 'Riots']
    for (const t of civil) assert.ok(!(t in EVENT_TYPE_MAP))
  })
})
