"use client";

import * as React from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

/** The six agents in 3D space. Orchestrator is the bright hub at the center. */
const NODES: { color: string; pos: [number, number, number]; size: number }[] = [
  { color: "#2dd4bf", pos: [0, 0.2, 0], size: 0.5 }, // orchestrator (teal hub)
  { color: "#3b82f6", pos: [-4.0, 1.7, -0.6], size: 0.28 }, // horizon
  { color: "#10b981", pos: [4.2, 1.3, 0.6], size: 0.28 }, // broker
  { color: "#f59e0b", pos: [-3.4, -2.0, 1.0], size: 0.28 }, // router
  { color: "#e879f9", pos: [3.6, -2.1, -0.7], size: 0.28 }, // tag
  { color: "#f87171", pos: [-0.4, 3.0, 1.2], size: 0.28 }, // sentry
];

// hub -> each specialist, plus a loose ring among specialists
const SPOKES: [number, number][] = [
  [0, 1], [0, 2], [0, 3], [0, 4], [0, 5],
];
const RING: [number, number][] = [
  [1, 2], [2, 4], [4, 3], [3, 1], [5, 1], [5, 2],
];

function v(i: number) {
  return new THREE.Vector3(...NODES[i].pos);
}

function Node({
  color,
  pos,
  size,
}: {
  color: string;
  pos: [number, number, number];
  size: number;
}) {
  return (
    <group position={pos}>
      {/* core */}
      <mesh>
        <sphereGeometry args={[size, 32, 32]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {/* soft halo */}
      <mesh>
        <sphereGeometry args={[size * 2.1, 24, 24]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.12}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function Pulse({ from, to, color, phase }: { from: number; to: number; color: string; phase: number }) {
  const ref = React.useRef<THREE.Mesh>(null);
  const a = React.useMemo(() => v(from), [from]);
  const b = React.useMemo(() => v(to), [to]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = (clock.elapsedTime * 0.35 + phase) % 1;
    ref.current.position.lerpVectors(a, b, t);
    const s = Math.sin(t * Math.PI); // fade in/out at ends
    (ref.current.material as THREE.MeshBasicMaterial).opacity = s * 0.9;
    ref.current.scale.setScalar(0.6 + s * 0.6);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.07, 16, 16]} />
      <meshBasicMaterial color={color} transparent toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

function AmbientField({ count = 420 }: { count?: number }) {
  const positions = React.useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 5 + Math.random() * 6;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(ph) * Math.cos(th);
      arr[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      arr[i * 3 + 2] = r * Math.cos(ph);
    }
    return arr;
  }, [count]);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.035} color="#5eead4" transparent opacity={0.5} sizeAttenuation depthWrite={false} />
    </points>
  );
}

function Scene({ animate }: { animate: boolean }) {
  return (
    <>
      {/* Drag to orbit: sideways = spin, up/down = tilt. Inertia via damping. */}
      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom={false}
        enableDamping
        dampingFactor={0.06}
        rotateSpeed={0.55}
        autoRotate={animate}
        autoRotateSpeed={0.6}
      />
      <group scale={0.66}>
        {NODES.map((n, i) => (
          <Node key={i} {...n} />
        ))}
      {SPOKES.map(([a, b], i) => (
        <Line key={`s${i}`} points={[NODES[a].pos, NODES[b].pos]} color="#2dd4bf" lineWidth={1} transparent opacity={0.35} toneMapped={false} />
      ))}
      {RING.map(([a, b], i) => (
        <Line key={`r${i}`} points={[NODES[a].pos, NODES[b].pos]} color="#334155" lineWidth={1} transparent opacity={0.4} />
      ))}
        {animate &&
          SPOKES.map(([a, b], i) => (
            <Pulse key={`p${i}`} from={a} to={b} color={NODES[b].color} phase={i / SPOKES.length} />
          ))}
        <AmbientField />
      </group>
    </>
  );
}

export default function AgentConstellation({
  animate = true,
  paused = false,
}: {
  animate?: boolean;
  paused?: boolean;
}) {
  // R3F can mount before the absolute container is measured (dynamic import +
  // inset-0), leaving the canvas at its 300x150 default. R3F listens for window
  // resize, so nudge it once its listeners are set up (rAF is too early).
  React.useEffect(() => {
    const fire = () => window.dispatchEvent(new Event("resize"));
    const t1 = setTimeout(fire, 80);
    const t2 = setTimeout(fire, 300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <Canvas
      dpr={[1, 1.6]}
      frameloop={paused ? "never" : "always"}
      camera={{ position: [0, 0, 9.4], fov: 50 }}
      gl={{ antialias: true, alpha: true }}
    >
      <Scene animate={animate} />
      <EffectComposer>
        <Bloom intensity={1.15} luminanceThreshold={0.2} luminanceSmoothing={0.6} mipmapBlur radius={0.7} />
      </EffectComposer>
    </Canvas>
  );
}
