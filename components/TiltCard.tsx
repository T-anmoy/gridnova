"use client";

import { useRef, useState, useEffect } from "react";

export default function TiltCard({
  children,
  className,
  intensity = 7,
}: {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [cardStyle, setCardStyle] = useState<React.CSSProperties>({});
  const [disabled, setDisabled] = useState(true);

  useEffect(() => {
    const noHover = window.matchMedia("(hover: none)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(() => setDisabled(noHover || reduced), 0);
  }, []);

  if (disabled) return <div className={className}>{children}</div>;

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...cardStyle,
        transition: "transform 0.13s ease, box-shadow 0.13s ease",
        willChange: "transform",
        transformStyle: "preserve-3d",
      }}
      onMouseMove={(e) => {
        if (!ref.current) return;
        const r = ref.current.getBoundingClientRect();
        const rx = ((e.clientY - r.top) / r.height - 0.5) * -intensity;
        const ry = ((e.clientX - r.left) / r.width - 0.5) * intensity;
        // Dynamic shadow tracks tilt direction for depth cue
        const sx = ry * 1.8;
        const sy = -rx * 1.8;
        setCardStyle({
          transform: `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.015)`,
          boxShadow: `${sx}px ${sy + 10}px 36px rgba(9,28,60,0.2)`,
        });
      }}
      onMouseLeave={() =>
        setCardStyle({
          transform: "perspective(700px) rotateX(0deg) rotateY(0deg) scale(1)",
          boxShadow: "",
        })
      }
    >
      {children}
    </div>
  );
}
