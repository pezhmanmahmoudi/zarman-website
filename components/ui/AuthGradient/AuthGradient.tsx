"use client";

import React, { useEffect, useRef } from "react";
import { Gradient } from "@/lib/Gradient";

export default function AuthGradient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const gradient = new Gradient();
    
    if (canvasRef.current) {
      canvasRef.current.style.setProperty("--gradient-color-1", "#00e1ff"); 
      canvasRef.current.style.setProperty("--gradient-color-2", "#57aeff"); 
      canvasRef.current.style.setProperty("--gradient-color-3", "#d85dfd"); 
      canvasRef.current.style.setProperty("--gradient-color-4", "#38f8df"); 
    }

    gradient.initGradient("#auth-gradient-canvas");

    return () => {
      gradient.disconnect();
    };
  }, []);

  return (
    <>
      <style>{`
        .responsive-gradient {
          position: absolute;
          top: -20%;
          right: -10%;
          width: 200%;
          height: 30vh;
          transform: rotate(-25deg);
          transform-origin: top right;
          overflow: hidden;
          z-index: 0;
          opacity: 0.9;
          box-shadow: 0 20px 40px rgba(79, 70, 229, 0.15);
        }
        
        /* در موبایل و تبلت، گرادیانت جمع‌وجور شده و مثل یک هدر شیک می‌ایستد */
        @media (max-width: 768px) {
          .responsive-gradient {
            top: -10%;
            right: -25%;
            width: 150%;
            height: 220px;
            transform: rotate(-35deg);
          }
        }
        @media (max-width: 480px) {
          .responsive-gradient {
            top: -10%;
            right: -5%;
            width: 280%;
            height: 220px;
            transform: rotate(-55deg);
          }
        }
      `}</style>
      
      <div className="responsive-gradient">
        <canvas
          id="auth-gradient-canvas"
          ref={canvasRef}
          data-js-darken-top
          style={{
            width: "100%",
            height: "100%",
            display: "block",
          }}
        />
      </div>
    </>
  );
}