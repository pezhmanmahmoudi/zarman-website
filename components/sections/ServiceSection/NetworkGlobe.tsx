"use client";

import React, { useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

// اضافه شدن متغیر isInView برای کنترل چرخش
function GlobeCore({ isInView }: { isInView: boolean }) {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame((_, delta) => {
    // 🛑 استراحت CPU: اگر کره در دید کاربر نیست، محاسبات ریاضی را متوقف کن
    if (!groupRef.current || !isInView) return; 
    
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
  const containerRef = useRef<HTMLDivElement>(null!);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    // 👁️ سنسور هوشمند برای تشخیص حضور کره در صفحه نمایش
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      // 100px زودتر از اینکه کره وارد کادر شود، موتور را روشن می‌کنیم تا لگ اولیه نداشته باشد
      { rootMargin: "100px" } 
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, []);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
      <Canvas
        // 🛑 استراحت GPU: اگر در دید نیست، رندر گرافیکی را روی demand (دستی) قرار بده تا فریم تولید نکند
        frameloop={isInView ? "always" : "demand"}
        style={{ width: "100%", height: "100%", display: "block" }}
        camera={{ position: [0, 0, 6], fov: 45 }}
        dpr={[1, 1.5]}
      >
        <GlobeCore isInView={isInView} />
      </Canvas>
    </div>
  );
}