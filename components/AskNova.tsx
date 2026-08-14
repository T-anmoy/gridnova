"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Send } from "lucide-react";
import Link from "next/link";
import { ASK_NOVA_FAQ } from "@/lib/ask-nova-faq";

// sessionStorage keys — per-tab, cleared on tab close (matches existing site convention)
const LEAD_ID_KEY = "nova_lead_id";
const CUSTOMER_ID_KEY = "nova_customer_id";

const MAX_CHARS = 2_000;
const WARN_CHARS = 1_800;

type MsgRole = "user" | "nova" | "loading" | "error";

type ThreadMsg = {
  id: number;
  role: MsgRole;
  full: string;
  shown: string;
  done: boolean;
};

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    const raf = requestAnimationFrame(onChange);
    mq.addEventListener?.("change", onChange);
    return () => {
      cancelAnimationFrame(raf);
      mq.removeEventListener?.("change", onChange);
    };
  }, []);
  return reduced;
}

export default function AskNova() {
  // ── Core panel state ──────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<ThreadMsg[]>([]);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [bubbleText, setBubbleText] = useState("");

  // ── Real chat state ───────────────────────────────────────────────────────
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [leadId, setLeadId] = useState<number | null>(null);
  const [customerId, setCustomerId] = useState<number | null>(null);

  const reduced = usePrefersReducedMotion();
  const idRef = useRef(0);
  const bubbleIndexRef = useRef(0);
  const openRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevCountRef = useRef(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const nextId = () => (idRef.current += 1);

  // Keep openRef current so closure-captured effects can read it
  useEffect(() => { openRef.current = open; }, [open]);

  // ── Outside-click / outside-tap: close panel when pointer lands outside ──
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  // ── Session continuity: restore lead/customer IDs from sessionStorage ─────
  // Defer setState per lint rule (same pattern as GlobalLoader).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = setTimeout(() => {
      const lid = sessionStorage.getItem(LEAD_ID_KEY);
      const cid = sessionStorage.getItem(CUSTOMER_ID_KEY);
      if (lid) setLeadId(Number(lid));
      if (cid) setCustomerId(Number(cid));
    });
    return () => clearTimeout(t);
  }, []);

  // ── Accessibility: focus input when panel opens ───────────────────────────
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  // ── FAQ: instant pre-written answers — no backend call ───────────────────
  const ask = useCallback(
    (index: number) => {
      const faq = ASK_NOVA_FAQ[index];
      if (!faq) return;
      setThread((prev) => [
        ...prev,
        { id: nextId(), role: "user", full: faq.q, shown: faq.q, done: true },
        {
          id: nextId(),
          role: "nova",
          full: faq.a,
          shown: reduced ? faq.a : "",
          done: reduced,
        },
      ]);
    },
    [reduced],
  );

  // ── Floating bubble: appear 3.5s after mount ──────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = setTimeout(() => {
      if (!openRef.current) setBubbleVisible(true);
    }, 3500);
    return () => clearTimeout(t);
  }, []);

  // ── Bubble typewriter: cycle all questions (both normal and reduced motion) ─
  useEffect(() => {
    if (!bubbleVisible) return;
    const questions = ASK_NOVA_FAQ.map((f) => f.q);
    let cancelled = false;
    const sleep = (ms: number) =>
      new Promise<void>((res) => setTimeout(res, ms));

    (async () => {
      let qi = 0;
      while (!cancelled) {
        bubbleIndexRef.current = qi;
        const q = questions[qi];
        if (reduced) {
          setBubbleText(q);
          await sleep(2800);
        } else {
          for (let i = 1; i <= q.length && !cancelled; i++) {
            setBubbleText(q.slice(0, i));
            await sleep(34);
          }
          await sleep(1900);
          for (let i = q.length - 1; i >= 0 && !cancelled; i--) {
            setBubbleText(q.slice(0, i));
            await sleep(16);
          }
          await sleep(180);
        }
        qi = (qi + 1) % questions.length;
      }
    })();

    return () => { cancelled = true; };
  }, [bubbleVisible, reduced]);

  // ── Answer typewriter: advance the last still-typing Nova message ──────────
  useEffect(() => {
    const last = thread[thread.length - 1];
    if (!last || last.role !== "nova" || last.done) return;
    const t = setTimeout(() => {
      setThread((prev) =>
        prev.map((m) => {
          if (m.id !== last.id) return m;
          const shown = m.full.slice(0, m.shown.length + 1);
          return { ...m, shown, done: shown.length >= m.full.length };
        }),
      );
    }, 20);
    return () => clearTimeout(t);
  }, [thread]);

  // ── Auto-scroll when thread grows ─────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || thread.length === prevCountRef.current) return;
    prevCountRef.current = thread.length;
    requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight; });
  }, [thread.length]);

  // ── Real message: POST to backend ─────────────────────────────────────────
  const sendRealMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    // Reset textarea height after clear
    if (inputRef.current) inputRef.current.style.height = "auto";
    setSending(true);

    const userMsgId = nextId();
    const loadingId = nextId();

    setThread((prev) => [
      ...prev,
      { id: userMsgId, role: "user", full: text, shown: text, done: true },
      { id: loadingId, role: "loading", full: "", shown: "", done: false },
    ]);

    try {
      const body: Record<string, unknown> = { message: text };
      if (customerId) {
        body.customer_id = customerId;
        if (leadId) body.lead_id = leadId;
      }

      const apiBase =
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const res = await fetch(`${apiBase}/api/v1/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          detail?: string;
        };
        throw new Error(err.detail ?? `Error ${res.status}`);
      }

      const data = (await res.json()) as {
        reply: string;
        lead_id: number | null;
        customer_id: number | null;
      };

      // Persist IDs for conversation continuity
      if (data.lead_id) {
        setLeadId(data.lead_id);
        sessionStorage.setItem(LEAD_ID_KEY, String(data.lead_id));
      }
      if (data.customer_id) {
        setCustomerId(data.customer_id);
        sessionStorage.setItem(CUSTOMER_ID_KEY, String(data.customer_id));
      }

      const reply = data.reply ?? "";
      setThread((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? {
                id: loadingId,
                role: "nova" as const,
                full: reply,
                shown: reduced ? reply : "",
                done: reduced,
              }
            : m,
        ),
      );
    } catch {
      const errMsg =
        "Having a little trouble right now — try again in a moment, or reach our team directly.";
      setThread((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? {
                id: loadingId,
                role: "error" as const,
                full: errMsg,
                shown: errMsg,
                done: true,
              }
            : m,
        ),
      );
    } finally {
      setSending(false);
    }
  };

  const openFromBubble = () => {
    setBubbleVisible(false);
    setOpen(true);
    ask(bubbleIndexRef.current);
  };

  const toggle = () => {
    setBubbleVisible(false);
    setOpen((v) => !v);
  };

  const springOrFade = reduced
    ? { duration: 0.12 }
    : { type: "spring" as const, stiffness: 420, damping: 32, restDelta: 0.001 };

  // Last completed Nova or error text — drives the aria-live announcement
  const lastDoneText =
    thread
      .filter((m) => m.done && (m.role === "nova" || m.role === "error"))
      .at(-1)?.full ?? "";

  return (
    <div ref={wrapperRef} className="fixed bottom-6 right-6 z-[200] flex flex-col items-end gap-3">
      {/* Screen-reader announcements for completed replies */}
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {lastDoneText}
      </span>

      {/* ── Panel ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: reduced ? 1 : 0.88, y: reduced ? 0 : 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: reduced ? 1 : 0.92, y: reduced ? 0 : 12 }}
            transition={springOrFade}
            className="flex flex-col rounded-3xl overflow-hidden w-[min(384px,calc(100vw-2rem))] shadow-[0_28px_70px_-14px_rgba(9,28,60,0.7)]"
            style={{
              backgroundColor: "rgba(4,14,40,0.97)",
              transformOrigin: "bottom right",
              maxHeight: "calc(100dvh - 6rem)",
              backdropFilter: "blur(28px) saturate(160%)",
              WebkitBackdropFilter: "blur(28px) saturate(160%)",
              border: "1px solid rgba(247,168,0,0.18)",
              borderTop: "1px solid rgba(247,168,0,0.4)",
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-white/8 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-[#f7a800] flex items-center justify-center shrink-0 shadow-[0_0_16px_rgba(247,168,0,0.4)]">
                  <Sparkles style={{ height: "18px", width: "18px" }} className="text-[#091c3c]" />
                </div>
                <div>
                  <span className="font-display text-white font-semibold text-[15px] leading-none block">
                    Ask Nova
                  </span>
                  <span className="mt-1 block text-white/40 text-[11px] font-utility leading-none">
                    Solar energy assistant
                  </span>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close Ask Nova"
                className="h-8 w-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors active:scale-[0.95]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex flex-col min-h-0 flex-1">
              {/* Thread — scrollable, always rendered */}
              <div
                ref={scrollRef}
                data-lenis-prevent
                aria-label="Conversation with Nova"
                className="px-5 py-3 flex-1 min-h-0 overflow-y-auto flex flex-col gap-3"
              >
                {thread.length === 0 ? (
                  <p className="text-white/50 text-[13px] font-utility leading-relaxed">
                    Hi, I&rsquo;m Nova — your solar energy assistant. Type a
                    question or tap a quick answer below.
                  </p>
                ) : (
                  thread.map((m) => {
                    // Loading indicator — three-dot pulse
                    if (m.role === "loading") {
                      return (
                        <div
                          key={m.id}
                          className="self-start flex gap-2"
                          aria-label="Nova is typing"
                        >
                          <div className="h-6 w-6 mt-1 rounded-full bg-[#f7a800]/90 flex items-center justify-center shrink-0">
                            <Sparkles
                              style={{ height: "12px", width: "12px" }}
                              className="text-[#091c3c]"
                            />
                          </div>
                          <div
                            className="rounded-2xl rounded-bl-md px-4 py-[13px] flex items-center"
                            style={{
                              background: "rgba(255,255,255,0.06)",
                              border: "1px solid rgba(255,255,255,0.08)",
                            }}
                          >
                            <div className="flex gap-1.5 items-center" aria-hidden="true">
                              {([0, 150, 300] as const).map((delay) => (
                                <span
                                  key={delay}
                                  className="block h-1.5 w-1.5 rounded-full bg-white/55 nova-typing-dot"
                                  style={{ animationDelay: `${delay}ms` }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // Inline error message
                    if (m.role === "error") {
                      return (
                        <div key={m.id} className="self-start max-w-[96%]" role="alert">
                          <div
                            className="rounded-2xl rounded-bl-md text-amber-300/90 text-[13px] font-utility px-3.5 py-2.5 leading-relaxed"
                            style={{
                              background: "rgba(251,191,36,0.06)",
                              border: "1px solid rgba(251,191,36,0.22)",
                            }}
                          >
                            {m.shown}{" "}
                            <Link
                              href="/contact"
                              onClick={() => setOpen(false)}
                              className="text-[#f7a800] hover:underline underline-offset-2 whitespace-nowrap"
                            >
                              Reach our team →
                            </Link>
                          </div>
                        </div>
                      );
                    }

                    // Visitor message
                    if (m.role === "user") {
                      return (
                        <div key={m.id} className="self-end max-w-[85%]">
                          <div className="rounded-2xl rounded-br-md bg-[#f7a800] text-[#091c3c] text-[13px] font-utility font-medium px-3.5 py-2.5 leading-snug">
                            {m.shown}
                          </div>
                        </div>
                      );
                    }

                    // Nova reply (FAQ or real)
                    return (
                      <div key={m.id} className="self-start max-w-[92%] flex gap-2">
                        <div className="h-6 w-6 mt-0.5 rounded-full bg-[#f7a800]/90 flex items-center justify-center shrink-0">
                          <Sparkles
                            style={{ height: "12px", width: "12px" }}
                            className="text-[#091c3c]"
                          />
                        </div>
                        <div
                          className="rounded-2xl rounded-bl-md text-white/85 text-[13px] font-utility px-3.5 py-2.5 leading-relaxed"
                          style={{
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          {m.shown}
                          {!m.done && (
                            <span className="inline-block w-1.5 h-3.5 ml-0.5 align-middle bg-[#f7a800] animate-pulse" />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* ── Pinned controls ──────────────────────────────────────── */}
              <div className="border-t border-white/8 shrink-0">
                {/* FAQ chips — persistent quick-answer shortcuts */}
                <div className="px-5 pt-3">
                  <p className="mb-1.5 font-utility text-[10px] tracking-[0.18em] text-white/30 uppercase">
                    Quick answers
                  </p>
                  <div className="flex flex-col gap-1.5 max-h-[22dvh] overflow-y-auto">
                    {ASK_NOVA_FAQ.map((faq, i) => (
                      <button
                        key={faq.q}
                        onClick={() => ask(i)}
                        disabled={sending}
                        className="text-left px-3 py-2 rounded-xl text-white/65 text-[12px] font-utility transition-all duration-200 hover:text-white hover:border-[#f7a800]/35 active:scale-[0.99] disabled:opacity-40"
                        style={{
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        {faq.q}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Text input + send button */}
                <div className="px-5 pt-2 pb-4">
                  <div className="flex gap-2 items-end">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => {
                        const val = e.target.value.slice(0, MAX_CHARS);
                        setInput(val);
                        // Auto-grow up to ~4 lines
                        const el = e.target;
                        el.style.height = "auto";
                        el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendRealMessage();
                        }
                        // Shift+Enter: browser default (insert newline)
                      }}
                      placeholder="Ask a specific question… (Enter to send)"
                      rows={1}
                      disabled={sending}
                      aria-label="Message to Nova"
                      className="flex-1 min-w-0 resize-none bg-white/5 border border-white/12 rounded-xl px-3.5 py-2.5 text-[13px] font-utility text-white/90 placeholder-white/25 focus:outline-none focus:border-[#f7a800]/40 transition-colors leading-snug disabled:opacity-50"
                      style={{ maxHeight: "96px", overflowY: "auto" }}
                    />
                    <button
                      onClick={sendRealMessage}
                      disabled={!input.trim() || sending}
                      aria-label="Send message"
                      className="h-9 w-9 mb-0.5 shrink-0 rounded-xl bg-[#f7a800] text-[#091c3c] flex items-center justify-center transition-all hover:bg-white active:scale-[0.93] disabled:opacity-35 disabled:cursor-not-allowed"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Character countdown — appears when approaching the limit */}
                  {input.length >= WARN_CHARS && (
                    <p className="mt-1 text-amber-400/80 text-[11px] font-utility text-right">
                      {MAX_CHARS - input.length} chars remaining
                    </p>
                  )}

                  <p className="mt-3 text-white/35 text-[11px] font-utility leading-relaxed">
                    Have something specific in mind?{" "}
                    <Link
                      href="/contact"
                      onClick={() => setOpen(false)}
                      className="text-[#f7a800] hover:underline"
                    >
                      Talk to our team directly
                    </Link>
                    .
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating preview bubble ───────────────────────────────────────── */}
      <AnimatePresence>
        {bubbleVisible && !open && (
          <motion.button
            key="bubble"
            type="button"
            onClick={openFromBubble}
            initial={{ opacity: 0, scale: reduced ? 1 : 0.7, y: reduced ? 0 : 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: reduced ? 1 : 0.7, y: reduced ? 0 : 8 }}
            transition={
              reduced
                ? { duration: 0.12 }
                : { type: "spring", stiffness: 380, damping: 26 }
            }
            aria-label="Ask Nova a quick question"
            className="relative text-left rounded-2xl rounded-br-sm px-4 py-3 w-[min(258px,calc(100vw-5.5rem))] shadow-[0_16px_40px_-10px_rgba(9,28,60,0.6)] active:scale-[0.98]"
            style={{
              backgroundColor: "rgba(4,14,40,0.97)",
              backdropFilter: "blur(20px) saturate(150%)",
              WebkitBackdropFilter: "blur(20px) saturate(150%)",
              border: "1px solid rgba(247,168,0,0.22)",
              borderTop: "1px solid rgba(247,168,0,0.4)",
            }}
          >
            <span className="flex items-center gap-1.5 mb-1.5">
              <Sparkles style={{ height: "12px", width: "12px" }} className="text-[#f7a800]" />
              <span className="font-utility text-[10px] tracking-[0.12em] uppercase text-[#f7a800]">
                Ask Nova
              </span>
            </span>
            <span className="block text-white/90 text-[13px] font-utility leading-snug min-h-[2.4em]">
              {bubbleText}
              {!reduced && (
                <span className="inline-block w-[2px] h-3.5 ml-0.5 align-middle bg-[#f7a800] animate-pulse" />
              )}
            </span>
            <span className="block mt-1.5 text-white/40 text-[10px] font-utility">
              Tap for the answer →
            </span>
            {/* Tail pointing toward the launcher */}
            <span
              className="absolute -bottom-1.5 right-5 h-3 w-3 rotate-45"
              style={{
                backgroundColor: "rgba(4,14,40,0.97)",
                borderRight: "1px solid rgba(247,168,0,0.22)",
                borderBottom: "1px solid rgba(247,168,0,0.22)",
              }}
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Launcher button ───────────────────────────────────────────────── */}
      <motion.button
        onClick={toggle}
        aria-label={open ? "Close Ask Nova" : "Open Ask Nova quick answers"}
        whileHover={reduced ? undefined : { scale: 1.08 }}
        whileTap={reduced ? undefined : { scale: 0.94 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        className="nova-pulse h-14 w-14 rounded-full bg-[#f7a800] text-[#091c3c] flex items-center justify-center shadow-lg shrink-0"
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <X className="h-5 w-5" />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <Sparkles className="h-5 w-5" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
