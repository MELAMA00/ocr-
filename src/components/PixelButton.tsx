'use client'

import React from 'react'

type Variant = 'primary' | 'outline'

export function pixelButtonClass(variant: Variant = 'outline') {
  const base = [
    'inline-flex items-center justify-center select-none',
    'h-9 rounded-md border-2 px-4 py-0 text-sm font-semibold leading-none',
    'transition-colors disabled:opacity-50 disabled:pointer-events-none',
    'shadow-[0_4px_0_rgba(0,0,0,0.75)] active:translate-y-[2px] active:shadow-[0_2px_0_rgba(0,0,0,0.75)]',
    'font-[family-name:var(--font-silkscreen)] tracking-widest',
  ]
  if (variant === 'primary') {
    return [
      ...base,
      'bg-blue-600 border-blue-800 text-white hover:bg-blue-700',
    ].join(' ')
  }
  return [
    ...base,
    'bg-white border-neutral-900 text-neutral-900 hover:bg-neutral-100',
  ].join(' ')
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
}

export default function PixelButton({ variant = 'outline', className = '', ...props }: ButtonProps) {
  return <button className={[pixelButtonClass(variant), className].join(' ')} {...props} />
}
