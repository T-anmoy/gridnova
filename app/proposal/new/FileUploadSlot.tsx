"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, X, FileText, AlertCircle } from "lucide-react";
import { FloatLabel } from "./formPrimitives";

interface FileUploadSlotProps {
  id: string;
  label: string;
  helperText?: string;
  accept: string; // e.g. ".pdf,.jpg,.jpeg,.png"
  acceptedTypesLabel: string; // e.g. "PDF, JPG, PNG"
  maxSizeMB: number;
  maxFiles: number;
  files: File[];
  onChange: (files: File[]) => void;
  optional?: boolean;
  error?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ThumbOrChip({ file, onRemove }: { file: File; onRemove: () => void }) {
  const isImage = file.type.startsWith("image/");
  const previewUrl = useMemo(() => (isImage ? URL.createObjectURL(file) : null), [file, isImage]);

  // Revoking is a side effect on an external resource (not a state sync), so
  // it belongs in an effect — but the URL itself is derived via useMemo above,
  // not stored as state, since creating it doesn't need to trigger a render.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="relative flex items-center gap-2.5 rounded-xl border border-[#e4e8ee] bg-white pl-2.5 pr-8 py-2.5"
    >
      {isImage && previewUrl ? (
        // Blob preview URLs aren't compatible with next/image's optimizer —
        // a plain <img> is the correct tool for ephemeral client-side previews.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={file.name}
          className="h-9 w-9 rounded-lg object-cover shrink-0"
        />
      ) : (
        <div className="h-9 w-9 rounded-lg bg-[#f7f9fc] flex items-center justify-center shrink-0">
          <FileText className="h-4 w-4 text-[#2f5daa]" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[#111827] text-xs font-utility font-medium truncate max-w-[160px]">
          {file.name}
        </p>
        <p className="text-[#111827]/40 text-[11px] font-utility">{formatSize(file.size)}</p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-[#111827]/30 hover:text-red-500 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}

export default function FileUploadSlot({
  id,
  label,
  helperText,
  accept,
  acceptedTypesLabel,
  maxSizeMB,
  maxFiles,
  files,
  onChange,
  optional,
  error,
}: FileUploadSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  function addFiles(incoming: FileList | File[]) {
    const list = Array.from(incoming);
    const accepted: File[] = [];
    let rejection: string | null = null;

    for (const file of list) {
      if (file.size > maxSizeMB * 1024 * 1024) {
        rejection = `"${file.name}" exceeds the ${maxSizeMB}MB limit`;
        continue;
      }
      accepted.push(file);
    }

    const combined = [...files, ...accepted];
    if (combined.length > maxFiles) {
      rejection = `Only up to ${maxFiles} file${maxFiles === 1 ? "" : "s"} allowed`;
      onChange(combined.slice(0, maxFiles));
    } else {
      onChange(combined);
    }
    setLocalError(rejection);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  function removeAt(idx: number) {
    onChange(files.filter((_, i) => i !== idx));
    setLocalError(null);
  }

  const atLimit = files.length >= maxFiles;

  return (
    <div>
      <FloatLabel id={id} label={label} optional={optional} error={error} />
      {helperText && (
        <p className="text-[#111827]/45 text-xs font-utility leading-relaxed mb-2.5 -mt-0.5">
          {helperText}
        </p>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!atLimit) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={atLimit ? undefined : handleDrop}
        onClick={() => !atLimit && inputRef.current?.click()}
        className={`rounded-xl border-2 border-dashed px-5 py-6 text-center transition-colors duration-200 ${
          atLimit
            ? "border-[#e4e8ee] bg-[#f7f9fc]/50 cursor-not-allowed"
            : dragOver
              ? "border-[#f7a800] bg-[#f7a800]/5 cursor-pointer"
              : "border-[#e4e8ee] hover:border-[#2f5daa]/40 cursor-pointer"
        }`}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          multiple={maxFiles > 1}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <UploadCloud className={`h-6 w-6 mx-auto mb-2 ${atLimit ? "text-[#111827]/20" : "text-[#2f5daa]/60"}`} />
        <p className="text-sm font-utility text-[#111827]/60">
          {atLimit ? (
            "Maximum files reached"
          ) : (
            <>
              <span className="text-[#0e2a63] font-semibold">Click to upload</span> or drag and drop
            </>
          )}
        </p>
        <p className="mt-1 text-[11px] font-utility text-[#111827]/40">
          {acceptedTypesLabel} · up to {maxSizeMB}MB each · max {maxFiles} file{maxFiles === 1 ? "" : "s"}
        </p>
      </div>

      <AnimatePresence>
        {localError && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-2 flex items-center gap-1.5 text-[11px] text-red-500 font-utility"
          >
            <AlertCircle className="h-3 w-3 shrink-0" />
            {localError}
          </motion.p>
        )}
      </AnimatePresence>

      {files.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2.5">
          <AnimatePresence>
            {files.map((file, idx) => (
              <ThumbOrChip key={`${file.name}-${file.lastModified}-${idx}`} file={file} onRemove={() => removeAt(idx)} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
