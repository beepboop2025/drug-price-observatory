import { Suspense, lazy, useEffect, useState } from 'react'
import { usePrefersReducedMotion } from '../motion/usePrefersReducedMotion'
import FlowFieldCanvas from './FlowFieldCanvas'

// The whole Three.js stack (~150KB) lives behind this lazy boundary, so it only
// downloads when a capable, large-enough screen actually renders the globe.
const GlobeScene = lazy(() => import('./GlobeScene'))

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')))
  } catch {
    return false
  }
}

/**
 * Chooses the hero background:
 *   reduced motion        → nothing (CSS radial glows carry the atmosphere)
 *   small screen / no GPU → 2D flow-field canvas
 *   otherwise             → lazy-loaded WebGL globe
 */
export default function HeroScene() {
  const reduced = usePrefersReducedMotion()
  const [mode, setMode] = useState<'none' | '2d' | '3d'>('none')

  useEffect(() => {
    if (reduced) {
      setMode('none')
      return
    }
    const decide = () => {
      const small = window.matchMedia('(max-width: 1024px)').matches
      setMode(small || !hasWebGL() ? '2d' : '3d')
    }
    decide()
    window.addEventListener('resize', decide)
    return () => window.removeEventListener('resize', decide)
  }, [reduced])

  if (mode === 'none') return null
  return (
    <div className="hero-scene" aria-hidden="true">
      {mode === '2d' ? (
        <FlowFieldCanvas />
      ) : (
        <Suspense fallback={null}>
          <GlobeScene />
        </Suspense>
      )}
    </div>
  )
}
