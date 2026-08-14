"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import headerLogo from "@/public/brand/header-logo.png";

export default function GlobalLoader() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    if (sessionStorage.getItem("gne_loader_shown")) return;
    // Defer setState per lint rule
    const showTimer = setTimeout(() => setVisible(true), 0);
    const hideTimer = setTimeout(() => {
      setVisible(false);
      sessionStorage.setItem("gne_loader_shown", "1");
    }, 850);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="fixed inset-0 z-[999] bg-[#091c3c] flex items-center justify-center"
          aria-hidden="true"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <div className="bg-white rounded-2xl px-10 py-6 shadow-2xl">
              <Image
                src={headerLogo}
                alt="Grid Nova Energy"
                width={115}
                height={30}
                className="w-[200px] h-auto"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
