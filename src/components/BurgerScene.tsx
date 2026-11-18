"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { stackOrder } from "@/lib/catalog";
import { DRACO, HEIGHT_OVERRIDE, MODELS, PROCEDURAL_HEIGHT, TRAY } from "@/lib/models";
import { useLive } from "@/lib/live";
import { useBurger } from "@/lib/store";

const MODEL_KEYS = Object.keys(MODELS);
const MODEL_URLS = MODEL_KEYS.map((k) => MODELS[k]);
const OVERLAP = 0.0004; // las capas se asientan un poco unas sobre otras
const EXPLODE_GAP = 0.018;
const TRAY_TOP = 0.008;

/** Semilla estable por capa para que cada ingrediente tenga su giro propio. */
function seeded(key: string) {
  let h = 2166136261;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

function prepare(scene: THREE.Object3D) {
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (mat?.map) mat.map.anisotropy = 8;
    if (mat) mat.envMapIntensity = 0.7;
  });
}

function stackHeight(scene: THREE.Object3D) {
  let h = 0;
  scene.traverse((o) => {
    const v = (o.userData as { stack_height?: number }).stack_height;
    if (typeof v === "number") h = Math.max(h, v);
  });
  return h || 0.02;
}

type LayerProps = { layerKey: string; index: number; target: number; children: React.ReactNode };

/** Cada capa cae desde arriba y se asienta con un muelle amortiguado. */
function Layer({ layerKey, index, target, children }: LayerProps) {
  const ref = useRef<THREE.Group>(null);
  const [startY] = useState(() => target + 0.14 + index * 0.004);
  const state = useRef({ y: startY, v: 0 });
  const rotation = useMemo(() => seeded(layerKey) * Math.PI * 2, [layerKey]);
  useFrame((_, dt) => {
    const s = state.current;
    const step = Math.min(dt, 1 / 30);
    const a = (target - s.y) * 120 - s.v * 14;
    s.v += a * step;
    s.y += s.v * step;
    if (ref.current) ref.current.position.y = s.y;
  });
  return (
    <group ref={ref} position-y={startY} rotation-y={rotation}>
      {children}
    </group>
  );
}

