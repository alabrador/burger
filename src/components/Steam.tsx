"use client";

import { Billboard } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/** Humo/vapor suave que sube en hilos desde el pan de arriba. */

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragment = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform float uOpacity;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.07 + 13.1; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = vUv;
  float y = uv.y;
  float t = uTime * 0.16 + uSeed * 7.0;
  float d = 0.0;
  // Varios hilos de vapor, cada uno con su base, su ondulación y su ciclo de vida.
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float s = fract(sin((fi + 1.0) * 91.7 + uSeed * 37.0) * 4375.85);
    float base = 0.26 + 0.48 * s;
    // Ondula cada vez más al subir y se curva con el tiempo.
    float sway = (fbm(vec2(y * 2.4 - t * 1.6, fi * 3.1 + uSeed)) - 0.5) * (0.1 + y * 0.8);
    float curl = sin(y * (6.0 + s * 4.0) - t * 3.0 + fi * 2.0) * 0.035 * y;
    float c = base + sway + curl;
    float w = 0.014 + 0.06 * y + 0.05 * y * y;
    float core = exp(-pow((uv.x - c) / w, 2.0)) + 0.35 * exp(-pow((uv.x - c) / (w * 2.6), 2.0));
    // Se rompe en jirones que suben.
    float tear = smoothstep(0.28, 0.75, fbm(vec2(uv.x * 6.0 + fi * 5.0, y * 3.2 - t * 4.0)));
    // Cada hilo aparece y se apaga a su ritmo para que nunca se vea igual.
    float life = 0.5 + 0.5 * sin(uTime * (0.35 + s * 0.3) + fi * 1.7 + uSeed * 9.0);
    life = smoothstep(0.05, 0.6, life);
    d += core * mix(0.15, 1.0, tear) * life * (0.55 + 0.45 * s);
  }
  // Nace pegado al pan, más denso abajo, se disuelve arriba y por los lados.
  float fade = smoothstep(0.0, 0.12, y) * pow(1.0 - smoothstep(0.25, 1.0, y), 1.4);
  fade *= smoothstep(0.0, 0.18, uv.x) * (1.0 - smoothstep(0.82, 1.0, uv.x));
  d *= fade;
  d = 1.0 - exp(-d * 1.2);
  // Blanco cálido, un poco más claro donde es denso.
  vec3 col = mix(vec3(0.82, 0.78, 0.74), vec3(1.0, 0.98, 0.95), d);
  gl_FragColor = vec4(col, d * uOpacity);
}`;

function Plume({ seed, x, scale, opacity }: { seed: number; x: number; scale: number; opacity: number }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uOpacity: { value: opacity } },
        transparent: true,
        depthWrite: false,
      }),
    [seed, opacity],
  );
  useFrame((_, dt) => (mat.uniforms.uTime.value += dt));
  const w = 0.15 * scale;
  const h = 0.13 * scale;
  return (
    <mesh position={[x, h / 2, 0]} material={mat} renderOrder={10}>
      <planeGeometry args={[w, h]} />
    </mesh>
  );
}

export default function Steam({ y }: { y: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const g = ref.current;
    if (g) g.position.y += (y - g.position.y) * Math.min(1, dt * 4);
  });
  return (
    <group ref={ref} position-y={y}>
      <Billboard lockY>
        <Plume seed={0.13} x={0} scale={1} opacity={0.55} />
      </Billboard>
    </group>
  );
}
