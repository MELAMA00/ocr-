'use client'

import React from 'react'

type Props = {
  title?: string
  className?: string
  children: React.ReactNode
}

export default function RetroWindow({ title, className = '', children }: Props) {
  return (
    <div
      className={[
        'rounded-2xl border-4 border-blue-600 bg-white',
        'shadow-[0_8px_0_#1e3a8a] overflow-hidden',
        className,
      ].join(' ')}
    >
      <div className="relative bg-blue-600 text-white px-4 py-2">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-400 border border-red-600" />
          <span className="w-3 h-3 rounded-full bg-yellow-300 border border-yellow-600" />
          <span className="w-3 h-3 rounded-full bg-green-400 border border-green-600" />
        </div>
        <div className="text-center font-bold tracking-widest font-[family-name:var(--font-silkscreen)]">
          {title || ''}
        </div>
      </div>
      <div className="p-4 sm:p-5 bg-gradient-to-b from-blue-50/40 to-transparent">{children}</div>
    </div>
  )
}

