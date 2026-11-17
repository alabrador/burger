"use client";

// Ingredientes que todavía no tienen modelo de Blender. Se dibujan con geometría
// sencilla (en centímetros, escalada a metros) hasta que llegue su GLB.

import { useMemo } from "react";
import * as THREE from "three";

function rng(seed: number) {
  let a = Math.floor(seed * 4294967296) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const col = (hex: string) => new THREE.Color(hex).convertSRGBToLinear();
const MAT = {
  onion: new THREE.MeshPhysicalMaterial({ color: col("#c995c4"), roughness: 0.35, transmission: 0.25, thickness: 0.3, clearcoat: 0.4 }),
  caramel: new THREE.MeshPhysicalMaterial({ color: col("#8a4a18"), roughness: 0.3, clearcoat: 0.8 }),
  pickleSide: new THREE.MeshStandardMaterial({ color: col("#4f6b1c"), roughness: 0.45 }),
  pickleCap: new THREE.MeshPhysicalMaterial({ color: col("#a3b456"), roughness: 0.3, clearcoat: 0.6 }),
  jalapeno: new THREE.MeshPhysicalMaterial({ color: col("#3f8a2a"), roughness: 0.3, clearcoat: 0.7 }),
};

export function Procedural({ kind, seed }: { kind: string; seed: number }) {
  const meshes = useMemo(() => {
    const r = rng(seed);
    const out: { geo: THREE.BufferGeometry; mat: THREE.Material | THREE.Material[]; pos: [number, number, number]; rot: [number, number, number] }[] = [];
    if (kind === "onion") {
      [[3.4, 0, 0], [2.6, 0.8, 0.4], [1.9, -1.2, 0.9], [2.9, -0.6, -1.1], [1.4, 1.5, -1.4]].forEach((p, i) => {
        const geo = new THREE.TorusGeometry(p[0], 0.15, 8, 64);
        geo.scale(1, 1, 0.55);
        geo.rotateX(Math.PI / 2);
        out.push({ geo, mat: MAT.onion, pos: [p[1], 0.12 + i * 0.02, p[2]], rot: [0, r() * 6, 0] });
      });
    } else if (kind === "caramel") {
      for (let i = 0; i < 34; i++) {
        const geo = new THREE.TorusGeometry(0.5 + r() * 0.9, 0.1, 6, 18, Math.PI * (0.5 + r() * 0.7));
        geo.scale(1, 1, 0.6);
        const a = r() * 7, d = Math.sqrt(r()) * 4.3;
        out.push({ geo, mat: MAT.caramel, pos: [Math.cos(a) * d, 0.15 + r() * 0.15, Math.sin(a) * d], rot: [Math.PI / 2 + (r() - 0.5) * 0.3, 0, r() * 6] });
      }
    } else if (kind === "pickles") {
      const geo = new THREE.CylinderGeometry(1.25, 1.25, 0.2, 32);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + r();
        out.push({ geo, mat: [MAT.pickleSide, MAT.pickleCap, MAT.pickleCap], pos: [Math.cos(a) * 3.1, 0.12, Math.sin(a) * 3.1], rot: [(r() - 0.5) * 0.15, r() * 6, (r() - 0.5) * 0.15] });
      }
    } else if (kind === "jalapeno") {
      const geo = new THREE.TorusGeometry(0.72, 0.22, 10, 28);
      geo.scale(1, 1, 0.55);
      geo.rotateX(Math.PI / 2);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + r(), d = 1.5 + r() * 2.6;
        out.push({ geo, mat: MAT.jalapeno, pos: [Math.cos(a) * d, 0.13, Math.sin(a) * d], rot: [0, 0, 0] });
      }
    }
    return out;
  }, [kind, seed]);

  return (
    <group scale={0.01}>
      {meshes.map((m, i) => (
        <mesh key={i} geometry={m.geo} material={m.mat} position={m.pos} rotation={m.rot} castShadow receiveShadow />
      ))}
    </group>
  );
}
