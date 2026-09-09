import type { Messages } from "@/lib/i18n";
import type { NutritionInfo, Product } from "@/lib/types";
import { ArrowIcon, LockIcon } from "./icons";
import { ProductImage } from "./ProductImage";

type Props = { product: Product; copy: Messages; checkoutLoading: boolean; onSubscribe: () => void };
const nutritionRows: Array<{ key: keyof NutritionInfo; label: keyof Messages; unit: "kcal" | "g" }> = [
  { key: "energyKcal100g", label: "energy", unit: "kcal" }, { key: "fat100g", label: "fat", unit: "g" },
  { key: "saturatedFat100g", label: "saturatedFat", unit: "g" }, { key: "carbohydrates100g", label: "carbohydrates", unit: "g" },
  { key: "sugars100g", label: "sugars", unit: "g" }, { key: "protein100g", label: "protein", unit: "g" }, { key: "salt100g", label: "salt", unit: "g" },
];

export function ProductCard({ product, copy, checkoutLoading, onSubscribe }: Props) {
  return (
    <article className="overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-[var(--surface)] shadow-[0_12px_36px_rgba(18,61,43,0.06)]">
      <ProductImage key={product.imageUrl} src={product.imageUrl} alt={product.name} unavailableLabel={copy.noImage} />
      <div className="p-5 sm:p-6">
        <p className="font-mono text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--accent-dark)]">{product.code || "—"}</p>
        <h2 className="mt-2 text-xl font-semibold leading-7 tracking-[-0.03em]">{product.name}</h2>
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--line)] pt-4 text-sm">
          <div><dt className="text-[var(--muted)]">{copy.brand}</dt><dd className="mt-1 font-medium">{product.brand ?? copy.brandUnavailable}</dd></div>
          <div><dt className="text-[var(--muted)]">{copy.quantity}</dt><dd className="mt-1 font-medium">{product.quantity ?? copy.quantityUnavailable}</dd></div>
        </dl>
        {product.nutrition ? (
          <section className="mt-5 rounded-2xl bg-[var(--forest)] p-4 text-white" aria-label={copy.nutritionPer100g}>
            <h3 className="mb-3 text-sm font-semibold">{copy.nutritionPer100g}</h3>
            {product.nutritionAvailable ? <dl className="divide-y divide-white/15">{nutritionRows.map((row) => {
              const value = product.nutrition?.[row.key];
              return <div key={row.key} className="flex items-center justify-between gap-4 py-2 text-sm"><dt className="text-white/72">{copy[row.label]}</dt><dd className="text-right font-medium">{value == null ? copy.unavailable : `${value} ${row.unit}`}</dd></div>;
            })}</dl> : <p className="text-sm leading-6 text-white/70">{copy.nutritionUnavailable}</p>}
          </section>
        ) : (
          <section className="mt-5 rounded-2xl border border-[#edc6b8] bg-[#fff4ef] p-4">
            <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-[var(--accent-dark)]"><LockIcon className="size-4" /></span><div><h3 className="text-sm font-semibold">{copy.unlockNutrition}</h3><p className="mt-1 text-sm leading-5 text-[var(--muted)]">{copy.unlockDescription}</p></div></div>
            <button type="button" onClick={onSubscribe} disabled={checkoutLoading} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--forest)] disabled:cursor-wait disabled:opacity-60">{checkoutLoading ? copy.subscriptionProcessing : copy.subscribe}{!checkoutLoading && <ArrowIcon />}</button>
          </section>
        )}
      </div>
    </article>
  );
}
