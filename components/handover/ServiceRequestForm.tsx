'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Camera, ImagePlus, Loader2, X } from 'lucide-react'
import { PhotoPrepError, prepareImage } from '@/lib/associate/image-prep'
import type { ServiceFormCopy } from '@/lib/handover/form-copy'
import { MAX_DESCRIPTION, MAX_PHONE, serviceRequestProblem, type ServiceRequestInput } from '@/lib/handover/service-request-form'
import { fmt } from '@/lib/i18n/types'

interface Photo {
  id: number
  file: File
  url: string
}

const FIELD =
  'w-full rounded-xl border border-[#e4e8ee] bg-white px-3 py-2.5 text-base text-[#111827] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2f5daa] aria-[invalid=true]:border-red-500'
// The visible control is a <label> around a visually hidden file input, so the focus ring follows the input.
const BTN =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#e4e8ee] px-4 font-utility text-sm font-semibold text-[#0e2a63] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#2f5daa] has-[:disabled]:opacity-50'

/**
 * Raise a service request: category, description, optional phone and up to `maxPhotos` photos.
 * One form for staff, the owning associate and the customer; the words come in as `copy` and the
 * transport as `onSubmit`. Photos are shrunk / converted in the browser first (the server types
 * them by their bytes and strips location data).
 */
