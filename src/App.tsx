import { useState, lazy, Suspense, type ReactNode } from 'react'
import { useSpring, animated } from '@react-spring/web'
import Explorer from './components/Explorer'
import Flows from './components/Flows'
import DataLoader from './components/DataLoader'
import { useData } from './lib/dataStore'
import { SOURCES } from './data/prices'
import { useSmoothScroll } from './motion/useSmoothScroll'
import { usePrefersReducedMotion } from './motion/usePrefersReducedMotion'
import SpringText from './motion/SpringText'
import Reveal from './motion/Reveal'
import HeroScene from './hero/HeroScene'

const WorldMap = lazy(() => import('./components/WorldMap'))
const MyanmarFocus = lazy(() => import('./components/MyanmarFocus'))
const IntelligenceBriefing = lazy(() => import('./components/IntelligenceBriefing'))

const TABS = [
  { id: 'prices', label: 'Street Prices' },
  { id: 'flows', label: 'Precursor Flows & Prices' },
  { id: 'map', label: 'Flow Map' },
  { id: 'myanmar', label: 'Myanmar Focus' },
  { id: 'intel', label: 'Enterprise Intel' },
] as const

/** Springs its contents in on mount — remounted per tab (key) for a crossfade. */
function TabPanel({ children }: { children: ReactNode }) {
  const reduced = usePrefersReducedMotion()
  const style = useSpring({
    from: { opacity: 0, transform: 'translateY(0.8rem)' },
    to: { opacity: 1, transform: 'translateY(0rem)' },
    config: { tension: 260, friction: 26 },
    immediate: reduced,
  })
  return <animated.div style={style}>{children}</animated.div>
}

export default function App() {
  const { isSample } = useData()
  const [tab, setTab] = useState<string>('prices')
  useSmoothScroll()

  return (
    <div className="app tk">
      <header className="app-header">
        <HeroScene />
        <div className="hero-inner">
          <div className="brand">
            <span className="brand-mark">🌍</span>
            <div className="titles">
              <SpringText
                as="h1"
                text="Global Drug Price Observatory"
                inkWords={['Observatory']}
                trigger="mount"
                stagger={26}
              />
              <p className="tagline">Making the world&rsquo;s drug-trade data legible.</p>
            </div>
            <span
              className={`data-badge tk-chip ${isSample ? 'tk-chip--warning' : 'tk-chip--ok'}`}
              title={isSample
                ? 'Official: street prices (WDR 2025 Annex 8.1), seizure globe (Annex 7.1), Myanmar opium cultivation (Opium Survey 2025). Derived: Myanmar conflict pressure (survey Figure 3, ACLED). Illustrative: precursor corridors and Myanmar flow volumes, pending INCB/IDS ingestion.'
                : 'All datasets replaced via the CSV loader — verify against the cited official sources.'}
            >
              {isSample ? 'Official: prices · seizures · opium' : 'Live data'}
            </span>
          </div>
          <Reveal delay={420}>
            <p className="lede">
              Street prices, precursor-chemical flows, and trafficking corridors — drawn
              from public UNODC&nbsp;/&nbsp;INCB data and translated into plain language.
              Aggregate statistics for awareness, education, and research only.
            </p>
          </Reveal>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main>
        <Suspense fallback={<div className="map-loading">Loading…</div>}>
          <TabPanel key={tab}>
            {tab === 'prices' && <Explorer />}
            {tab === 'flows' && <Flows />}
            {tab === 'map' && <WorldMap />}
            {tab === 'myanmar' && <MyanmarFocus />}
            {tab === 'intel' && <IntelligenceBriefing />}
          </TabPanel>
        </Suspense>
      </main>

      <Reveal>
        <footer className="app-footer tk-card tk-card--watch">
          <DataLoader />
          <p className="disclaimer tk-degraded">
            ⚠️ {isSample
              ? 'Official data: street prices (UNODC WDR 2025 Annex 8.1 + World Bank GDP), the seizure globe (Annex 7.1), and Myanmar opium cultivation (UNODC Myanmar Opium Survey 2025). Myanmar conflict pressure is derived from the survey’s published ACLED-based incident chart. Precursor corridors and Myanmar flow volumes remain illustrative pending INCB/UNODC-IDS ingestion. '
              : 'Showing loaded data — verify against the cited official sources. '}
            This tool reports aggregate, published statistics (country and, for focus
            regions, province level) for awareness and research. It does not provide
            point-of-sale, real-time, or navigable location information, and is not a
            guide to obtaining any substance.
          </p>
          <div className="sources tk-trust">
            <span className="tk-trust__item"><b>Sources</b></span>
            <span className="tk-trust__sep" />
            {SOURCES.map((s, i) => (
              <span key={s.url} className="tk-trust__item">
                <a href={s.url} target="_blank" rel="noreferrer">{s.name}</a>
                {i < SOURCES.length - 1 ? <span className="tk-trust__sep" /> : null}
              </span>
            ))}
          </div>
        </footer>
      </Reveal>
    </div>
  )
}
