import { Billboard, Line, MapControls, Text } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { feature } from 'topojson-client'
import atlas from 'world-atlas/countries-110m.json'
import type { Poem, ScenePoint } from '../types'
import { activeSnapshot } from '../data/mapSnapshots'
import { geometryToShapes, lineToScenePoints, projectPoint } from '../lib/geo'

interface VerseSceneProps {
  poems: Poem[]
  selectedPoem: Poem
  onSelectPoem: (poem: Poem) => void
  onFocusChange: (point: ScenePoint) => void
}

interface AtlasFeature {
  id?: string | number
  geometry: {
    type: string
    coordinates: unknown
  } | null
}

const nearbyCountryIds = new Set([
  '004',
  '104',
  '116',
  '144',
  '156',
  '356',
  '392',
  '408',
  '410',
  '418',
  '496',
  '524',
  '586',
  '704',
])

function getCountryFeatures() {
  const topology = atlas as { objects: { countries: unknown } }
  const collection = feature(
    atlas as never,
    topology.objects.countries as never,
  ) as unknown as { features: AtlasFeature[] }

  return collection.features.filter((item) => {
    const id = String(item.id ?? '').padStart(3, '0')
    return nearbyCountryIds.has(id) && item.geometry
  })
}

function Parchment() {
  return (
    <group>
      <mesh position={[0, 0, -0.18]} receiveShadow>
        <planeGeometry args={[22, 15, 1, 1]} />
        <meshBasicMaterial color="#17231e" />
      </mesh>
      <mesh position={[0, 0, -0.2]}>
        <ringGeometry args={[7.1, 10.9, 96]} />
        <meshBasicMaterial color="#0c1512" transparent opacity={0.58} />
      </mesh>
      {[-5.5, -2.7, 2.5, 5.1].map((x) => (
        <Line
          key={x}
          points={[
            [x, -7.2, -0.16],
            [x + 0.35, 7.2, -0.16],
          ]}
          color="#9b8f6f"
          transparent
          opacity={0.035}
          lineWidth={0.5}
        />
      ))}
    </group>
  )
}

function GeographicBase() {
  const geometries = useMemo(() => {
    return getCountryFeatures().flatMap((country, countryIndex) =>
      country.geometry
        ? geometryToShapes(country.geometry).map((shape, shapeIndex) => ({
            id: `${countryIndex}-${shapeIndex}`,
            geometry: new THREE.ExtrudeGeometry(shape, {
              depth: 0.035,
              bevelEnabled: false,
              curveSegments: 1,
            }),
          }))
        : [],
    )
  }, [])

  useEffect(
    () => () => geometries.forEach(({ geometry }) => geometry.dispose()),
    [geometries],
  )

  return (
    <group position={[0, 0, -0.09]}>
      {geometries.map(({ id, geometry }) => (
        <mesh key={id} geometry={geometry} receiveShadow>
          <meshStandardMaterial
            color="#334039"
            roughness={0.92}
            metalness={0.04}
            transparent
            opacity={0.94}
          />
        </mesh>
      ))}
    </group>
  )
}

function PrototypeBoundary() {
  const geometries = useMemo(() => {
    if (!activeSnapshot.boundary) return []
    return activeSnapshot.boundary.flatMap((polygon, index) => {
      const shapes = geometryToShapes({ type: 'Polygon', coordinates: polygon })
      return shapes.map((shape, shapeIndex) => ({
        id: `${index}-${shapeIndex}`,
        geometry: new THREE.ExtrudeGeometry(shape, {
          depth: 0.13,
          bevelEnabled: true,
          bevelSize: 0.025,
          bevelThickness: 0.018,
          bevelSegments: 2,
          curveSegments: 1,
        }),
      }))
    })
  }, [])

  useEffect(
    () => () => geometries.forEach(({ geometry }) => geometry.dispose()),
    [geometries],
  )

  return (
    <group position={[0, 0, 0]}>
      {geometries.map(({ id, geometry }) => (
        <mesh key={id} geometry={geometry} castShadow receiveShadow>
          <meshStandardMaterial
            color="#776f50"
            emissive="#5c553c"
            emissiveIntensity={0.12}
            roughness={0.86}
            transparent
            opacity={0.7}
          />
        </mesh>
      ))}
    </group>
  )
}

const yellowRiver = [
  [96.1, 35.4],
  [101.4, 36.3],
  [106.1, 37.3],
  [110.2, 40.2],
  [111.1, 35.2],
  [114.1, 34.8],
  [118.2, 37.1],
]

const yangtzeRiver = [
  [91.8, 33.1],
  [99.1, 30.7],
  [104.1, 29.9],
  [108.6, 30.5],
  [114.3, 30.5],
  [118.8, 31.5],
  [121.4, 31.3],
]

function Rivers() {
  return (
    <group>
      <Line
        points={lineToScenePoints(yellowRiver)}
        color="#c1ad77"
        transparent
        opacity={0.6}
        lineWidth={1.25}
      />
      <Line
        points={lineToScenePoints(yangtzeRiver)}
        color="#73a5a1"
        transparent
        opacity={0.75}
        lineWidth={1.45}
      />
    </group>
  )
}

