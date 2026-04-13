"use client";

import React, { useEffect, useRef } from "react";
import { Gradient } from "@/lib/Gradient";

export default function AuthGradient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const gradient = new Gradient();
    
    if (canvasRef.current) {
      // پالت رنگی Premium Aurora (شفق قطبی فین‌تک)
      canvasRef.current.style.setProperty("--gradient-color-1", "#4f46e5"); // نیلی عمیق (Indigo) - رنگ اعتماد
      canvasRef.current.style.setProperty("--gradient-color-2", "#06b6d4"); // فیروزه‌ای الکتریک (Cyan) - رنگ تکنولوژی
      canvasRef.current.style.setProperty("--gradient-color-3", "#c026d3"); // بنفش نئونی (Fuchsia) - رنگ لوکس
      canvasRef.current.style.setProperty("--gradient-color-4", "#fda4af"); // هلویی/مرجانی (Rose) - برای ایجاد درخشش گرم و زنده
    }

    (gradient as any).initGradient("#auth-gradient-canvas");

    return () => {
      gradient.disconnect();
    };
  }, []);

  return (
    <>
      <style>{`
        .responsive-gradient {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 250vw;
          height: 60vh;
          transform: translate(-50%, -50%) rotate(-35deg);
          z-index: 0;
          
          opacity: 1; /* تغییر به ۱ برای درخشش کامل و شارپ بودن رنگ‌ها */
          /* دستور filter: blur(10px); کاملاً حذف شد! */
          
          pointer-events: none;
        }
        
        /* رسپانسیو برای تبلت: زاویه چرخش بیشتر می‌شود تا با صفحه عمودی‌تر هماهنگ شود */
        @media (max-width: 992px) {
          .responsive-gradient {
            width: 300vw;
            height: 45vh;
            transform: translate(-50%, -50%) rotate(-45deg);
          }
        }

        /* رسپانسیو برای موبایل: صفحه کاملاً عمودی است، پس زاویه تندتر می‌شود */
        @media (max-width: 640px) {
          .responsive-gradient {
            width: 350vw; /* عرض فوق‌العاده برای پوشش کامل قطرهای موبایل */
            height: 40vh;
            transform: translate(-50%, -50%) rotate(-60deg);
            opacity: 0.95; /* در موبایل کمی پررنگ‌تر باشد جذاب‌تر است */
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