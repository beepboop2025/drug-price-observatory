import { useEffect, useRef, useState } from 'react'
import { useSpring, animated } from '@react-spring/web'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

interface CountUpProps {
  value: number
  /** Decimal places to display. */
  decimals?: number
  prefix?: string
  suffix?: string
  /** Use locale grouping (1,234 / 12,000). */
  group?: boolean
  className?: string
}

const fmt = (n: number, decimals: number, group: boolean) =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: group,
  })

/**
 * Animates a number from 0 → value the first time it scrolls into view, then
 * re-springs whenever `value` changes (e.g. a year-slider scrub). Renders the
 * final value immediately under reduced motion. Keeps tabular-nums so the
 * digits don't jitter the layout while counting.
 */
export default function CountUp({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  group = true,
  className,
}: CountUpProps) {
  const reduced = usePrefersReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    if (reduced) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [reduced])

  const { n } = useSpring({
    n: reduced || inView ? value : 0,
    config: { tension: 90, friction: 26 },
  })

  if (reduced) {
    return (
      <span ref={ref} className={`count-up ${className ?? ''}`}>
        {prefix}{fmt(value, decimals, group)}{suffix}
      </span>
    )
  }

  return (
    <animated.span ref={ref} className={`count-up ${className ?? ''}`}>
      {n.to((x) => `${prefix}${fmt(x, decimals, group)}${suffix}`)}
    </animated.span>
  )
}
