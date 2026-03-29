"use client";
import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { MeshTransmissionMaterial, Float, Octahedron, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

function Prism() {
  const meshRef = useRef<THREE.Mesh>(null);

  // Smooth, continuous rotation
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.005;
      meshRef.current.rotation.z += 0.002;
    }
  });

  return (
    <Float speed={2.5} rotationIntensity={1.2} floatIntensity={2}>
      <Octahedron ref={meshRef} args={[2, 0]}>
        <MeshTransmissionMaterial
          backside
          samples={8}
          thickness={1.0}
          chromaticAberration={0.06}
          anisotropy={0.3}
          distortion={0.2}
          distortionScale={0.5}
          temporalDistortion={0.1}
          clearcoat={1}
          color="#a855f7" // Zarman Brand Purple
          ior={1.2}
        />
      </Octahedron>
    </Float>
  );
}

export default function AboutVisuals() {
  return (
    <div className="w-full h-full min-h-[400px]">
      <Canvas camera={{ position: [0, 0, 7], fov: 40 }} dpr={[1, 2]}>
        <ambientLight intensity={0.7} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={2} />
        <pointLight position={[-10, -5, -10]} color="#3b82f6" intensity={1.5} />
        
        <Prism />
        
        {/* Environment provides the reflections that make it look like glass */}
        <Environment preset="city" />
        
        {/* Subtle shadow beneath the floating element */}
        <ContactShadows
          position={[0, -3.5, 0]}
          opacity={0.4}
          scale={10}
          blur={2.5}
          far={4}
          color="#000000"
        />
      </Canvas>
    </div>
  );
}