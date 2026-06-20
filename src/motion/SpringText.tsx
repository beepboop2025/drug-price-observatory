import { useEffect, useRef, useState, type ElementType } from 'react'
import { useSprings, animated } from '@react-spring/web'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

interface SpringTextProps {
  text: string
  /** Words (case-insensitive) to paint with the coral→cyan brand gradient. */
  inkWords?: string[]
  /** 'mount' fires once on mount; 'inView' fires when scrolled into view. */
  trigger?: 'mount' | 'inView'
  /** Per-character delay in ms — lower = faster cascade. */
  stagger?: number
  as?: ElementType
  className?: string
}

const strip = (w: string) => w.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase()

/**
 * spring-text-engine, in miniature. Headings are split word→letter; each letter
 * starts at opacity 0, translated down, and springs into place on a physics
 * curve (NOT a CSS transition) as the block enters the viewport. Words stay
 * unbroken via inline-block wrappers so wrapping happens between words only.
 */
export default function SpringText({
  text,
  inkWords = [],
  trigger = 'inView',
  stagger = 24,
  as,
  className,
}: SpringTextProps) {
  const Tag = (as ?? 'span') as ElementType
  const reduced = usePrefersReducedMotion()
  const ref = useRef<HTMLElement>(null)
  const [started, setStarted] = useState(trigger === 'mount')

  const words = text.split(' ')
  const inkSet = new Set(inkWords.map(strip))
  // Flatten to a per-character list so a single useSprings drives the cascade.
  const chars: { ch: string; ink: boolean }[] = []
  words.forEach((word, wi) => {
    const ink = inkSet.has(strip(word))
    for (const ch of word) chars.push({ ch, ink })
    if (wi < words.length - 1) chars.push({ ch: ' ', ink: false })
  })

  useEffect(() => {
    if (reduced || trigger !== 'inView' || started) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true)
          io.disconnect()
        }
      },
      { threshold: 0.25 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [reduced, trigger, started])

  const springs = useSprings(
    chars.length,
    chars.map((_, i) => ({
      opacity: started ? 1 : 0,
      transform: started ? 'translateY(0%)' : 'translateY(70%)',
      delay: started ? i * stagger : 0,
      config: { tension: 300, friction: 26 },
    })),
  )

  // Reduced motion: skip the engine entirely, render plain readable text.
  if (reduced) {
    return (
      <Tag ref={ref} className={className}>
        {words.map((word, wi) => (
          <span key={wi}>
            <span className={inkSet.has(strip(word)) ? 'ink' : undefined}>{word}</span>
            {wi < words.length - 1 ? ' ' : ''}
          </span>
        ))}
      </Tag>
    )
  }

  // Rebuild the word grouping over the animated char spans.
  let cursor = 0
  return (
    <Tag ref={ref} className={`spring-text ${className ?? ''}`}>
      {words.map((word, wi) => {
        const span = (
          <span className={`line-word${inkSet.has(strip(word)) ? ' ink' : ''}`} key={wi}>
            {[...word].map((ch) => {
              const s = springs[cursor++]
              return (
                <animated.span key={cursor} style={s}>
                  {ch}
                </animated.span>
              )
            })}
          </span>
        )
        // consume the inter-word space spring so indices stay aligned
        if (wi < words.length - 1) cursor++
        return (
          <span key={`w${wi}`}>
            {span}
            {wi < words.length - 1 ? ' ' : ''}
          </span>
        )
      })}
    </Tag>
  )
}
