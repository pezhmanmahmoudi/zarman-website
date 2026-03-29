"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import styles from "./GlobeCanvas.module.css";

const CITIES = [
  { name: "Sydney", lat: -33.8688, lng: 151.2093 },
  { name: "Tehran", lat: 35.6892, lng: 51.3890 },
  { name: "Dubai", lat: 25.2048, lng: 55.2708 },
  { name: "London", lat: 51.5074, lng: -0.1278 },
  { name: "Ottawa", lat: 45.4215, lng: -75.6972 },
  { name: "Washington D.C.", lat: 38.9072, lng: -77.0369 }
];

function latLngToVec3(lat: number, lng: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

async function buildLandmaskDots(imageUrl: string, radius: number): Promise<Float32Array> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = imageUrl;

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load landmask image`));
  });

  const W = 720;
  const H = 360;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context error");

  ctx.drawImage(img, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);
  const positions: number[] = [];
  const step = 2; 
  const threshold = 30;

  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      const i = (y * W + x) * 4;
      if (data[i + 3] < 10) continue;
      const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (lum < threshold) continue;
      const lng = (x / W) * 360 - 180;
      const lat = 90 - (y / H) * 180;
      const v = latLngToVec3(lat, lng, radius);
      positions.push(v.x, v.y, v.z);
    }
  }
  return new Float32Array(positions);
}

export default function GlobeCanvas() {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = wrapRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let scene: THREE.Scene | null = null;
    let camera: THREE.PerspectiveCamera | null = null;
    let controls: OrbitControls | null = null;
    let pulseMeshes: THREE.Mesh[] = [];
    let raf = 0;

    const resize = () => {
      if (!renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };

    const init = async () => {
      // Initialize with Alpha for Transparency
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      
      // ✅ STABILITY FIX: Prevent unexpected rendering order
      renderer.sortObjects = false; 
      
      container.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      scene.background = null; // ✅ Background is now transparent

      camera = new THREE.PerspectiveCamera(45, 1, 1, 4000);
      camera.position.set(0, 0, 500); 

      scene.add(new THREE.AmbientLight(0xffffff, 0.4));
      const dir = new THREE.DirectionalLight(0x50c8ff, 0.8);
      dir.position.set(-3, 2, 5);
      scene.add(dir);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05; 
      controls.enableZoom = false; 
      controls.enablePan = false;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.8; // Constant, smooth rotation
      controls.minDistance = 500;
      controls.maxDistance = 500;

      // ✅ INTERACTION FIX: Enable page scroll on Mobile/Tablet
      const isTouchDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 1024;
      if (isTouchDevice) {
        controls.enabled = false;
        container.style.touchAction = "pan-y"; // Allows vertical page scroll over the globe
      } else {
        container.style.touchAction = "none";
      }

      const R = 160;

      const sphereMat = new THREE.MeshPhongMaterial({
        color: 0x050a1a, 
        transparent: true,
        opacity: 0.9,
        depthWrite: false, 
      });
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 64), sphereMat);
      sphere.renderOrder = 0;
      scene.add(sphere);

      const dotPositions = await buildLandmaskDots("/Earth/earth-landmask.png", R + 0.8);
      const dotsGeo = new THREE.BufferGeometry();
      dotsGeo.setAttribute("position", new THREE.BufferAttribute(dotPositions, 3));
      
      const dotsMat = new THREE.PointsMaterial({
        color: 0x4fc3f7, 
        size: 1.7,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        // ✅ STABILITY FIX: Prevent dots from disappearing at edges
        depthTest: false, 
      });

      const dots = new THREE.Points(dotsGeo, dotsMat);
      dots.renderOrder = 1;
      dots.frustumCulled = false; // ✅ STABILITY FIX: Always render dots
      scene.add(dots);

      const cityGroup = new THREE.Group();
      cityGroup.renderOrder = 2;
      scene.add(cityGroup);

      CITIES.forEach(city => {
        const pos = latLngToVec3(city.lat, city.lng, R + 1.2);
        const cityDot = new THREE.Mesh(
          new THREE.SphereGeometry(2, 16, 16),
          new THREE.MeshBasicMaterial({ color: 0xffaa00 })
        );
        cityDot.position.copy(pos);
        cityGroup.add(cityDot);

        const ringGeo = new THREE.RingGeometry(1.5, 6, 32);
        const ringMat = new THREE.MeshBasicMaterial({ 
          color: 0xffaa00, 
          transparent: true, 
          side: THREE.DoubleSide,
          depthTest: false 
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(pos);
        ring.lookAt(new THREE.Vector3(0,0,0));
        cityGroup.add(ring);
        pulseMeshes.push(ring);
      });

      // Initial Rotation
      sphere.rotation.y = -Math.PI * (5 / 9);
      dots.rotation.y = sphere.rotation.y;
      cityGroup.rotation.y = sphere.rotation.y;

      resize();

      const tick = () => {
        if (!renderer || !scene || !camera || !controls) return;

        // Mouse-sensitive parallax removed for a more professional, stable turning motion
        controls.update();

        pulseMeshes.forEach(mesh => {
          mesh.scale.addScalar(0.018);
          (mesh.material as THREE.MeshBasicMaterial).opacity -= 0.014;
          if ((mesh.material as THREE.MeshBasicMaterial).opacity <= 0) {
            mesh.scale.set(1, 1, 1);
            (mesh.material as THREE.MeshBasicMaterial).opacity = 1;
          }
        });

        // Keep all elements synchronized
        dots.rotation.y = sphere.rotation.y;
        cityGroup.rotation.y = sphere.rotation.y;

        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };

      raf = requestAnimationFrame(tick);
      window.addEventListener("resize", resize);
    };

    init().catch(console.error);

    return () => {
      window.removeEventListener("resize", resize);
      if (raf) cancelAnimationFrame(raf);
      if (controls) controls.dispose();
      if (renderer) {
        renderer.dispose();
        renderer.domElement?.remove();
      }
    };
  }, []);

  return <div ref={wrapRef} className={styles.wrap} style={{ cursor: 'grab', width: '100%', height: '100vh' }} />;
}