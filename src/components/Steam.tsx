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
  // Una nube de vapor compacta: volumen suave que sube y se arremolina.
  vec2 p = vec2((uv.x - 0.5) * 2.6, y * 1.8 - t * 1.2);
  vec2 warp = vec2(fbm(p + vec2(0.0, uSeed)), fbm(p + vec2(5.2, 1.3 + uSeed))) - 0.5;
  float puff = fbm(p * 1.4 + warp * 1.6);
  puff = smoothstep(0.32, 0.8, puff);
  // Forma de columna ancha y redondeada que se abre un poco al subir.
  float sway = (fbm(vec2(y * 1.5 - t, uSeed)) - 0.5) * 0.12 * y;
  float wdt = 0.2 + 0.12 * y;
  float shape = exp(-pow((uv.x - 0.5 - sway) / wdt, 2.0));
  float d = puff * shape * 1.6;
  // Nace pegado al pan, más denso abajo, se disuelve arriba y por los lados.
  float fade = smoothstep(0.0, 0.12, y) * pow(1.0 - smoothstep(0.15, 0.9, y), 1.6);
  fade *= smoothstep(0.0, 0.18, uv.x) * (1.0 - smoothstep(0.82, 1.0, uv.x));
  d *= fade;
  d = 1.0 - exp(-d * 1.4);
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
  const w = 0.13 * scale;
  const h = 0.075 * scale;
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