function Burger({ shift }: { shift: number }) {
  const { qty, protein, exploded, spinning, turn } = useBurger();
  const models = useLive((s) => s.models);
  const spin360 = useRef({ seen: turn, left: 0 });
  const gltfs = useGLTF(MODEL_URLS, DRACO);
  const assets = useMemo(() => {
    const out: Record<string, { scene: THREE.Object3D; h: number }> = {};
    MODEL_KEYS.forEach((k, i) => {
      const scene = gltfs[i].scene;
      prepare(scene);
      out[k] = { scene, h: HEIGHT_OVERRIDE[k] ?? stackHeight(scene) };
    });
    return out;
  }, [gltfs]);

  const layers = useMemo(() => {
    const keys = stackOrder(qty, protein, models);
    const bases = keys.map((k) => k.split("#")[0]);
    const steps = bases.map((b) => (assets[b]?.h ?? PROCEDURAL_HEIGHT[b] ?? 0.003) - OVERLAP + (exploded ? EXPLODE_GAP : 0));
    const ys = steps.reduce<number[]>((acc, _, i) => [...acc, i === 0 ? 0 : acc[i - 1] + steps[i - 1]], []);
    return keys.map((key, i) => ({ key, base: bases[i], y: ys[i], i }));
  }, [qty, protein, models, exploded, assets]);

  const top = layers.length ? layers[layers.length - 1].y + assets.bun_top.h : 0.08;
  const group = useRef<THREE.Group>(null);
  const drag = useRef({ active: false, x: 0, v: 0 });
  const camState = useRef({ y: 0.05, d: 0.5 });
  const { camera, gl, size } = useThree();

  // Arrastrar para girar la hamburguesa (sin mover la cámara).
  useEffect(() => {
    const el = gl.domElement;
    const down = (e: PointerEvent) => {
      drag.current.active = true;
      drag.current.x = e.clientX;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drag.current.active || !group.current) return;
      const dx = e.clientX - drag.current.x;
      drag.current.x = e.clientX;
      drag.current.v = dx * 0.01;
      group.current.rotation.y += dx * 0.01;
    };
    const up = () => (drag.current.active = false);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [gl]);

  useFrame((_, dt) => {
    const g = group.current;
    if (g && !drag.current.active) {
      drag.current.v *= Math.pow(0.04, dt);
      g.rotation.y += (spinning ? 0.22 * dt : 0) + drag.current.v * dt * 6;
      // Vuelta completa de 360° al pulsar el botón.
      const t = spin360.current;
      if (t.seen !== turn) {
        t.seen = turn;
        t.left = Math.PI * 2;
      }
      if (t.left > 0) {
        const step = Math.min(t.left, Math.max(0.6, t.left * 3.2) * dt);
        g.rotation.y += step;
        t.left -= step;
      }
    }
    // La cámara se aleja y sube según la altura de la pila.
    const narrow = Math.max(1, 0.95 / (size.width / size.height));
    const tD = Math.max(0.46, top * 2.4 + 0.18) * narrow;
    const tY = TRAY_TOP + top * 0.48;
    const c = camState.current;
    const k = Math.min(1, dt * 3);
    c.d += (tD - c.d) * k;
    c.y += (tY - c.y) * k;
    // shift desplaza la hamburguesa a la derecha para dejar sitio al título.
    const dx = -(shift || 0.02) * c.d;
    camera.position.set(dx, c.y + c.d * 0.28, c.d);
    camera.lookAt(dx, c.y, 0);
  });

  return (
    <group ref={group} rotation-y={-0.5}>
      <group position-y={TRAY_TOP}>
        {layers.map((l) => (
          <Layer key={l.key} layerKey={l.key} index={l.i} target={l.y}>
            {assets[l.base] && <primitive object={assets[l.base].scene.clone(true)} />}
          </Layer>
        ))}
      </group>
      <Tray />
    </group>
  );
}

function Tray() {
  const { scene } = useGLTF(TRAY, DRACO);
  useMemo(() => prepare(scene), [scene]);
  return <primitive object={scene} scale={[0.84, 1, 0.84]} />;
}

function Lights() {
  return (
    <>
      <hemisphereLight args={["#fff0dd", "#3b2a20", 0.35]} />
      <directionalLight
        position={[0.09, 0.2, 0.11]}
        intensity={1.7}
        color="#ffe2c0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadow-camera-left={-0.15}
        shadow-camera-right={0.15}
        shadow-camera-top={0.15}
        shadow-camera-bottom={-0.15}
        shadow-camera-near={0.01}
        shadow-camera-far={0.6}
      />
      <directionalLight position={[-0.12, 0.09, -0.14]} intensity={0.7} color="#cfe0ff" />
      {/* Estudio de luces suave para los reflejos (sin descargar HDRI). */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={2.2} color="#fff3e2" position={[0, 3, 2]} scale={[6, 3, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#ffe2bd" position={[-4, 1, -1]} scale={[3, 4, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#dfe8ff" position={[4, 1, -2]} scale={[3, 4, 1]} />
        <Lightformer form="ring" intensity={0.6} color="#ffffff" position={[0, 5, 0]} scale={2} />
      </Environment>
    </>
  );
}

function Loader() {
  return null;
}

export default function BurgerScene({ shift = 0 }: { shift?: number }) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: 30, near: 0.005, far: 3, position: [0, 0.2, 0.5] }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}
      style={{ touchAction: "pan-y", cursor: "grab", position: "absolute", inset: 0 }}
      aria-label="Vista 3D de la hamburguesa. Arrastra para girarla."
    >
      <Lights />
      <Suspense fallback={<Loader />}>
        <Burger shift={shift} />
      </Suspense>
      <ContactShadows position={[0, -0.0005, 0]} opacity={0.5} scale={0.5} blur={2.4} far={0.2} />
    </Canvas>
  );
}

useGLTF.preload(MODEL_URLS, DRACO);
useGLTF.preload(TRAY, DRACO);
