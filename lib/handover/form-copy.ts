// The words of the "raise a service request" form. The associate portal supplies translated copy
// from messages/*.json (associates.portal.handover.form); the staff dashboard and the customer
// page use the English constant below.

export interface ServiceFormCopy {
  category: string
  categoryChoose: string
  categories: Record<string, string>
  description: string
  descriptionHint: string
  phone: string
  phoneHint: string
  photos: string
  photosHint: string // "Up to {max} photos"
  takePhoto: string
  choosePhoto: string
  removePhoto: string // "Remove photo {name}"
  photoErrors: { notAnImage: string; heicFailed: string; tooLarge: string; tooMany: string }
  submit: string
  submitting: string
  sent: string
  errors: { category: string; description: string; phone: string }
}

export const ENGLISH_SERVICE_FORM_COPY: ServiceFormCopy = {
  category: 'What is the problem?',
  categoryChoose: 'Choose…',
  categories: {
    no_generation: 'The system is not generating',
    inverter_error: 'Inverter shows an error',
    physical_damage: 'Physical damage',
    cleaning_om: 'Cleaning or maintenance',
    other: 'Something else',
  },
  description: 'Describe the problem',
  descriptionHint: 'Up to 2000 characters. Say what you see and when it started.',
  phone: 'Phone number to reach you (optional)',
  phoneHint: 'So the service team can call you back.',
  photos: 'Photos (optional)',
  photosHint: 'Up to {max} photos.',
  takePhoto: 'Take a photo',
  choosePhoto: 'Choose from phone',
  removePhoto: 'Remove photo {name}',
  photoErrors: {
    notAnImage: 'That file is not a photo. Use JPEG, PNG or WEBP.',
    heicFailed: 'That photo could not be converted. Try another one.',
    tooLarge: 'That photo is too large.',
    tooMany: 'You can attach up to {max} photos.',
  },
  submit: 'Send service request',
  submitting: 'Sending…',
  sent: 'Your service request was sent.',
  errors: {
    category: 'Choose what the problem is.',
    description: 'Describe the problem in up to 2000 characters.',
    phone: 'The phone number is too long.',
  },
}
