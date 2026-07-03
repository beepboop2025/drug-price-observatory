#!/usr/bin/env node
/**
 * Convert ACLED Myanmar conflict events into the app's mmConflictEvents CSV
 * schema (region, year, actor, actorType, eventType, intensity, sourceName,
 * sourceUrl) at the app's aggregate grain.
 *
 * ACLED access (free registration for research use, attribution required):
 *   https://acleddata.com — either export a CSV from the Export Tool, or use
 *   the API with your key.
 *
 * Usage:
 *   # from an Export Tool CSV (most reliable):
 *   node scripts/convert/acled-to-mm-conflict.mjs --csv path/to/acled-myanmar.csv
 *
 *   # from the legacy API (key + registered email):
 *   ACLED_KEY=xxx ACLED_EMAIL=you@example.com node scripts/convert/acled-to-mm-conflict.mjs --api
 *
 * Output: scripts/convert/output/mm-conflict-events.csv — load it via the
 * in-app "Load official data (CSV)" panel, or bundle it.
 *
 * GRAIN + ETHICS: ACLED is event-level; this converter aggregates to
 * (region, year, actor, event class) before anything is written, matching the
 * app's ethical grain guard. No dates, locations or event-level detail leave
 * this script.
 *
 * INTENSITY FORMULA (documented, deterministic):
 *   intensity = clamp( round( 14·ln(1+events) + 9·ln(1+fatalities) ), 5, 100 )
 *   Log-damped so mega-counts don't saturate the scale, floor of 5 so any
 *   recorded armed activity registers, capped at 100 by the schema.
 */

import fs from 'node:fs'
import path from 'node:path'

// ---- mappings (exported for tests) -----------------------------------------

/** ACLED admin1 -> app region id. ACLED splits Shan into three, matching the
 * app. The Wa Self-Administered Division is NOT an ACLED admin1 (its events
 * fall inside Shan-North/East), so `wa` keeps non-ACLED sourcing. */
export const ADMIN1_TO_REGION = {
  'Shan-North': 'shan_north',
  'Shan-East': 'shan_east',
  'Shan-South': 'shan_south',
  'Kachin': 'kachin',
  'Kayah': 'kayah',
}

/** ACLED event_type -> app event class. Protests/Riots are civil, not armed
 * conflict pressure, and are deliberately excluded. */
export const EVENT_TYPE_MAP = {
  'Battles': 'clash',
  'Violence against civilians': 'clash',
  'Explosions/Remote violence': 'airstrike',
  'Strategic developments': 'territorial_control',
}

