"use client";
import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function WavePlane() {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Create a high-density plane for smooth wave movement
  const geometry = useMemo(() => new THREE.PlaneGeometry(15, 10, 60, 60), []);
  
  // Store initial positions to use as a baseline for the wave math
  const count = geometry.attributes.position.count;
  const initialPositions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = geometry.attributes.position.getX(i);
      pos[i * 3 + 1] = geometry.attributes.position.getY(i);
      pos[i * 3 + 2] = geometry.attributes.position.getZ(i);
    }
    return pos;
  }, [geometry, count]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    const positions = meshRef.current.geometry.attributes.position;
    
    for (let i = 0; i < count; i++) {
      const x = initialPositions[i * 3];
      const y = initialPositions[i * 3 + 1];
      
      // Multi-layered sine waves for organic "liquid" movement
      let z = Math.sin(x * 0.4 + t * 1.5) * 0.6; // Primary wave
      z += Math.cos(y * 0.3 + t * 1.2) * 0.4;    // Cross wave
      z += Math.sin((x + y) * 0.2 + t * 0.8) * 0.2; // Subtle noise

      positions.setZ(i, z);
    }
    positions.needsUpdate = true;
  });

  return (
    <group rotation={[-Math.PI / 2.5, 0, 0]} position={[0, -1, 0]}>
      <mesh ref={meshRef} geometry={geometry}>
        <meshBasicMaterial 
          wireframe 
          color="#9333ea" 
          transparent 
          opacity={0.4} 
          side={THREE.DoubleSide} 
        />
      </mesh>
    </group>
  );
}

export default function WaveVisuals() {
  return (
    <div className="w-full h-full min-h-[500px]">
      <Canvas camera={{ position: [0, 5, 10], fov: 45 }}>
        <color attach="background" args={["#05050a"]} />
        <fog attach="fog" args={["#05050a", 8, 20]} />
        <WavePlane />
      </Canvas>
    </div>
  );
}