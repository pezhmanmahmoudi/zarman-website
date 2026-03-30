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
      {/* Inner Core: Ultraviolet Glowing Sphere */}
      <Float speed={3} rotationIntensity={1} floatIntensity={2}>
        <Icosahedron ref={meshRef} args={[2, 2]}>
          <meshStandardMaterial 
            wireframe 
            color="#7C3AED" /* Zarman Ultraviolet */
            emissive="#4F46E5" /* Zarman Indigo */
            emissiveIntensity={1.5} 
          />
        </Icosahedron>
      </Float>

      {/* Outer Shell: Restrained Cyan Wireframe */}
      <Icosahedron ref={outerRef} args={[3.5, 1]}>
        <meshBasicMaterial 
          wireframe 
          color="#06B6D4" /* Zarman Cyan */
          transparent 
          opacity={0.15} 
        />
      </Icosahedron>

      {/* Connectivity "Nodes" */}
      <Sparkles 
        count={80} 
        scale={6} 
        size={2} 
        speed={0.4} 
        color="#7C3AED" 
      />
    </group>
  );
}

export default function CardsVisuals() {
  return (
    <div className="w-full h-full min-h-[400px]">
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
        {/* Background matches Zarman's Midnight Void */}
        <color attach="background" args={["#080B12"]} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#7C3AED" />
        <NetworkSphere />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}