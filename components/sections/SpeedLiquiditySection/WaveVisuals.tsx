"use client";

import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function DynamicWaves() {
  const meshRef = useRef<THREE.Points>(null);

  // تنظیمات شبکه نقاط
  const { positions, step } = useMemo(() => {
    const width = 25;
    const height = 25;
    const depth = 2;
    const separation = 0.45;
    const numPoints = width * height * depth;
    const pos = new Float32Array(numPoints * 3);

    let i = 0;
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        for (let z = 0; z < depth; z++) {
          pos[i * 3] = (x - width / 2) * separation;
          pos[i * 3 + 1] = (y - height / 2) * separation;
          pos[i * 3 + 2] = (z - depth / 2) * separation;
          i++;
        }
      }
    }
    return { positions: pos, step: separation };
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    const positionAttribute = meshRef.current.geometry.getAttribute("position");

    for (let i = 0; i < positions.length / 3; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];

      // فرمول ریاضی موج خروشان
      const wave1 = Math.sin(x * 0.4 + time * 1.5) * 0.6;
      const wave2 = Math.sin(y * 0.3 + time * 2.0) * 0.5;
      const wave3 = Math.cos((x + y) * 0.2 + time * 1.0) * 0.3;

      const finalZ = wave1 + wave2 + wave3;
      positionAttribute.setZ(i, finalZ);
    }
    positionAttribute.needsUpdate = true;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        {/* رفع ارور تایپ‌اسکریپت با استفاده از args */}
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]} 
          count={positions.length / 3}
        />
      </bufferGeometry>
      {/* استفاده از متریال با رنگ‌های برند زرمان */}
      <pointsMaterial
        color="#06B6D4" /* Zarman Cyan for liquidity */
        size={0.06}
        sizeAttenuation={true}
        transparent
        opacity={0.7}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

export default function WaveVisuals() {
  return (
    <div className="w-full h-full min-h-[400px]">
      <Canvas camera={{ position: [0, 8, 12], fov: 50 }}>
        {/* پس‌زمینه تیره هماهنگ با Midnight Void */}
        <color attach="background" args={["#080B12"]} />
        <DynamicWaves />
        {/* نورپردازی نیلی (Ultraviolet) برای حس الکتریکی */}
        <pointLight position={[10, 10, 10]} intensity={1.5} color="#4F46E5" />
        <pointLight position={[-10, -10, -10]} intensity={0.8} color="#06B6D4" />
      </Canvas>
    </div>
  );
}