function PoemMarker({
  poem,
  selected,
  onSelect,
}: {
  poem: Poem
  selected: boolean
  onSelect: () => void
}) {
  const group = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  const { x, y } = projectPoint(poem.longitude, poem.latitude)

  useFrame((state) => {
    if (!group.current) return
    const pulse = Math.sin(state.clock.elapsedTime * 2.2 + x) * 0.045
    group.current.position.y = (selected ? 0.34 : 0.22) + pulse
  })

  return (
    <group ref={group} position={[x, 0.22, -y]}>
      <Line
        points={[
          [0, -0.12, 0],
          [0, selected ? 0.58 : 0.34, 0],
        ]}
        color={poem.accent}
        transparent
        opacity={selected ? 0.9 : 0.42}
        lineWidth={selected ? 1.5 : 0.8}
      />
      <mesh
        onClick={(event) => {
          event.stopPropagation()
          onSelect()
        }}
        onPointerOver={(event) => {
          event.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'default'
        }}
        scale={selected ? 1.35 : hovered ? 1.15 : 1}
      >
        <sphereGeometry args={[0.11, 20, 20]} />
        <meshStandardMaterial
          color={poem.accent}
          emissive={poem.accent}
          emissiveIntensity={selected ? 1.8 : hovered ? 1.25 : 0.72}
          roughness={0.38}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} scale={selected ? 1.45 : 1}>
        <ringGeometry args={[0.17, 0.185, 36]} />
        <meshBasicMaterial
          color={poem.accent}
          transparent
          opacity={selected ? 0.72 : 0.26}
          side={THREE.DoubleSide}
        />
      </mesh>
      {(selected || hovered) && (
        <Billboard position={[0, selected ? 0.92 : 0.62, 0]} follow>
          <Text
            fontSize={selected ? 0.29 : 0.23}
            color="#f3ead5"
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.018}
            outlineColor="#14201b"
            letterSpacing={0.08}
          >
            {poem.title}
          </Text>
          <Text
            position={[0, -0.08, 0]}
            fontSize={0.14}
            color="#b9ae94"
            anchorX="center"
            anchorY="top"
            outlineWidth={0.012}
            outlineColor="#14201b"
          >
            {poem.author} · {poem.placeName}
          </Text>
        </Billboard>
      )}
    </group>
  )
}

function FloatingVerse({ poem }: { poem: Poem }) {
  const group = useRef<THREE.Group>(null)
  const { x, y } = projectPoint(poem.longitude, poem.latitude)

  useFrame((state) => {
    if (!group.current) return
    group.current.position.y = 1.45 + Math.sin(state.clock.elapsedTime * 0.65) * 0.08
  })

  return (
    <group ref={group} position={[x, 1.45, -y]}>
      <Billboard follow>
        <Text
          maxWidth={5.4}
          fontSize={0.22}
          lineHeight={1.75}
          textAlign="center"
          anchorX="center"
          anchorY="bottom"
          color="#f5ead1"
          outlineWidth={0.016}
          outlineColor="#101814"
          fillOpacity={0.94}
        >
          {poem.lines.join('\n')}
        </Text>
      </Billboard>
    </group>
  )
}

function InkMotes() {
  const points = useRef<THREE.Points>(null)
  const positions = useMemo(() => {
    let seed = 742
    const random = () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }
    return Float32Array.from(
      Array.from({ length: 420 }, () => [
        (random() - 0.5) * 21,
        (random() - 0.5) * 14,
        0.15 + random() * 2.1,
      ]).flat(),
    )
  }, [])

  useFrame((state) => {
    if (!points.current) return
    points.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.08) * 0.015
  })

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#d8c89d"
        size={0.025}
        transparent
        opacity={0.22}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}

function FocusReporter({ onFocusChange }: { onFocusChange: (point: ScenePoint) => void }) {
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const center = useMemo(() => new THREE.Vector2(0, 0), [])
  const intersection = useMemo(() => new THREE.Vector3(), [])
  const lastUpdate = useRef(0)

  useFrame(({ camera, clock }) => {
    if (clock.elapsedTime - lastUpdate.current < 0.22) return
    lastUpdate.current = clock.elapsedTime
    raycaster.setFromCamera(center, camera)
    if (raycaster.ray.intersectPlane(plane, intersection)) {
      onFocusChange({ x: intersection.x, y: -intersection.z })
    }
  })

  return null
}

function World({
  poems,
  selectedPoem,
  onSelectPoem,
  onFocusChange,
}: VerseSceneProps) {
  return (
    <>
      <color attach="background" args={['#0e1713']} />
      <fog attach="fog" args={['#0e1713', 12, 26]} />
      <ambientLight intensity={1.15} color="#bfd0bc" />
      <directionalLight
        castShadow
        color="#f2d9a7"
        intensity={2.2}
        position={[-5, 11, -4]}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight color="#79a8a0" intensity={4.8} distance={17} position={[6, 4, 3]} />

      <group rotation={[-Math.PI / 2, 0, 0]}>
        <Parchment />
        <GeographicBase />
        <PrototypeBoundary />
        <Rivers />
        <InkMotes />
      </group>
      {poems.map((poem) => (
        <PoemMarker
          key={poem.id}
          poem={poem}
          selected={poem.id === selectedPoem.id}
          onSelect={() => onSelectPoem(poem)}
        />
      ))}
      <FloatingVerse poem={selectedPoem} />
      <FocusReporter onFocusChange={onFocusChange} />
      <MapControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={5.6}
        maxDistance={27}
        maxPolarAngle={Math.PI * 0.46}
        minPolarAngle={Math.PI * 0.12}
        target={[0, 0, 0]}
      />
    </>
  )
}

export function VerseScene(props: VerseSceneProps) {
  const compactViewport = window.matchMedia('(max-width: 680px)').matches

  return (
    <Canvas
      shadows
      dpr={[1, 1.7]}
      camera={{
        position: compactViewport ? [0, 13.5, 14.5] : [0, 11.5, 10.8],
        fov: compactViewport ? 48 : 43,
        near: 0.1,
        far: 80,
      }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.setClearColor(new THREE.Color('#0e1713'), 1)
      }}
      onPointerMissed={() => document.body.style.cursor = 'default'}
    >
      <World {...props} />
    </Canvas>
  )
}
