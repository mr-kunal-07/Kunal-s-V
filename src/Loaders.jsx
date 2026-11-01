export function VaultLoader() {
  return <div className="vault-boot" role="status" aria-live="polite" aria-label="Opening Kunal’s Vault">
    <div className="vault-loader-mark" aria-hidden="true"><svg viewBox="0 0 64 64" fill="none"><rect x="10" y="7" width="46" height="50" rx="5" /><path d="M6 18h8M6 46h8" /><g className="vault-loader-wheel"><circle cx="33" cy="32" r="12" /><circle cx="33" cy="32" r="3" /><path d="M33 15v11M33 38v11M16 32h11M39 32h11" /></g></svg></div>
    <h1>Kunal’s Vault</h1><p>Unlocking your memories<span className="vault-loading-dots" aria-hidden="true">…</span></p>
    <div className="vault-loading-track" aria-hidden="true"><span /></div>
  </div>
}
export function CollectionSkeleton({ view = 'grid' }) {
  return <div role="status" aria-label="Loading your memories" aria-busy="true"><span className="visually-hidden">Loading your memories…</span><div className={`memory-collection ${view} skeleton-collection`} aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <div key={index} className="skeleton-card"><div className="skeleton-art skeleton-shimmer" /><div className="skeleton-copy"><div className="skeleton-line skeleton-shimmer" /><div className="skeleton-line short skeleton-shimmer" /></div></div>)}</div></div>
}
export function PreviewSkeleton() {
  return <div className="preview-skeleton" role="status" aria-label="Loading file preview" aria-busy="true"><span className="visually-hidden">Loading preview…</span><div className="skeleton-art skeleton-shimmer" aria-hidden="true" /><div className="skeleton-line skeleton-shimmer" aria-hidden="true" /><div className="skeleton-line short skeleton-shimmer" aria-hidden="true" /></div>
}
