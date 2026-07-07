"use client";

import { useEffect, useRef, useState } from "react";

type Slide = {
  id: string;
  title: string;
  caption: string;
  image: string;
};

export default function Carousel({
  slides,
  interval = 3500,
}: {
  slides: Slide[];
  interval?: number;
}) {
  const [index, setIndex] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchX = useRef<number | null>(null);

  const count = slides.length;

  useEffect(() => {
    if (count <= 1) return;
    timer.current = setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, interval);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [count, interval]);

  const go = (i: number) => setIndex((i + count) % count);

  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) go(dx < 0 ? index + 1 : index - 1);
    touchX.current = null;
  };

  return (
    <div
      className="carousel"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="carousel-track"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((s) => (
          <div key={s.id} className="carousel-slide">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.image} alt={s.title} />
            <div className="carousel-caption">
              <p className="text-white text-[18px] font-bold leading-snug">
                {s.title}
              </p>
              <p className="text-white/80 text-[13px] mt-1">{s.caption}</p>
            </div>
          </div>
        ))}
      </div>

      {count > 1 && (
        <div className="carousel-dots">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`${i + 1}번째 슬라이드`}
              className={`carousel-dot ${i === index ? "carousel-dot-active" : ""}`}
              onClick={() => go(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
