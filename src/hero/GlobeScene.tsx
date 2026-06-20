import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { HERO_NODES, HERO_ARCS, COLOR_HOT, COLOR_COOL } from './heroData'

const R = 1 // globe radius in world units

/** Geographic lat/lng → a point on a sphere of radius `r`. */
function latLngToVec3(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  )
}

/** Fibonacci-sphere distribution: evenly scattered dots, no clustering at poles. */
function fibonacciSphere(count: number, r: number): Float32Array {
  const pts = new Float32Array(count * 3)
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2
    const radius = Math.sqrt(1 - y * y)
    const t = golden * i
    pts[i * 3] = Math.cos(t) * radius * r
    pts[i * 3 + 1] = y * r
    pts[i * 3 + 2] = Math.sin(t) * radius * r
  }
  return pts
}

function GlobeDots() {
  const positions = useMemo(() => fibonacciSphere(1600, R * 1.002), [])
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.013} color="#2b4c66" transparent opacity={0.85} sizeAttenuation />
    </points>
  )
}

function Nodes() {
  return (
    <>
      {HERO_NODES.map((n) => {
        const p = latLngToVec3(n.lat, n.lng, R * 1.012)
        const color = n.isSource ? COLOR_HOT : COLOR_COOL
        return (
          <mesh key={n.name} position={p}>
            <sphereGeometry args={[n.isSource ? 0.026 : 0.02, 12, 12]} />
            {/* basic (unlit) bright material → picked up strongly by Bloom */}
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
        )
      })}
    </>
  )
}

/** One corridor leg: a curve that bulges off the surface + a pulse riding it. */
function FlowArc({ arc, phase }: { arc: (typeof HERO_ARCS)[number]; phase: number }) {
  const color = arc.fromSource ? COLOR_HOT : COLOR_COOL
  const curve = useMemo(() => {
    const start = latLngToVec3(arc.from[0], arc.from[1], R * 1.012)
    const end = latLngToVec3(arc.to[0], arc.to[1], R * 1.012)
    // lift the control point off the sphere; farther hops arc higher
    const mid = start.clone().add(end).multiplyScalar(0.5)
    const lift = 1 + start.distanceTo(end) * 0.45
    mid.normalize().multiplyScalar(R * lift)
    return new THREE.QuadraticBezierCurve3(start, mid, end)
  }, [arc])

  const points = useMemo(() => curve.getPoints(48), [curve])
  const pulse = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!pulse.current) return
    const t = (state.clock.elapsedTime * 0.16 + phase) % 1
    pulse.current.position.copy(curve.getPoint(t))
  })

  return (
    <group>
      <Line points={points} color={color} lineWidth={1} transparent opacity={0.5} toneMapped={false} />
      <mesh ref={pulse}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  )
}

function World() {
  const spin = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (spin.current) spin.current.rotation.y += delta * 0.07
  })
  return (
    // outer group = fixed axial tilt; inner group = slow rotation
    <group rotation={[0.42, 0, 0]}>
      <group ref={spin}>
        {/* dark body so the far side occludes, giving a solid-globe read */}
        <mesh>
          <sphereGeometry args={[R * 0.99, 48, 48]} />
          <meshBasicMaterial color="#04070d" />
        </mesh>
        <GlobeDots />
        <Nodes />
        {HERO_ARCS.map((arc, i) => (
          <FlowArc key={i} arc={arc} phase={(i / HERO_ARCS.length)} />
        ))}
      </group>
    </group>
  )
}

export default function GlobeScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 3.2], fov: 42 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true }}
    >
      <fog attach="fog" args={['#000000', 3.2, 6.5]} />
      <ambientLight intensity={0.6} />
      <World />
      <EffectComposer>
        <Bloom intensity={1.1} luminanceThreshold={0.2} luminanceSmoothing={0.4} mipmapBlur />
      </EffectComposer>
    </Canvas>
  )
}
