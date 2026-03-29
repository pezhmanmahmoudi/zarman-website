"use client";
import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Icosahedron, Sparkles, Environment } from "@react-three/drei";
import * as THREE from "three";

function NetworkSphere() {
  const meshRef = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current && outerRef.current) {
      meshRef.current.rotation.y += 0.004;
      meshRef.current.rotation.x += 0.002;
      outerRef.current.rotation.y -= 0.002;
    }
  });

  return (
    <group>
      {/* Inner Core: A glowing wireframe sphere */}
      <Float speed={3} rotationIntensity={1} floatIntensity={2}>
        <Icosahedron ref={meshRef} args={[2, 2]}>
          <meshStandardMaterial 
            wireframe 
            color="#a855f7" 
            emissive="#9333ea" 
            emissiveIntensity={2} 
          />
        </Icosahedron>
      </Float>

      {/* Outer Shell: Larger, more subtle wireframe */}
      <Icosahedron ref={outerRef} args={[3.5, 1]}>
        <meshBasicMaterial 
          wireframe 
          color="#3b82f6" 
          transparent 
          opacity={0.2} 
        />
      </Icosahedron>

      {/* Connectivity "Nodes" / Data Points */}
      <Sparkles 
        count={60} 
        scale={6} 
        size={2} 
        speed={0.4} 
        color="#a855f7" 
      />
    </group>
  );
}

export default function NetworkVisuals() {
  return (
    <div className="w-full h-full min-h-[400px]">
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
        <color attach="background" args={["#05050a"]} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#9333ea" />
        <NetworkSphere />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}