'use client'

export default function BotonHub() {
  return (
    <a href="/hub"
      style={{
        fontSize: '12px',
        color: 'rgba(255,255,255,0.8)',
        fontWeight: 600,
        textDecoration: 'none',
        background: 'rgba(255,255,255,0.08)',
        padding: '6px 14px',
        borderRadius: '7px',
        border: '1px solid rgba(255,255,255,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}
      onMouseEnter={(e: any) => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)' }}
      onMouseLeave={(e: any) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.7"/>
        <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.7"/>
        <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.7"/>
        <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.7"/>
      </svg>
      Menú principal
    </a>
  )
}