import type { CaptureMethod } from './onboarding-types'

// A photo ready to upload: already prepared (shrunk / converted) and carrying
// how it was taken. Camera photos carry the GPS reading; gallery photos don't.
export interface CapturedPhoto {
  file: File
  capture_method: CaptureMethod
  latitude?: number
  longitude?: number
  captured_at: string
  accuracy_m?: number
  exif_taken_at_client?: string
}

export type PhotoUploadStatus = 'uploading' | 'waiting' | 'success' | 'error'
