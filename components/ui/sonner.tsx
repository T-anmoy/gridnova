'use client'

import { Toaster as Sonner } from 'sonner'
import type { ComponentProps } from 'react'

type ToasterProps = ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-white group-[.toaster]:text-[#111827] group-[.toaster]:border-[#e4e8ee] group-[.toaster]:shadow-lg font-utility',
          description: 'group-[.toast]:text-[#111827]/65',
          actionButton: 'group-[.toast]:bg-[#f7a800] group-[.toast]:text-[#091c3c]',
          cancelButton: 'group-[.toast]:bg-[#f7f9fc] group-[.toast]:text-[#111827]',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