/** Heuristic actor classification from the ACLED actor1 string. */
export function classifyActor(actor1) {
  const a = String(actor1 ?? '')
  if (/Military Forces of Myanmar|Tatmadaw/i.test(a)) return 'military'
  if (/Police|Government of Myanmar/i.test(a)) return 'state'
  if (/PDF|People's Defen[cs]e/i.test(a)) return 'resistance'
  if (/Militia/i.test(a)) return 'militia'
  if (/KIA|KIO|UWSA|TNLA|MNDAA|SSPP|SSA|RCSS|AA[: ]|Arakan Army|KNLA|KNU|KNPP|KA[: ]|PSLF|Kachin Independence|Wa State/i.test(a)) return 'eao'
  return 'unknown'
}

export function intensityOf(events, fatalities) {
  const raw = Math.round(14 * Math.log(1 + events) + 9 * Math.log(1 + fatalities))
  return Math.max(5, Math.min(100, raw))
}

/**
 * Aggregate ACLED event rows ({ year, admin1, actor1, event_type, fatalities })
 * into app-grain records. Returns { records, skipped } where skipped counts
 * rows outside the mapped regions/event classes.
 */
export function aggregate(rows) {
  const groups = new Map()
  let skipped = 0
  for (const r of rows) {
    const region = ADMIN1_TO_REGION[r.admin1]
    const eventType = EVENT_TYPE_MAP[r.event_type]
    const year = Number(r.year)
    if (!region || !eventType || !Number.isFinite(year)) { skipped++; continue }
    const actor = String(r.actor1 ?? '').trim() || 'Unattributed armed actor'
    const key = `${region}|${year}|${actor}|${eventType}`
    if (!groups.has(key)) groups.set(key, { events: 0, fatalities: 0 })
    const g = groups.get(key)
    g.events += 1
    g.fatalities += Number(r.fatalities) || 0
  }
  const records = [...groups.entries()].map(([key, g]) => {
    const [region, year, actor, eventType] = key.split('|')
    return {
      region,
      year: Number(year),
      actor,
      actorType: classifyActor(actor),
      eventType,
      intensity: intensityOf(g.events, g.fatalities),
      sourceName: 'ACLED',
      sourceUrl: 'https://acleddata.com',
    }
  })
  records.sort((a, b) => a.region.localeCompare(b.region) || a.year - b.year || b.intensity - a.intensity)
  return { records, skipped }
}

/** Minimal RFC-4180-ish CSV parser (quoted fields, embedded commas/quotes). */
export function parseCsv(text) {
  const rows = []
  let field = '', row = [], inQuotes = false
  const pushField = () => { row.push(field); field = '' }
  const pushRow = () => { if (row.length > 1 || row[0] !== '') rows.push(row); row = [] }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') inQuotes = false
      else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') pushField()
    else if (c === '\n') { pushField(); pushRow() }
    else if (c !== '\r') field += c
  }
  pushField(); pushRow()
  const [headers, ...data] = rows
  return data.map((r) => Object.fromEntries(headers.map((h, i) => [h.trim(), r[i] ?? ''])))
}

const toCsvField = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))

export function toOutputCsv(records) {
  const headers = ['region', 'year', 'actor', 'actorType', 'eventType', 'intensity', 'sourceName', 'sourceUrl']
  const lines = [headers.join(',')]
  for (const r of records) lines.push(headers.map((h) => toCsvField(r[h])).join(','))
  return lines.join('\r\n')
}

// ---- CLI ---------------------------------------------------------------------

const isMain = process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))
if (isMain) {
  const args = process.argv.slice(2)
  let rows
  if (args[0] === '--csv' && args[1]) {
    rows = parseCsv(fs.readFileSync(args[1], 'utf8'))
  } else if (args[0] === '--api') {
    const key = process.env.ACLED_KEY
    const email = process.env.ACLED_EMAIL
    if (!key || !email) { console.error('Set ACLED_KEY and ACLED_EMAIL (free registration at acleddata.com).'); process.exit(1) }
    const url = `https://api.acleddata.com/acled/read?key=${encodeURIComponent(key)}&email=${encodeURIComponent(email)}&country=Myanmar&fields=year|admin1|actor1|event_type|fatalities&limit=0`
    const res = await fetch(url)
    if (!res.ok) { console.error(`ACLED API error ${res.status} — if the legacy API is retired, use the Export Tool CSV with --csv.`); process.exit(1) }
    const payload = await res.json()
    rows = payload?.data ?? []
    if (!rows.length) { console.error('ACLED returned no rows — check key/email or use --csv.'); process.exit(1) }
  } else {
    console.error('Usage: acled-to-mm-conflict.mjs --csv <acled-export.csv> | --api')
    process.exit(1)
  }

  const { records, skipped } = aggregate(rows)
  const outDir = path.resolve('scripts/convert/output')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'mm-conflict-events.csv')
  fs.writeFileSync(outPath, toOutputCsv(records))
  const regions = new Set(records.map((r) => r.region))
  console.log(`events in: ${rows.length}, aggregate records out: ${records.length} (${[...regions].join(', ')}), rows outside mapped regions/classes: ${skipped}`)
  console.log(`wrote ${outPath} — load via the in-app CSV panel (mmConflictEvents slot).`)
  console.log('Attribution reminder: ACLED data requires "Data: ACLED" attribution wherever displayed.')
}
