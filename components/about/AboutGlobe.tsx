"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const CITIES = [
  { name: "Sydney", lat: -33.8688, lng: 151.2093 },
  { name: "Tehran", lat: 35.6892, lng: 51.3890 },
  { name: "Dubai", lat: 25.2048, lng: 55.2708 },
  { name: "London", lat: 51.5074, lng: -0.1278 },
  { name: "Ottawa", lat: 45.4215, lng: -75.6972 },
  { name: "Washington D.C.", lat: 38.9072, lng: -77.0369 },
];

function latLngToVec3(lat: number, lng: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

async function buildLandmaskDots(imageUrl: string, radius: number): Promise<Float32Array> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  img.src = imageUrl;

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load landmask image"));
  });

  const canvas = document.createElement("canvas");
  const W = 720,
    H = 360;
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D context error");

  ctx.drawImage(img, 0, 0, W, H);

  const imageData = ctx.getImageData(0, 0, W, H);
  const data = imageData.data;

  const positions: number[] = [];

  // Keep the same sampling density (y+=2, x+=2) to preserve appearance
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      const i = (y * W + x) * 4;
      if (data[i + 3] < 10) continue;
      if ((data[i] + data[i + 1] + data[i + 2]) / 3 < 30) continue;

      const v = latLngToVec3(90 - (y / H) * 180, (x / W) * 360 - 180, radius);
      positions.push(v.x, v.y, v.z);
    }
  }

  return new Float32Array(positions);
}