export default function ServiceRequestForm({
  copy,
  maxPhotos,
  onSubmit,
  describeError,
  showPhone = true,
}: {
  copy: ServiceFormCopy
  maxPhotos: number
  onSubmit: (input: ServiceRequestInput) => Promise<unknown>
  describeError: (err: unknown) => string
  showPhone?: boolean
}) {
  const id = useId()
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [phone, setPhone] = useState('')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [problem, setProblem] = useState<'category' | 'description' | 'phone' | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const nextId = useRef(1)
  const urls = useRef<string[]>([])
  const categoryRef = useRef<HTMLSelectElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const live = urls.current
    return () => live.forEach((u) => URL.revokeObjectURL(u))
  }, [])

  async function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    setPhotoError(null)
    setSent(false)
    setPreparing(true)
    const room = maxPhotos - photos.length
    const added: Photo[] = []
    try {
      for (const file of Array.from(list).slice(0, Math.max(0, room))) {
        try {
          const { file: prepared } = await prepareImage(file)
          const url = URL.createObjectURL(prepared)
          urls.current.push(url)
          added.push({ id: nextId.current++, file: prepared, url })
        } catch (err) {
          const code = err instanceof PhotoPrepError ? err.code : 'not_an_image'
          setPhotoError(code === 'heic_conversion_failed' ? copy.photoErrors.heicFailed : code === 'too_large' ? copy.photoErrors.tooLarge : copy.photoErrors.notAnImage)
        }
      }
      if (list.length > room) setPhotoError(fmt(copy.photoErrors.tooMany, { max: maxPhotos }))
    } finally {
      setPhotos((cur) => [...cur, ...added])
      setPreparing(false)
    }
  }

  function removePhoto(photo: Photo) {
    URL.revokeObjectURL(photo.url)
    urls.current = urls.current.filter((u) => u !== photo.url)
    setPhotos((cur) => cur.filter((p) => p.id !== photo.id))
    setPhotoError(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSent(false)
    const found = serviceRequestProblem({ category, description, contact_phone: phone })
    setProblem(found)
    if (found) {
      ;(found === 'category' ? categoryRef : found === 'description' ? descriptionRef : phoneRef).current?.focus()
      return
    }
    setBusy(true)
    try {
      await onSubmit({ category, description, contact_phone: phone, files: photos.map((p) => p.file) })
      photos.forEach((p) => URL.revokeObjectURL(p.url))
      urls.current = []
      setPhotos([])
      setCategory('')
      setDescription('')
      setPhone('')
      setSent(true)
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  const err = (k: 'category' | 'description' | 'phone') => (problem === k ? copy.errors[k] : null)

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4" aria-label={copy.submit}>
      <div>
        <label htmlFor={`${id}-category`} className="mb-1 block font-utility text-sm font-medium text-[#091c3c]">{copy.category} *</label>
        <select
          id={`${id}-category`}
          ref={categoryRef}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-invalid={err('category') ? true : undefined}
          aria-describedby={err('category') ? `${id}-category-err` : undefined}
          className={`${FIELD} min-h-[44px]`}
        >
          <option value="">{copy.categoryChoose}</option>
          {Object.entries(copy.categories).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
        {err('category') && <p id={`${id}-category-err`} role="alert" className="mt-1 font-utility text-sm text-red-700">{err('category')}</p>}
      </div>

      <div>
        <label htmlFor={`${id}-description`} className="mb-1 block font-utility text-sm font-medium text-[#091c3c]">{copy.description} *</label>
        <textarea
          id={`${id}-description`}
          ref={descriptionRef}
          rows={5}
          maxLength={MAX_DESCRIPTION}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-invalid={err('description') ? true : undefined}
          aria-describedby={`${id}-description-hint${err('description') ? ` ${id}-description-err` : ''}`}
          className={FIELD}
        />
        <p id={`${id}-description-hint`} className="mt-1 font-utility text-xs text-[#111827]/70">{copy.descriptionHint}</p>
        {err('description') && <p id={`${id}-description-err`} role="alert" className="mt-1 font-utility text-sm text-red-700">{err('description')}</p>}
      </div>

      {showPhone && (
        <div>
          <label htmlFor={`${id}-phone`} className="mb-1 block font-utility text-sm font-medium text-[#091c3c]">{copy.phone}</label>
          <input
            id={`${id}-phone`}
            ref={phoneRef}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={MAX_PHONE}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-invalid={err('phone') ? true : undefined}
            aria-describedby={`${id}-phone-hint${err('phone') ? ` ${id}-phone-err` : ''}`}
            className={`${FIELD} min-h-[44px]`}
          />
          <p id={`${id}-phone-hint`} className="mt-1 font-utility text-xs text-[#111827]/70">{copy.phoneHint}</p>
          {err('phone') && <p id={`${id}-phone-err`} role="alert" className="mt-1 font-utility text-sm text-red-700">{err('phone')}</p>}
        </div>
      )}

      <fieldset>
        <legend className="mb-1 font-utility text-sm font-medium text-[#091c3c]">{copy.photos}</legend>
        <p className="mb-2 font-utility text-xs text-[#111827]/70">{fmt(copy.photosHint, { max: maxPhotos })}</p>
        <div className="flex flex-wrap gap-2">
          <label className={`${BTN} cursor-pointer`}>
            <Camera className="h-4 w-4" aria-hidden="true" /> {copy.takePhoto}
            <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={photos.length >= maxPhotos || preparing} onChange={(e) => { void addFiles(e.target.files); e.target.value = '' }} />
          </label>
          <label className={`${BTN} cursor-pointer`}>
            <ImagePlus className="h-4 w-4" aria-hidden="true" /> {copy.choosePhoto}
            <input type="file" accept="image/*" multiple className="sr-only" disabled={photos.length >= maxPhotos || preparing} onChange={(e) => { void addFiles(e.target.files); e.target.value = '' }} />
          </label>
          {preparing && <Loader2 className="h-5 w-5 animate-spin self-center text-[#111827]/50" aria-hidden="true" />}
        </div>
        <p role="alert" className={photoError ? 'mt-2 font-utility text-sm text-red-700' : 'sr-only'}>{photoError}</p>
        {photos.length > 0 && (
          <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4" data-testid="photo-previews">
            {photos.map((p) => (
              <li key={p.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, not an optimisable asset */}
                <img src={p.url} alt="" className="aspect-square w-full rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(p)}
                  aria-label={fmt(copy.removePhoto, { name: p.file.name })}
                  className="absolute -right-1.5 -top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#091c3c] text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa]"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <p role="alert" className={error ? 'rounded-lg bg-red-50 px-3 py-2 font-utility text-sm text-red-700' : 'sr-only'}>{error}</p>
      <p role="status" className={sent ? 'rounded-lg bg-emerald-50 px-3 py-2 font-utility text-sm text-emerald-800' : 'sr-only'}>{sent ? copy.sent : ''}</p>
      <button type="submit" disabled={busy || preparing} className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#0e2a63] px-6 font-utility text-base font-semibold text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5daa] sm:w-auto">
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} {busy ? copy.submitting : copy.submit}
      </button>
    </form>
  )
}
