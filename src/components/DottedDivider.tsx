'use client'

import React from 'react'

export default function DottedDivider({ className = '' }: { className?: string }) {
  return (
    <div
      className={[
        'w-full h-[2px] bg-[radial-gradient(currentColor_1px,transparent_1px)] bg-[length:6px_2px] text-neutral-300',
        className,
      ].join(' ')}
      aria-hidden
    />
  )
}

