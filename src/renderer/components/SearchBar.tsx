import React from 'react'

interface Props {
  value: string
  onChange: (v: string) => void
}

export default function SearchBar({ value, onChange }: Props) {
  return (
    <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 flex items-center gap-3">
      <div className="relative w-64">
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search..."
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-gray-700 text-gray-100 rounded pl-8 pr-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>
  )
}
