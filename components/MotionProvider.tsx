"use client";

import { LazyMotion } from "framer-motion";

// Every animated element in the app is `m.*` (not `motion.*`), and `strict`
// makes a stray `motion.*` fail loudly instead of silently pulling the whole
// library back into the bundle. The feature set loads after hydration.
const loadFeatures = () => import("./motion-features").then((mod) => mod.default);

export default function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      {children}
    </LazyMotion>
  );
}
