import { type ReactNode } from 'react'

export function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      {children}
    </svg>
  )
}

export const Icons = {
  lab: (
    <Icon>
      <path d="M9 3h6M10 3v6L5 20h14L14 9V3" />
    </Icon>
  ),
  notes: (
    <Icon>
      <rect x="5" y="4" width="14" height="16" rx="1.5" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </Icon>
  ),
  calc: (
    <Icon>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8 8h8M8 13h2M12 13h2M16 13h0M8 17h2M12 17h2M16 17h0" />
    </Icon>
  ),
  review: (
    <Icon>
      <circle cx="12" cy="12" r="8" />
      <path d="M8 12.5l2.5 2.5L16 9" />
    </Icon>
  ),
  flag: (
    <Icon>
      <path d="M6 21V4m0 0h10l-2 4 2 4H6" />
    </Icon>
  ),
  close: (
    <Icon>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  )
}
