"use client";

import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function GlobeCore() {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.18;
    groupRef.current.rotation.x += delta * 0.07;
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <icosahedronGeometry args={[2.25, 2]} />
        <meshBasicMaterial
          color="#a855f7"
          wireframe
          transparent
          opacity={0.30}
        />
      </mesh>

      <points>
        <icosahedronGeometry args={[2.25, 1]} />
        <pointsMaterial
          color="#ffffff"
          size={0.035}
          sizeAttenuation
          transparent
          opacity={0.55}
        />
      </points>
    </group>
  );
}

export default function NetworkGlobe() {
  return (
   
      <Canvas
        style={{ width: "100%", height: "100%", display: "block" }}
        camera={{ position: [0, 0, 6], fov: 45 }}
        dpr={[1, 1.5]}
      >
        <GlobeCore />
      </Canvas>

  );
}
