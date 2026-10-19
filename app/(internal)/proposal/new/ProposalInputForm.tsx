"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiFetchForm, getTokenOrThrow } from "@/lib/api/http";
import { ApiError } from "@/lib/dashboard/api-error";
import { m, AnimatePresence } from "framer-motion";
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

// Maps each document-style ProposalFiles bucket onto the real backend's
// free-text document_type (target="document" — see grid-nova-ai-backend's
// app/api/routes/proposal_inputs.py). Deliberately excludes sitePhotos: the
// backend's installation_photo_refs isn't an open bucket like document_refs
// — it requires each photo tagged to one of 7 fixed site-survey categories
// (INSTALLATION_PHOTO_SLOTS), which this form's single "Site Photographs"
// upload has no way to determine. Wiring that needs its own UI (7 labeled
// slots, not one bucket) — a real follow-up, not something to fake here by
// guessing a slot.
const DOCUMENT_UPLOAD_FIELDS: { field: keyof ProposalFiles; documentType: string }[] = [
  { field: "electricityBills", documentType: "electricity_bill" },
  { field: "sitePlan", documentType: "site_plan" },
  { field: "govtSchemeRegistration", documentType: "govt_scheme_registration" },
  { field: "otherDocuments", documentType: "other" },
];

interface UploadOutcome {
  fileName: string;
  ok: boolean;
  error?: string;
  storageNotConfigured?: boolean;
}

// Uploads go straight from the browser to the backend with the staff member's
// Clerk token — never through a Vercel Function, whose 4.5 MB body limit is
// below this form's 10 MB file limit.
async function uploadOneFile(
  getToken: () => Promise<string | null>,
  inputsId: number,
  file: File,
  documentType: string
): Promise<UploadOutcome> {
  const form = new FormData();
  form.set("file", file);
  form.set("target", "document");
  form.set("document_type", documentType);

  try {
    const token = await getTokenOrThrow(getToken);
    await apiFetchForm(`/api/v1/proposal-inputs/${inputsId}/upload`, token, form);
    return { fileName: file.name, ok: true };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 0) return { fileName: file.name, ok: false, error: "Network error during upload." };
      if (err.structuredDetail?.code === "storage_not_configured") {
        return {
          fileName: file.name,
          ok: false,
          storageNotConfigured: true,
          error: "File storage isn't connected yet — this file was NOT saved. The rest of the assessment was submitted.",
        };
      }
      if (err.status === 401) {
        return { fileName: file.name, ok: false, error: "Your session expired — sign in again to upload files." };
      }
      return { fileName: file.name, ok: false, error: err.detail || `Upload failed (${err.status})` };
    }
    return { fileName: file.name, ok: false, error: "Upload failed." };
  }
}

interface ProposalInputFormProps {
  // Present when the wizard is opened from a lead's dashboard detail page
  // (`/proposal/new?leadId=…`) — pre-fills and locks the Lead ID field, and
  // pre-fills name/email from that lead where the wizard has a matching
  // field (the backend's lead detail has no phone field, so contact number
  // is never pre-filled here).
  initialLeadId?: string;
}

