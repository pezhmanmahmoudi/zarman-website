"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LottieLight, type LottieHandle } from "lottie-react";
import { Pause, Play, RotateCcw, Search } from "lucide-react";

type PreviewAnimation = {
  name: string;
  source: string;
  src: string;
};

type PreviewManifest = {
  animations: PreviewAnimation[];
};

function PreviewCard({ animation, playing }: { animation: PreviewAnimation; playing: boolean }) {
  const player = useRef<LottieHandle>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (playing) player.current?.play();
    else player.current?.pause();
  }, [playing]);

  function replay() {
    player.current?.stop();
    player.current?.play();
  }

  return (
    <article className="group overflow-hidden rounded-[28px] border border-[#e6e1f0] bg-white shadow-[0_18px_55px_-38px_#2e2359]">
      <div className="relative grid aspect-square place-items-center overflow-hidden bg-[radial-gradient(circle_at_50%_42%,#ffffff_0%,#f5f2fb_72%,#ece7f6_100%)] p-5">
        {failed ? (
          <p className="max-w-48 text-center text-sm leading-6 text-rose-700">این فایل در پلیر وب نمایش داده نشد.</p>
        ) : (
          <LottieLight
            as="div"
            src={animation.src}
            lottieRef={player}
            autoplay={playing}
            loop
            renderer="svg"
            rendererSettings={{ preserveAspectRatio: "xMidYMid meet", progressiveLoad: true, runExpressions: false }}
            className="size-full max-h-64 max-w-64"
            aria-hidden="true"
            subscriptions={{ error: () => setFailed(true) }}
          />
        )}
        {!failed && (
          <button
            type="button"
            onClick={replay}
            className="absolute bottom-4 end-4 grid size-10 place-items-center rounded-full border border-white/90 bg-white/85 text-[#55477b] opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7059c5]"
            aria-label={`اجرای دوباره ${animation.name}`}
            title="اجرای دوباره"
          >
            <RotateCcw size={17} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="border-t border-[#eeeaf4] px-5 py-4">
        <h2 className="m-0 truncate text-sm font-semibold text-[#272234]" dir="ltr" title={animation.name}>{animation.name}</h2>
        <p className="mb-0 mt-1 truncate text-xs text-[#81788f]" dir="ltr" title={animation.source}>{animation.source}</p>
      </div>
    </article>
  );
}

export function LottiePreviewGallery() {
  const [animations, setAnimations] = useState<PreviewAnimation[]>([]);
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/animations/dashboard/preview/index.json", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Preview manifest is unavailable");
        return response.json() as Promise<PreviewManifest>;
      })
      .then((manifest) => { if (active) setAnimations(manifest.animations); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);

  const visibleAnimations = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("en");
    if (!normalizedQuery) return animations;
    return animations.filter((animation) => animation.name.toLocaleLowerCase("en").includes(normalizedQuery));
  }, [animations, query]);

  return (
    <div className="min-h-screen bg-[#f7f5fb] text-[#272234]" dir="rtl">
      <header className="border-b border-[#e8e3f0] bg-white/85 px-5 py-7 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-end justify-between gap-5">
          <div>
            <p className="m-0 text-xs font-semibold tracking-[0.16em] text-[#7059c5]">ZARMAN MOTION LAB</p>
            <h1 className="mb-0 mt-2 text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">پیش‌نمایش انیمیشن‌های داشبورد</h1>
            <p className="mb-0 mt-2 text-sm text-[#746c80]">{animations.length || "…"} فایل Lottie آماده‌ی بررسی است.</p>
          </div>
          <button
            type="button"
            onClick={() => setPlaying((value) => !value)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#ded7eb] bg-white px-4 text-sm font-medium text-[#55477b] shadow-sm hover:bg-[#f7f4fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7059c5]"
          >
            {playing ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}
            {playing ? "توقف همه" : "پخش همه"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-5 py-7 sm:px-8 sm:py-10">
        <label className="relative block max-w-md">
          <span className="sr-only">جست‌وجوی انیمیشن</span>
          <Search className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-[#8d8499]" size={18} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جست‌وجو بین نام فایل‌ها…"
            className="min-h-12 w-full rounded-2xl border border-[#ded8e8] bg-white px-4 pe-11 text-sm outline-none placeholder:text-[#9991a3] focus:border-[#8068d0] focus:ring-4 focus:ring-[#8068d0]/10"
          />
        </label>

        {error ? (
          <p role="alert" className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">فهرست پیش‌نمایش بارگذاری نشد. اسکریپت استخراج را دوباره اجرا کنید.</p>
        ) : animations.length === 0 ? (
          <p className="mt-8 text-sm text-[#746c80]">در حال بارگذاری انیمیشن‌ها…</p>
        ) : visibleAnimations.length === 0 ? (
          <p className="mt-8 text-sm text-[#746c80]">انیمیشنی با این نام پیدا نشد.</p>
        ) : (
          <section className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="انیمیشن‌های Lottie">
            {visibleAnimations.map((animation) => <PreviewCard key={animation.src} animation={animation} playing={playing} />)}
          </section>
        )}
      </main>
    </div>
  );
}
