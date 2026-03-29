"use client";
import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Icosahedron, Sparkles, Environment } from "@react-three/drei";
import * as THREE from "three";

function NetworkSphere() {
  const meshRef = useRef<THREE.Mesh>(null);
  const outerMeshRef = useRef<THREE.Mesh>(null);

  // Rotate the spheres slowly
  useFrame((state) => {
    if (meshRef.current && outerMeshRef.current) {
      meshRef.current.rotation.y -= 0.002;
      meshRef.current.rotation.x -= 0.001;
      // Outer sphere rotates opposite direction
      outerMeshRef.current.rotation.y += 0.001;
    }
  });

  // Shared material props for the wireframe look
  const materialProps = {
    wireframe: true,
    transparent: true,
    opacity: 0.3,
    color: new THREE.Color("#9333ea"), // Zarman purple
    side: THREE.DoubleSide,
  };

  return (
    <group>
      {/* Inner complex sphere */}
      <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
        <Icosahedron ref={meshRef} args={[2, 4]} scale={1}>
          <meshStandardMaterial {...materialProps} emissive="#9333ea" emissiveIntensity={0.5} />
        </Icosahedron>
      </Float>

      {/* Outer enclosing sphere */}
      <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
        <Icosahedron ref={outerMeshRef} args={[3, 1]} scale={1}>
          <meshBasicMaterial {...materialProps} color="#3b82f6" opacity={0.1} />
        </Icosahedron>
      </Float>
    </group>
  );
}

export default function NetworkVisuals() {
  return (
    <div className="w-full h-full min-h-[400px] relative">
        {/* A subtle gradient background behind the canvas */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent pointer-events-none" />
        
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
        <color attach="background" args={["#05050a"]} />
        <fog attach="fog" args={["#05050a", 5, 15]} />
        
        {/* Lights focus on the center to make the wireframe glow */}
        <ambientLight intensity={0.2} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#ffffff" />
        <pointLight position={[-10, -10, -10]} intensity={1} color="#9333ea" />

        <NetworkSphere />

        {/* Floating "data points" */}
        <Sparkles 
            count={200} 
            scale={10} 
            size={1.5} 
            speed={0.3} 
            color="#9333ea"
            opacity={0.5}
        />
        <Sparkles 
            count={100} 
            scale={15} 
            size={1} 
            speed={0.5} 
            color="#3b82f6"
        />
        
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}