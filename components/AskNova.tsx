"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { Sparkles, X, Send } from "lucide-react";
import Link from "@/components/i18n/Link";
import { useMessages } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/types";
import { ASK_NOVA_ENABLED } from "@/lib/config";
import {
  nextRevealLength,
  readSessionToken,
  REVEAL_TICK_MS,
  writeSessionToken,
} from "@/lib/ask-nova/chat";
import MotionProvider from "@/components/MotionProvider";

// The transport (zod + API client, ~65 KB gzip) is fetched on the first send,
// not with the widget.
const loadTransport = () => import("@/lib/ask-nova/transport");

// Production kill-switch: NEXT_PUBLIC_ASK_NOVA_ENABLED=false disables the live,
// backend-connected chat and falls back to FAQ-only quick answers (no network
// call). On by default — see lib/config.ts and .env.example.

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

function AskNovaInner() {
  // Fixed, fact-checked question/answer set (messages: nova.faq) surfaced as
  // quick answers — no network call. Live replies from the backend stay in
  // whatever language the backend answers in.
  const t = useMessages("nova");
  const ASK_NOVA_FAQ = t.faq;
  // ── Core panel state ──────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<ThreadMsg[]>([]);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [footerNear, setFooterNear] = useState(false);

  // ── Real chat state ───────────────────────────────────────────────────────
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  // The chat session token (BE-1 §1). Kept in memory so a conversation survives
  // even when sessionStorage is unavailable; mirrored to sessionStorage.
  const sessionTokenRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

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

  // Abort an in-flight request when the widget unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Close the panel and hand focus back to the launcher (keyboard / button paths).
  const closePanel = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => launcherRef.current?.focus());
  }, []);

  // ── Escape closes the panel ──────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closePanel]);

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
    [reduced, ASK_NOVA_FAQ],
  );

  // ── Floating bubble: appear 3.5s after mount ──────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = setTimeout(() => {
      if (!openRef.current) setBubbleVisible(true);
    }, 3500);
    return () => clearTimeout(t);
  }, []);

  // ── Suppress the teaser bubble once the footer scrolls into view ──────────
  // The bubble is fixed bottom-right, so on any page long enough to reach the
  // footer it would otherwise sit on top of (and intercept taps on) the
  // footer's own links. rootMargin gives it room to hide slightly before the
  // footer's top edge actually reaches the bubble's on-screen position, not
  // only once they're already overlapping.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const footer = document.querySelector("footer");
    if (!footer) return;
    const observer = new IntersectionObserver(
      ([entry]) => setFooterNear(entry.isIntersecting),
      { rootMargin: "0px 0px -140px 0px" },
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  // ── Answer typewriter: advance the last still-typing Nova message ──────────
  useEffect(() => {
    const last = thread[thread.length - 1];
    if (!last || last.role !== "nova" || last.done) return;
    const t = setTimeout(() => {
      setThread((prev) =>
        prev.map((m) => {
          if (m.id !== last.id) return m;
          // Reveal by word, with a capped total duration (see nextRevealLength).
          const shown = m.full.slice(0, nextRevealLength(m.full, m.shown.length));
          return { ...m, shown, done: shown.length >= m.full.length };
        }),
      );
    }, REVEAL_TICK_MS);
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

    const controller = new AbortController();
    abortRef.current = controller;
    const settleWith = (role: "nova" | "error", text: string) =>
      setThread((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? {
                id: loadingId,
                role,
                full: text,
                shown: role === "nova" && !reduced ? "" : text,
                done: role === "error" || reduced,
              }
            : m,
        ),
      );

    const { sendChatMessage, classifyChatError } = await loadTransport().catch(() => ({
      sendChatMessage: null,
      classifyChatError: () => "network" as const,
    }));
    try {
      if (!sendChatMessage) throw new Error("transport unavailable");
      const data = await sendChatMessage({
        message: text,
        sessionToken: sessionTokenRef.current ?? readSessionToken(),
        signal: controller.signal,
      });
      // Only the token continues the conversation — keep the one the backend
      // returned (a new one when the old session expired).
      sessionTokenRef.current = data.session_token;
      writeSessionToken(data.session_token);
      settleWith("nova", data.reply ?? "");
    } catch (err) {
      if (controller.signal.aborted) return; // widget unmounted
      const kind = classifyChatError(err);
      settleWith(
        "error",
        kind === "rate_limit"
          ? t.errorRateLimit
          : kind === "server"
            ? t.errorServer
            : kind === "network"
              ? t.errorNetwork
              : t.error,
      );
    } finally {
      if (!controller.signal.aborted) {
        setSending(false);
        // Keep the keyboard open: focus never left, but make sure of it.
        inputRef.current?.focus();
      }
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
          <m.div
            key="panel"
            role="dialog"
            aria-label={t.title}
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
                    {t.title}
                  </span>
                  <span className="mt-1 block text-white/60 text-[11px] font-utility leading-none">
                    {t.subtitle}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={closePanel}
                aria-label={t.close}
                className="h-11 w-11 -mt-2 -mr-2 rounded-full hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors active:scale-[0.95] focus-visible:outline-2 focus-visible:outline-[#f7a800]"
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
                role="log"
                // Completed replies are announced once by the status region
                // above; the log must not read out half-typed text.
                aria-live="off"
                tabIndex={0}
                aria-label={t.conversationLabel}
                className="px-5 py-3 flex-1 min-h-0 overflow-y-auto flex flex-col gap-3"
              >
                {thread.length === 0 ? (
                  <p className="text-white/50 text-[13px] font-utility leading-relaxed">
                    {ASK_NOVA_ENABLED
                      ? t.greeting
                      : t.greetingOffline}
                  </p>
                ) : (
                  thread.map((m) => {
                    // Loading indicator — three-dot pulse
                    if (m.role === "loading") {
                      return (
                        <div
                          key={m.id}
                          className="self-start flex gap-2"
                          role="status"
                          aria-label={t.typing}
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
                              {t.reachTeam}
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
                  <p className="mb-1.5 font-utility text-[10px] tracking-[0.18em] text-white/55 uppercase">
                    {t.quickAnswers}
                  </p>
                  <div className="flex flex-col gap-1.5 max-h-[22dvh] overflow-y-auto">
                    {ASK_NOVA_FAQ.map((faq, i) => (
                      <button
                        key={faq.q}
                        type="button"
                        onClick={() => ask(i)}
                        disabled={sending}
                        className="text-left px-3 py-3 min-h-11 rounded-xl text-white/65 text-[12px] font-utility transition-colors duration-200 hover:text-white hover:border-[#f7a800]/35 active:scale-[0.99] disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[#f7a800]"
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

                {/* Text input + send button — only when live chat is enabled;
                    the FAQ fallback below never attempts a network call. */}
                {ASK_NOVA_ENABLED ? (
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
                          // isComposing / keyCode 229: Enter that commits a Hindi or
                          // Bengali IME candidate must not send the message.
                          if (
                            e.key === "Enter" &&
                            !e.shiftKey &&
                            !e.nativeEvent.isComposing &&
                            e.keyCode !== 229
                          ) {
                            e.preventDefault();
                            sendRealMessage();
                          }
                          // Shift+Enter: browser default (insert newline)
                        }}
                        placeholder={t.placeholder}
                        rows={1}
                        // readOnly (not disabled) while sending: a disabled field
                        // drops focus and closes the mobile keyboard.
                        readOnly={sending}
                        aria-busy={sending}
                        enterKeyHint="send"
                        aria-label={t.inputLabel}
                        className="flex-1 min-w-0 resize-none bg-white/5 border border-white/12 rounded-xl px-3.5 py-2.5 text-base font-utility text-white/90 placeholder-white/25 focus-visible:outline-2 focus-visible:outline-[#f7a800] focus:border-[#f7a800]/40 transition-colors leading-snug read-only:opacity-60"
                        style={{ maxHeight: "96px", overflowY: "auto" }}
                      />
                      <button
                        type="button"
                        onClick={sendRealMessage}
                        disabled={!input.trim() || sending}
                        aria-label={t.send}
                        className="h-11 w-11 shrink-0 rounded-xl bg-[#f7a800] text-[#091c3c] flex items-center justify-center transition-colors hover:bg-white active:scale-[0.93] disabled:opacity-35 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Character countdown — appears when approaching the limit */}
                    {input.length >= WARN_CHARS && (
                      <p className="mt-1 text-amber-400/80 text-[11px] font-utility text-right">
                        {fmt(t.charsRemaining, { count: MAX_CHARS - input.length })}
                      </p>
                    )}

                    <p className="mt-3 text-white/60 text-[11px] font-utility leading-relaxed">
                      {t.specificPrefix}{" "}
                      <Link
                        href="/contact"
                        onClick={() => setOpen(false)}
                        className="text-[#f7a800] hover:underline"
                      >
                        {t.specificLink}
                      </Link>
                      {t.specificSuffix}
                    </p>
                  </div>
                ) : (
                  <div className="px-5 pt-2 pb-4">
                    <p className="text-white/60 text-[11px] font-utility leading-relaxed">
                      {t.offlinePrefix}{" "}
                      <Link
                        href="/contact"
                        onClick={() => setOpen(false)}
                        className="text-[#f7a800] hover:underline"
                      >
                        {t.offlineLink}
                      </Link>
                      {t.offlineSuffix}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* ── Floating preview bubble ───────────────────────────────────────── */}
      <AnimatePresence>
        {bubbleVisible && !open && !footerNear && (
          <m.button
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
            aria-label={t.bubbleLabel}
            className="relative text-left rounded-2xl rounded-br-sm px-4 py-3 w-[min(258px,calc(100vw-5.5rem))] shadow-[0_16px_40px_-10px_rgba(9,28,60,0.6)] active:scale-[0.98]"
            style={{
              // No backdrop blur: at 97% opacity it was invisible, but it was
              // re-run on every typewriter tick and every scroll frame.
              backgroundColor: "rgba(4,14,40,0.97)",
              border: "1px solid rgba(247,168,0,0.22)",
              borderTop: "1px solid rgba(247,168,0,0.4)",
            }}
          >
            <span className="flex items-center gap-1.5 mb-1.5">
              <Sparkles style={{ height: "12px", width: "12px" }} className="text-[#f7a800]" />
              <span className="font-utility text-[10px] tracking-[0.12em] uppercase text-[#f7a800]">
                {t.title}
              </span>
            </span>
            <span className="block text-white/90 text-[13px] font-utility leading-snug min-h-[2.4em]">
              <BubbleTypewriter
                questions={ASK_NOVA_FAQ}
                reduced={reduced}
                indexRef={bubbleIndexRef}
              />
            </span>
            <span className="block mt-1.5 text-white/60 text-[10px] font-utility">
              {t.bubbleTap}
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
          </m.button>
        )}
      </AnimatePresence>

      {/* ── Launcher button ───────────────────────────────────────────────── */}
      <m.button
        ref={launcherRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={open ? t.close : t.open}
        whileHover={reduced ? undefined : { scale: 1.08 }}
        whileTap={reduced ? undefined : { scale: 0.94 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        className="nova-pulse h-14 w-14 rounded-full bg-[#f7a800] text-[#091c3c] flex items-center justify-center shadow-lg shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <m.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <X className="h-5 w-5" />
            </m.span>
          ) : (
            <m.span
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <Sparkles className="h-5 w-5" />
            </m.span>
          )}
        </AnimatePresence>
      </m.button>
    </div>
  );
}

// The teaser bubble's typewriter. It lives in its own component so each
// keystroke re-renders one text node instead of the whole widget, and it only
// exists while the bubble is on screen: hidden near the footer or with the
// panel open, nothing ticks. It also pauses while the tab is hidden and while
// the page is being scrolled, so it never adds a text layout to a scroll frame.
function BubbleTypewriter({
  questions,
  reduced,
  indexRef,
}: {
  questions: { q: string }[];
  reduced: boolean;
  indexRef: React.RefObject<number>;
}) {
  const [text, setText] = useState("");

  useEffect(() => {
    const qs = questions.map((f) => f.q);
    let cancelled = false;
    const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));
    const whileHidden = () =>
      document.hidden
        ? new Promise<void>((res) =>
            document.addEventListener("visibilitychange", () => res(), { once: true }),
          )
        : Promise.resolve();
    let lastScroll = 0;
    const onScroll = () => {
      lastScroll = performance.now();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    const whileScrolling = async () => {
      while (!cancelled && performance.now() - lastScroll < 200) await sleep(120);
    };
    const step = async (ms: number) => {
      await sleep(ms);
      await whileScrolling();
    };

    (async () => {
      // Resume from the question the bubble last showed.
      let qi = indexRef.current % qs.length;
      while (!cancelled) {
        await whileHidden();
        if (cancelled) return;
        indexRef.current = qi;
        const q = qs[qi];
        if (reduced) {
          setText(q);
          await step(2800);
        } else {
          for (let i = 1; i <= q.length && !cancelled; i++) {
            setText(q.slice(0, i));
            await step(34);
          }
          await step(1900);
          for (let i = q.length - 1; i >= 0 && !cancelled; i--) {
            setText(q.slice(0, i));
            await step(16);
          }
          await step(180);
        }
        qi = (qi + 1) % qs.length;
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener("scroll", onScroll);
    };
  }, [questions, reduced, indexRef]);

  return (
    <>
      {text}
      {!reduced && (
        <span className="inline-block w-[2px] h-3.5 ml-0.5 align-middle bg-[#f7a800] animate-pulse" />
      )}
    </>
  );
}

// framer-motion is not in the site-wide layout any more (it only ships to the
// pages that animate with it), so this component brings its own LazyMotion.
export default function AskNova() {
  return (
    <MotionProvider>
      <AskNovaInner />
    </MotionProvider>
  );
}
