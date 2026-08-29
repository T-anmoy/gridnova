"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import Step1CustomerProject from "./steps/Step1CustomerProject";
import Step2InstallationSite from "./steps/Step2InstallationSite";
import Step3LoadOutput from "./steps/Step3LoadOutput";
import Step4SystemConfig from "./steps/Step4SystemConfig";
import Step5Documents from "./steps/Step5Documents";
import {
  DEFAULT_VALUES,
  DEFAULT_FILES,
  STEP_NAMES,
  TOTAL_STEPS,
  type ProposalFormValues,
  type ProposalFiles,
} from "./types";
import { STEP_FIELDS, isStepValid, validateAll, validateStep, type FieldErrors } from "./validation";

type Status = "idle" | "submitting" | "success" | "error";

export default function ProposalInputForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const [values, setValues] = useState<ProposalFormValues>(DEFAULT_VALUES);
  const [files, setFiles] = useState<ProposalFiles>(DEFAULT_FILES);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof ProposalFormValues, boolean>>>({});
  const [showDocumentErrors, setShowDocumentErrors] = useState(false);
  const [honeypot, setHoneypot] = useState("");

  const [status, setStatus] = useState<Status>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [softBackend, setSoftBackend] = useState(false);

  const dcrAutoSet = values.linkedToGovtScheme === "yes";

  function set<K extends keyof ProposalFormValues>(field: K, value: ProposalFormValues[K]) {
    setValues((v) => {
      const next = { ...v, [field]: value };
      // DCR panels are mandatory once a government scheme is linked —
      // auto-set it in the same update rather than syncing via an effect.
      if (field === "linkedToGovtScheme" && value === "yes") {
        next.dcrRequired = "yes";
      }
      return next;
    });
    if (touched[field]) {
      setErrors((e) => {
        const next = { ...e };
        delete next[field];
        return next;
      });
    }
  }

  function touch(field: keyof ProposalFormValues) {
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors((e) => ({ ...e, ...validateStep(currentStep, values) }));
  }

  function setFile<K extends keyof ProposalFiles>(field: K, value: ProposalFiles[K]) {
    setFiles((f) => ({ ...f, [field]: value }));
  }

  function handleNext() {
    const stepErrors = validateStep(currentStep, values);
    if (Object.keys(stepErrors).length > 0) {
      setErrors((e) => ({ ...e, ...stepErrors }));
      setTouched((t) => {
        const next = { ...t };
        for (const field of STEP_FIELDS[currentStep]) next[field] = true;
        return next;
      });
      return;
    }
    setCurrentStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleBack() {
    setCurrentStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit() {
    if (honeypot) return; // silent bot rejection

    const { errors: allErrors, documentError, firstInvalidStep } = validateAll(values, files);
    if (firstInvalidStep !== null) {
      setErrors(allErrors);
      setShowDocumentErrors(!!documentError);
      setTouched((t) => {
        const next = { ...t };
        for (const field of Object.keys(allErrors) as (keyof ProposalFormValues)[]) next[field] = true;
        return next;
      });
      setCurrentStep(firstInvalidStep);
      setSubmitError("Please complete all required fields before submitting.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setStatus("submitting");
    setSubmitError(null);

    try {
      const res = await fetch("/api/proposal-inputs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, website: honeypot }),
      });

      // The backend Route Handler is a placeholder pending FastAPI wiring —
      // a 501 there is a valid, expected response, not a failure.
      if (res.status === 501) {
        setSoftBackend(true);
        setStatus("success");
        return;
      }

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        setStatus("error");
        setSubmitError(data?.error || "Something went wrong. Please try again.");
        return;
      }

      setStatus("success");
    } catch {
      setStatus("error");
      setSubmitError("Something went wrong. Please try again.");
    }
  }

  function handleReset() {
    setValues(DEFAULT_VALUES);
    setFiles(DEFAULT_FILES);
    setCurrentStep(0);
    setErrors({});
    setTouched({});
    setShowDocumentErrors(false);
    setHoneypot("");
    setStatus("idle");
    setSubmitError(null);
    setSoftBackend(false);
  }

  const visibleErrors: FieldErrors = {};
  for (const field of Object.keys(errors) as (keyof ProposalFormValues)[]) {
    if (touched[field]) visibleErrors[field] = errors[field];
  }

  const canProceed = isStepValid(currentStep, values);
  const isLastStep = currentStep === TOTAL_STEPS - 1;

  if (status === "success") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="bg-white rounded-2xl border border-[#e4e8ee] p-10 md:p-14 text-center"
      >
        <div className="mx-auto h-14 w-14 rounded-full bg-[#f7a800]/10 flex items-center justify-center">
          <CheckCircle2 className="h-7 w-7 text-[#f7a800]" />
        </div>
        <h2 className="mt-6 font-display text-[#0e2a63] text-2xl font-semibold">
          Assessment Submitted for Review
        </h2>
        <p className="mt-3 text-[#111827]/65 leading-relaxed max-w-[52ch] mx-auto">
          {softBackend ? (
            "We received your submission — our backend is being connected shortly. A member of the Grid Nova team will follow up once it's live."
          ) : (
            <>
              The site assessment for {values.fullName || "this customer"} has
              been submitted. A member of the Grid Nova team will review this
              and proceed with generating a proposal.
            </>
          )}
        </p>
        <button
          type="button"
          onClick={handleReset}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#0e2a63] text-white font-utility font-semibold text-sm px-6 py-3.5 hover:bg-[#2f5daa] transition-colors duration-300 active:scale-[0.97]"
        >
          Start Another Assessment
        </button>
      </motion.div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e4e8ee] p-7 md:p-9">
      {/*
        Honeypot field — positioned far off-screen so real visitors never see it.
        Bots crawling the DOM will find and fill it; we silently drop those submissions.
        Not display:none (some bots skip fields hidden that way).
      */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-9999px",
          top: "auto",
          width: "1px",
          height: "1px",
          overflow: "hidden",
          opacity: 0,
          pointerEvents: "none",
        }}
      >
        <label htmlFor="hp_website">Website</label>
        <input
          id="hp_website"
          name="website"
          type="text"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="font-utility text-xs text-[#111827]/55 uppercase tracking-[0.12em]">
            Step {currentStep + 1} of {TOTAL_STEPS} — {STEP_NAMES[currentStep]}
          </p>
          <p className="font-utility text-xs text-[#111827]/35">
            {Math.round(((currentStep + 1) / TOTAL_STEPS) * 100)}%
          </p>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[#e4e8ee] overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-[#f7a800]"
            initial={false}
            animate={{ width: `${((currentStep + 1) / TOTAL_STEPS) * 100}%` }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />
        </div>
      </div>

      <AnimatePresence>
        {submitError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 font-utility"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {submitError}
          </motion.div>
        )}
      </AnimatePresence>

      {/*
        Deliberately not wrapped in AnimatePresence: its exit-animation
        completion callback does not reliably fire for this step content in
        this app's React/framer-motion combination, which left the outgoing
        step's fields permanently in the DOM alongside the new step's fields
        — a real navigation bug, not a cosmetic one. A keyed remount gives a
        clean, correct step swap; the entrance transition below is cosmetic
        only and never gates correctness.
      */}
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        {currentStep === 0 && (
          <Step1CustomerProject values={values} errors={visibleErrors} set={set} touch={touch} />
        )}
        {currentStep === 1 && (
          <Step2InstallationSite values={values} errors={visibleErrors} set={set} touch={touch} />
        )}
        {currentStep === 2 && (
          <Step3LoadOutput values={values} errors={visibleErrors} set={set} touch={touch} />
        )}
        {currentStep === 3 && (
          <Step4SystemConfig values={values} set={set} dcrAutoSet={dcrAutoSet} />
        )}
        {currentStep === 4 && (
          <Step5Documents
            files={files}
            setFile={setFile}
            schemeSelected={values.linkedToGovtScheme === "yes"}
            showDocumentErrors={showDocumentErrors}
          />
        )}
      </motion.div>

      <div className="mt-9 pt-6 border-t border-[#e4e8ee] flex items-center justify-between gap-4">
        {currentStep > 0 ? (
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 rounded-full border border-[#e4e8ee] text-[#0e2a63] font-utility font-semibold text-sm px-5 py-3 hover:bg-[#f7f9fc] transition-colors duration-300 active:scale-[0.97]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        ) : (
          <span />
        )}

        {isLastStep ? (
          <motion.button
            type="button"
            onClick={handleSubmit}
            disabled={status === "submitting"}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-2 rounded-full bg-[#0e2a63] text-white font-utility font-semibold text-sm px-6 py-3.5 hover:bg-[#2f5daa] transition-colors duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {status === "submitting" ? "Submitting…" : "Submit for Review"}
            <ArrowRight className="h-4 w-4" />
          </motion.button>
        ) : (
          <motion.button
            type="button"
            onClick={handleNext}
            disabled={!canProceed}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-2 rounded-full bg-[#0e2a63] text-white font-utility font-semibold text-sm px-6 py-3.5 hover:bg-[#2f5daa] transition-colors duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </motion.button>
        )}
      </div>
    </div>
  );
}
