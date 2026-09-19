export function SearchSkeleton() {
  return <div className="product-grid" aria-hidden="true">{[0, 1, 2].map((item) => <div key={item} className="product-card"><div className="skeleton skeleton-image"/><div className="space-y-4 p-6"><div className="skeleton h-3 w-20"/><div className="skeleton h-6 w-3/4"/><div className="skeleton h-16"/></div></div>)}</div>;
}
