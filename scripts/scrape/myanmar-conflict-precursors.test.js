import { describe, it, assert } from 'vitest'
import {
  buildAuditRecord,
  contentKey,
  extractItems,
  normalizeBody,
  observationsToCsv,
  robotsAllows,
  validateManifest,
} from './myanmar-conflict-precursors.mjs'

describe('myanmar conflict/precursor scraper helpers', () => {
  it('normalizes volatile page chrome before fingerprinting', () => {
    const a = normalizeBody('<main>Myanmar precursor report 123456</main>')
    const b = normalizeBody('<main>Myanmar   precursor report 999999</main>')

    assert.equal(a, b)
    assert.equal(contentKey(a), contentKey(b))
  })

  it('extracts repeated tag/class items like the Palimpsest item-set path', () => {
    const html = `
      <article class="card report">Shan conflict update</article>
      <article class="card report"><span>China precursor note</span></article>
      <article class="other">Ignore me</article>
    `

    assert.deepEqual(extractItems(html, { tag: 'article', class: 'report' }), [
      'Shan conflict update',
      'China precursor note',
    ])
  })

  it('escapes CSV fields with commas and quotes', () => {
    const csv = observationsToCsv([
      {
        sourceId: 's1',
        sourceName: 'Source, "quoted"',
        focus: 'conflict_events',
        url: 'https://example.org',
        observedAt: '2026-01-01T00:00:00.000Z',
        contentSha256: 'abc',
        itemSha256: '',
        keyword: 'Myanmar',
        excerpt: 'Myanmar, China',
      },
    ])

    assert.ok(csv.includes('"Source, ""quoted"""'))
    assert.ok(csv.includes('"Myanmar, China"'))
  })

  it('validates source manifests before any outbound fetch', () => {
    const sources = validateManifest({
      sources: [
        {
          id: 'unodc-test',
          name: 'UNODC Test',
          url: 'https://example.org/report',
          focus: 'precursor_flows',
          keywords: ['Myanmar'],
        },
      ],
    })

    assert.equal(sources.length, 1)
    assert.throws(
      () => validateManifest({ sources: [{ id: 'Bad ID', url: 'file:///tmp/x', keywords: [] }] }),
      /kebab-case/,
    )
  })

  it('honours robots.txt longest-match allow and disallow rules', () => {
    const robots = `
      User-agent: *
      Disallow: /private
      Allow: /private/public
    `

    assert.equal(robotsAllows(robots, '/private/report'), false)
    assert.equal(robotsAllows(robots, '/private/public/report'), true)
    assert.equal(robotsAllows(robots, '/public/report'), true)
  })

  it('builds hash-chained audit records for append-only provenance', () => {
    const first = buildAuditRecord({ event: 'source_start', sourceId: 's1' }, '')
    const second = buildAuditRecord({ event: 'source_success', sourceId: 's1' }, first.auditHash)

    assert.equal(second.previousHash, first.auditHash)
    assert.notEqual(first.auditHash, second.auditHash)
    assert.equal(first.auditHash, contentKey(JSON.stringify({
      auditAt: first.auditAt,
      event: 'source_start',
      previousHash: '',
      sourceId: 's1',
    })))
  })
})
