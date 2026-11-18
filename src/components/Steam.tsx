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
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = vUv;
  float t = uTime * 0.22 + uSeed * 10.0;
  // El humo sube y se ondula más cuanto más alto está.
  vec2 q = vec2(uv.x * 2.2, uv.y * 1.6 - t);
  float warp = fbm(q + vec2(0.0, uSeed)) - 0.5;
  float x = uv.x + warp * (0.22 + uv.y * 0.7) + sin(uv.y * 5.0 - t * 2.0 + uSeed * 6.0) * 0.05 * uv.y;
  // Hilos finos y difusos.
  float strands = 0.0;
  strands += exp(-pow((x - 0.42) * 24.0, 2.0));
  strands += 0.7 * exp(-pow((x - 0.58) * 28.0, 2.0));
  strands += 0.35 * exp(-pow((x - 0.5) * 12.0, 2.0));
  float body = fbm(vec2(x * 4.0, uv.y * 3.0 - t * 1.4) + uSeed);
  float d = strands * smoothstep(0.3, 0.7, body);
  // Nace en la base, se desvanece arriba y por los lados.
  d *= smoothstep(0.0, 0.18, uv.y) * (1.0 - smoothstep(0.45, 1.0, uv.y));
  d *= smoothstep(0.0, 0.25, uv.x) * (1.0 - smoothstep(0.75, 1.0, uv.x));
  gl_FragColor = vec4(vec3(0.93, 0.92, 0.9), clamp(d, 0.0, 1.0) * uOpacity);
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
  const w = 0.14 * scale;
  const h = 0.12 * scale;
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
        <Plume seed={0.13} x={-0.02} scale={1} opacity={0.55} />
        <Plume seed={0.71} x={0.026} scale={0.85} opacity={0.4} />
        <Plume seed={0.42} x={0.0} scale={1.15} opacity={0.3} />
      </Billboard>
    </group>
  );
}
