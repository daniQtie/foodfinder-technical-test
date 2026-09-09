export function SearchSkeleton() {
  return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">{[0, 1, 2].map((item) => <div key={item} className="overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-white"><div className="h-52 animate-pulse bg-[#e4e9df]" /><div className="space-y-3 p-6"><div className="h-3 w-20 animate-pulse rounded bg-[#e4e9df]" /><div className="h-6 w-3/4 animate-pulse rounded bg-[#d8dfd5]" /><div className="h-16 animate-pulse rounded-xl bg-[#edf0e8]" /></div></div>)}</div>;
}
