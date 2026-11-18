"use client";

import { Billboard } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Cloud } from "@/lib/settle";

/**
 * Humo sedoso de foto publicitaria: cintas suaves y onduladas que salen del pan,
 * se curvan al subir y se desvanecen. El campo de ruido se deforma con el tiempo
 * (no se desplaza en bloque), así que el humo "fluye" en vez de deslizarse.
 */

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
// Ruido de valor con interpolación quíntica: curvas suaves, sin grano.
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.55;
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 1.9 + 3.7; a *= 0.45; }
  return v;
}

void main() {
  vec2 uv = vUv;
  float y = uv.y;
  float t = uTime * 0.12;
  vec2 p = vec2((uv.x - 0.5) * 3.4, y * 1.1 - t * 1.4) + uSeed * 9.0;
  // Doble deformación: da las curvas en "S" típicas del humo.
  vec2 q = vec2(fbm(p + vec2(0.0, t * 0.7)), fbm(p + vec2(5.2, 1.3 - t * 0.5)));
  vec2 r = vec2(fbm(p + 2.2 * q + vec2(1.7, 9.2)), fbm(p + 2.2 * q + vec2(8.3, 2.8) + t * 0.3));
  float f = fbm(p + 1.8 * r);
  // Cintas finas en las curvas de nivel del campo + un velo muy suave.
  float k = mix(26.0, 11.0, y); // se ensanchan y difuminan al subir
  float ribbons = exp(-pow((f - 0.48) * k, 2.0)) + 0.7 * exp(-pow((f - 0.62) * k * 1.2, 2.0));
  float veil = 0.06 * smoothstep(0.4, 0.7, f);
  float d = ribbons * (0.55 + 0.45 * r.x) + veil;
  // Nace del pan (columna del ancho del pan) y se disuelve arriba y a los lados.
  float wdt = 0.2 + 0.12 * y;
  d *= exp(-pow((uv.x - 0.5) / wdt, 2.0)) * smoothstep(0.0, 0.2, uv.x) * (1.0 - smoothstep(0.8, 1.0, uv.x));
  d *= smoothstep(0.02, 0.16, y) * pow(1.0 - smoothstep(0.3, 1.0, y), 1.3);
  vec3 col = mix(vec3(0.62, 0.62, 0.63), vec3(0.9, 0.9, 0.9), clamp(d, 0.0, 1.0));
  gl_FragColor = vec4(col, clamp(d, 0.0, 1.0) * uOpacity);
}`;

function Ribbon({ seed, x, z, w, h, opacity }: { seed: number; x: number; z: number; w: number; h: number; opacity: number }) {
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
  return (
    <mesh position={[x, h / 2, z]} material={mat} renderOrder={10}>
      <planeGeometry args={[w, h]} />
    </mesh>
  );
}

/** y = origen del pan de arriba; cloud = sus vértices, para saber dónde está la cima. */
export default function Steam({ y, cloud }: { y: number; cloud: Cloud }) {
  const ref = useRef<THREE.Group>(null);
  const crown = useMemo(() => {
    let m = 0;
    for (let i = 1; i < cloud.length; i += 3) m = Math.max(m, cloud[i]);
    return m;
  }, [cloud]);
  useFrame((_, dt) => {
    const g = ref.current;
    if (g) g.position.y += (y - g.position.y) * Math.min(1, dt * 6);
  });
  // La base de las cintas queda dentro de la cúpula: el pan tapa el arranque
  // y el humo parece salir de su superficie.
  const base = crown - 0.01;
  return (
    <group ref={ref} position-y={y}>
      <group position-y={base}>
        <Billboard lockY>
          <Ribbon seed={0.21} x={0} z={0} w={0.11} h={0.06} opacity={0.75} />
          <Ribbon seed={0.67} x={0.008} z={-0.012} w={0.095} h={0.05} opacity={0.45} />
        </Billboard>
      </group>
    </group>
  );
}
