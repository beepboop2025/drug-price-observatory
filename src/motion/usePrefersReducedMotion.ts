import { useEffect, useState } from 'react'

/**
 * Tracks the OS-level "reduce motion" accessibility setting.
 * Every animation in this app gates on this so the immersive layer never
 * fights a user who has explicitly asked for calm.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}