export default function AboutGlobe() {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = wrapRef.current;
    if (!container) return;

    let cancelled = false; // ✅ مهم: جلوگیری از ادامه init بعد از unmount

    let renderer: THREE.WebGLRenderer | null = null;
    let scene: THREE.Scene | null = null;
    let camera: THREE.PerspectiveCamera | null = null;
    let controls: OrbitControls | null = null;

    let sphere: THREE.Mesh | null = null;
    let dots: THREE.Points | null = null;
    let cityGroup: THREE.Group | null = null;

    let pulseMeshes: THREE.Mesh[] = [];

    let raf: number | null = null;
    const runningRef = { current: false };
    const readyRef = { current: false };

    let io: IntersectionObserver | null = null;

    const stopLoop = () => {
      runningRef.current = false;
      if (raf != null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
    };

    const startLoop = () => {
      if (!readyRef.current) return;
      if (runningRef.current) return;
      runningRef.current = true;

      const tick = () => {
        if (!runningRef.current) return;

        controls?.update();

        for (const m of pulseMeshes) {
          m.scale.addScalar(0.015);
          const mat = m.material as THREE.MeshBasicMaterial;
          mat.opacity -= 0.01;
          if (mat.opacity <= 0) {
            m.scale.set(1, 1, 1);
            mat.opacity = 1;
          }
        }

        renderer?.render(scene!, camera!);
        raf = requestAnimationFrame(tick);
      };

      raf = requestAnimationFrame(tick);
    };

    // Resize (throttled via rAF)
    let resizeRaf: number | null = null;
    const onResize = () => {
      if (!renderer || !camera) return;
      if (resizeRaf != null) return;

      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null;
        if (!renderer || !camera || !container) return;

        const w = container.clientWidth || 1;
        const h = container.clientHeight || 1;

        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      });
    };

    const init = async () => {
      container.innerHTML = "";

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(container.clientWidth, container.clientHeight, false);
      renderer.sortObjects = false;
      container.appendChild(renderer.domElement);

      scene = new THREE.Scene();

      camera = new THREE.PerspectiveCamera(
        40,
        container.clientWidth / container.clientHeight,
        1,
        3000
      );
      camera.position.set(20, 100, 540);
      camera.lookAt(0, 0, 0);

      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const dir = new THREE.DirectionalLight(0x6366f1, 1.4);
      dir.position.set(-3, 2, 5);
      scene.add(dir);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.9;
      controls.enableZoom = false;

      const isLargeScreen = window.innerWidth > 900;
      controls.enabled = isLargeScreen;

      if (isLargeScreen) {
        renderer.domElement.style.touchAction = "none";
      }

      const R = 180;

      sphere = new THREE.Mesh(
        new THREE.SphereGeometry(R - 0.5, 64, 64),
        new THREE.MeshBasicMaterial({ color: 0x030712, transparent: true, opacity: 0.9 })
      );
      sphere.renderOrder = 1;
      scene.add(sphere);

      // ✅ Async part — بعد از await ممکن است کامپوننت unmount شده باشد
      const dotPositions = await buildLandmaskDots("/Earth/earth-landmask.png", R + 0.8);

      // ✅ Guard: اگر cleanup شده، ادامه نده
      if (cancelled || !scene || !renderer || !camera) return;

      const dotGeom = new THREE.BufferGeometry();
      dotGeom.setAttribute("position", new THREE.BufferAttribute(dotPositions, 3));

      dots = new THREE.Points(
        dotGeom,
        new THREE.PointsMaterial({
          color: 0x4fc3f7,
          size: 2.0,
          transparent: true,
          opacity: 0.95,
          depthTest: false,
        })
      );
      dots.renderOrder = 0;
      scene.add(dots);

      cityGroup = new THREE.Group();
      cityGroup.renderOrder = 2;
      scene.add(cityGroup);

      pulseMeshes = [];

      CITIES.forEach((city) => {
        const pos = latLngToVec3(city.lat, city.lng, R + 1.2);

        const cityDot = new THREE.Mesh(
          new THREE.SphereGeometry(3, 16, 16),
          new THREE.MeshBasicMaterial({ color: 0xffaa00 })
        );
        cityDot.position.copy(pos);
        cityGroup!.add(cityDot);

        const ring = new THREE.Mesh(
          new THREE.RingGeometry(3, 10, 32),
          new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            side: THREE.DoubleSide,
            opacity: 1,
          })
        );
        ring.position.copy(pos);
        ring.lookAt(0, 0, 0);
        cityGroup!.add(ring);
        pulseMeshes.push(ring);
      });

      const startingRotation = Math.PI * 0.9;
      sphere.rotation.y = startingRotation;
      dots.rotation.y = startingRotation;
      cityGroup.rotation.y = startingRotation;

      readyRef.current = true;

      // Start loop only if currently visible
      const rect = container.getBoundingClientRect();
      const inView =
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < window.innerHeight &&
        rect.left < window.innerWidth;

      if (inView) startLoop();
    };

    // Pause/Resume based on viewport
    io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        if (entry.isIntersecting) startLoop();
        else stopLoop();
      },
      { threshold: 0.15 }
    );

    io.observe(container);

    window.addEventListener("resize", onResize, { passive: true });

    init();

    return () => {
      cancelled = true; // ✅ این خط مشکل شما را حل می‌کند

      stopLoop();

      window.removeEventListener("resize", onResize);
      if (resizeRaf != null) cancelAnimationFrame(resizeRaf);

      io?.disconnect();
      io = null;

      controls?.dispose();
      controls = null;

      if (sphere) {
        sphere.geometry.dispose();
        (sphere.material as THREE.Material).dispose();
        sphere = null;
      }

      if (dots) {
        dots.geometry.dispose();
        (dots.material as THREE.Material).dispose();
        dots = null;
      }

      if (cityGroup) {
        cityGroup.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if ((mesh as any).geometry) (mesh as any).geometry.dispose?.();
          if ((mesh as any).material) {
            const mat = (mesh as any).material;
            if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.());
            else mat.dispose?.();
          }
        });
        scene?.remove(cityGroup);
        cityGroup = null;
      }

      scene = null;

      if (renderer) {
        renderer.dispose();
        renderer.domElement?.remove();
        renderer = null;
      }

      camera = null;
      pulseMeshes = [];
      readyRef.current = false;
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      style={{ width: "100%", height: "100%", cursor: "grab", pointerEvents: "auto" }}
    />
  );
}
