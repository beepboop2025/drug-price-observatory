import { useMemo, useState, type ChangeEvent } from 'react'
import { PRECURSORS } from '../data/flows'
import { useData } from '../lib/dataStore'
import { explainFlows } from '../lib/explain'
import Explainer from './Explainer'
import CountUp from '../motion/CountUp'

const fmtKg = (v: number): string => `${Number(v).toLocaleString()} kg`
const fmtUsd = (v: number): string => `$${Number(v).toLocaleString()}`

export default function Flows() {
  const { flowRecords, precursorPriceRecords } = useData()
  const [precursor, setPrecursor] = useState('all')

  const flows = useMemo(
    () => flowRecords.filter((r) => precursor === 'all' || r.precursor === precursor),
    [flowRecords, precursor],
  )
  const prices = useMemo(
    () => precursorPriceRecords.filter((r) => precursor === 'all' || r.precursor === precursor),
    [precursorPriceRecords, precursor],
  )

  // Headline figures for the stat band — recomputed (and re-animated) on filter.
  const totalSeized = useMemo(() => flows.reduce((s, r) => s + r.quantityKg, 0), [flows])
  const maxPrice = useMemo(
    () => prices.reduce((m, r) => Math.max(m, r.priceUsdPerKg), 0),
    [prices],
  )

  const labelFor = (id: string): string => PRECURSORS.find((p) => p.id === id)?.label ?? id

  return (
    <section>
      <div className="controls">
        <label>
          Precursor class&nbsp;
          <select value={precursor} onChange={(e: ChangeEvent<HTMLSelectElement>) => setPrecursor(e.target.value)}>
            <option value="all">All precursors</option>
            {PRECURSORS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
      </div>

      <div className="stat-band">
        <div className="stat">
          <span className="stat-value"><CountUp value={totalSeized} suffix=" kg" /></span>
          <span className="stat-label">Total seized across corridors</span>
        </div>
        <div className="stat">
          <span className="stat-value"><CountUp value={flows.length} group={false} /></span>
          <span className="stat-label">Tracked corridor records</span>
        </div>
        <div className="stat">
          <span className="stat-value"><CountUp value={maxPrice} prefix="$" suffix=" /kg" /></span>
          <span className="stat-label">Highest precursor price</span>
        </div>
      </div>

      <Explainer text={explainFlows(flows, precursor === 'all' ? 'all tracked precursors' : labelFor(precursor))} />

      <h3>Trafficking corridors — seized volumes (country-level, annual)</h3>
      <table className="data-table">
        <thead>
          <tr><th>Precursor</th><th>Origin</th><th>Transit</th><th>Destination</th><th>Year</th><th>Seized</th></tr>
        </thead>
        <tbody>
          {flows.map((r, i) => (
            <tr key={i}>
              <td>{labelFor(r.precursor)}</td>
              <td className={r.origin === 'China' ? 'hot' : ''}>{r.origin}</td>
              <td>{r.transit ?? '—'}</td>
              <td>{r.destination}</td>
              <td>{r.year}</td>
              <td>{fmtKg(r.quantityKg)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Precursor prices (USD per kg, country-level)</h3>
      <table className="data-table">
        <thead>
          <tr><th>Precursor</th><th>Country</th><th>Region</th><th>Year</th><th>Price / kg</th></tr>
        </thead>
        <tbody>
          {prices.map((r, i) => (
            <tr key={i}>
              <td>{labelFor(r.precursor)}</td>
              <td className={r.country === 'China' ? 'hot' : ''}>{r.country}</td>
              <td>{r.region}</td>
              <td>{r.year}</td>
              <td>{fmtUsd(r.priceUsdPerKg)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="note">
        Highlighted rows mark <strong>China</strong> as origin/source — the
        upstream supply hub this tool is built to keep visible. See the Flow Map
        tab for corridor arcs over a world map.
      </p>
    </section>
  )
}