export default function ProposalInputForm({ initialLeadId }: ProposalInputFormProps) {
  const { getToken } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [values, setValues] = useState<ProposalFormValues>(() =>
    initialLeadId ? { ...DEFAULT_VALUES, referenceLeadId: initialLeadId } : DEFAULT_VALUES
  );
  const leadIdLocked = !!initialLeadId;

  // Best-effort pre-fill from the linked lead — never blocks the form if it
  // fails (the field stays editable and empty, exactly as if no leadId had
  // been passed at all).
  useEffect(() => {
    if (!initialLeadId) return;
    let cancelled = false;
    fetch(`/api/proposal-inputs/lead/${initialLeadId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.success) return;
        setValues((v) => ({
          ...v,
          fullName: v.fullName || data.full_name || "",
          email: v.email || data.email || "",
          contactNumber: v.contactNumber || data.phone || "",
        }));
      })
      .catch(() => {
        /* honest silent failure — the field stays blank and editable */
      });
    return () => {
      cancelled = true;
    };
  }, [initialLeadId]);
  const [files, setFiles] = useState<ProposalFiles>(DEFAULT_FILES);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof ProposalFormValues, boolean>>>({});
  const [showDocumentErrors, setShowDocumentErrors] = useState(false);
  const [honeypot, setHoneypot] = useState("");

  const [status, setStatus] = useState<Status>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadFailures, setUploadFailures] = useState<UploadOutcome[]>([]);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [sitePhotoCount, setSitePhotoCount] = useState(0);

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
    setUploadFailures([]);
    setUploadedCount(0);

    let inputsId: number;
    try {
      const res = await fetch("/api/proposal-inputs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, website: honeypot }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        setStatus("error");
        setSubmitError(data?.error || "Something went wrong. Please try again.");
        return;
      }
      inputsId = data.inputs_id;
    } catch {
      setStatus("error");
      setSubmitError("Something went wrong. Please try again.");
      return;
    }

    // The assessment record itself is now real and saved — everything past
    // this point is file uploads against it. A file failing (e.g. storage
    // isn't configured yet) never re-opens or invalidates that record; it's
    // reported honestly in the success state instead, never swallowed into a
    // blanket "success".
    setSitePhotoCount(files.sitePhotos.length);
    const uploadTasks: Promise<UploadOutcome>[] = [];
    for (const { field, documentType } of DOCUMENT_UPLOAD_FIELDS) {
      for (const file of files[field]) {
        uploadTasks.push(uploadOneFile(getToken, inputsId, file, documentType));
      }
    }
    const outcomes = await Promise.all(uploadTasks);
    setUploadedCount(outcomes.filter((o) => o.ok).length);
    setUploadFailures(outcomes.filter((o) => !o.ok));

    setStatus("success");
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
    setUploadFailures([]);
    setUploadedCount(0);
    setSitePhotoCount(0);
  }

  const visibleErrors: FieldErrors = {};
  for (const field of Object.keys(errors) as (keyof ProposalFormValues)[]) {
    if (touched[field]) visibleErrors[field] = errors[field];
  }

  const canProceed = isStepValid(currentStep, values);
  const isLastStep = currentStep === TOTAL_STEPS - 1;

  if (status === "success") {
    return (
      <m.div
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
          The site assessment for {values.fullName || "this customer"} has
          been submitted. A member of the Grid Nova team will review this
          and proceed with generating a proposal.
          {uploadedCount > 0 && (
            <> {uploadedCount} document{uploadedCount === 1 ? "" : "s"} uploaded successfully.</>
          )}
        </p>

        {uploadFailures.length > 0 && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-left max-w-[52ch] mx-auto">
            <p className="text-amber-800 text-sm font-utility font-semibold">
              {uploadFailures.length} document{uploadFailures.length === 1 ? "" : "s"} could not be saved
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {uploadFailures.map((f) => (
                <li key={f.fileName} className="text-amber-700 text-xs font-utility">
                  &ldquo;{f.fileName}&rdquo; — {f.storageNotConfigured ? "file storage isn't connected yet" : f.error}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-amber-700 text-xs font-utility">
              The assessment itself was saved — a Grid Nova team member will follow up to collect these files another way.
            </p>
          </div>
        )}

        {sitePhotoCount > 0 && (
          <p className="mt-4 text-[#111827]/65 text-xs font-utility max-w-[52ch] mx-auto">
            Note: the {sitePhotoCount} site photograph{sitePhotoCount === 1 ? "" : "s"} you attached
            {sitePhotoCount === 1 ? " wasn&rsquo;t" : " weren&rsquo;t"} uploaded — installation-photo upload isn&rsquo;t wired up yet.
            A team member will contact you to collect these separately.
          </p>
        )}

        <button
          type="button"
          onClick={handleReset}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#0e2a63] text-white font-utility font-semibold text-sm px-6 py-3.5 hover:bg-[#2f5daa] transition-colors duration-300 active:scale-[0.97]"
        >
          Start Another Assessment
        </button>
      </m.div>
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
          <p className="font-utility text-xs text-[#111827]/65 uppercase tracking-[0.12em]">
            Step {currentStep + 1} of {TOTAL_STEPS} — {STEP_NAMES[currentStep]}
          </p>
          <p className="font-utility text-xs text-[#111827]/65">
            {Math.round(((currentStep + 1) / TOTAL_STEPS) * 100)}%
          </p>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[#e4e8ee] overflow-hidden">
          <m.div
            className="h-full rounded-full bg-[#f7a800]"
            initial={false}
            animate={{ width: `${((currentStep + 1) / TOTAL_STEPS) * 100}%` }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />
        </div>
      </div>

      <AnimatePresence>
        {submitError && (
          <m.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 font-utility"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {submitError}
          </m.div>
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
      <m.div
        key={currentStep}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        {currentStep === 0 && (
          <Step1CustomerProject values={values} errors={visibleErrors} set={set} touch={touch} leadIdLocked={leadIdLocked} />
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
      </m.div>

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
          <m.button
            type="button"
            onClick={handleSubmit}
            disabled={status === "submitting"}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-2 rounded-full bg-[#0e2a63] text-white font-utility font-semibold text-sm px-6 py-3.5 hover:bg-[#2f5daa] transition-colors duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {status === "submitting" ? "Submitting…" : "Submit for Review"}
            <ArrowRight className="h-4 w-4" />
          </m.button>
        ) : (
          <m.button
            type="button"
            onClick={handleNext}
            disabled={!canProceed}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-2 rounded-full bg-[#0e2a63] text-white font-utility font-semibold text-sm px-6 py-3.5 hover:bg-[#2f5daa] transition-colors duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </m.button>
        )}
      </div>
    </div>
  );
}
