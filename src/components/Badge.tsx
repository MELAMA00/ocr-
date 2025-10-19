'use client'

import React from 'react'

type Props = {
  children: React.ReactNode
  className?: string
}

export default function Badge({ children, className = '' }: Props) {
  return (
    <span
      className={[
        'inline-block rounded-md border-2 border-neutral-900 bg-white px-2 py-0.5 text-xs',
        'font-[family-name:var(--font-silkscreen)] tracking-widest',
        className,
      ].join(' ')}
    >
      {children}
    </span>
  )
}

