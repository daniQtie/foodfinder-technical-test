import type { Language, Messages } from "@/lib/i18n";
import type { NutritionInfo, Product } from "@/lib/types";
import { ArrowIcon, LockIcon } from "./icons";
import { ProductImage } from "./ProductImage";

type Props = { product: Product; copy: Messages; language: Language; checkoutLoading: boolean; onSubscribe: () => void };
const nutritionRows: Array<{ key: keyof NutritionInfo; label: keyof Messages; unit: "kcal" | "g" }> = [
  { key: "energyKcal100g", label: "energy", unit: "kcal" }, { key: "fat100g", label: "fat", unit: "g" },
  { key: "saturatedFat100g", label: "saturatedFat", unit: "g" }, { key: "carbohydrates100g", label: "carbohydrates", unit: "g" },
  { key: "sugars100g", label: "sugars", unit: "g" }, { key: "protein100g", label: "protein", unit: "g" }, { key: "salt100g", label: "salt", unit: "g" },
];

export function ProductCard({ product, copy, language, checkoutLoading, onSubscribe }: Props) {
  const numberFormat = new Intl.NumberFormat(language, { maximumFractionDigits: 3 });
  return (
    <article className="product-card">
      <ProductImage key={product.imageUrl} src={product.imageUrl} alt={product.name} copy={copy} />
      <div className="product-content">
        <p className="product-code">{product.code || "—"}</p>
        <h3>{product.name}</h3>
        <dl className="product-meta">
          <div><dt className="text-[var(--muted)]">{copy.brand}</dt><dd className="mt-1 font-medium">{product.brand ?? copy.brandUnavailable}</dd></div>
          <div><dt className="text-[var(--muted)]">{copy.quantity}</dt><dd className="mt-1 font-medium">{product.quantity ?? copy.quantityUnavailable}</dd></div>
        </dl>
        {product.nutrition ? (
          <section className="nutrition-panel" aria-label={copy.nutritionPer100g}>
            <div className="nutrition-heading"><h4>{copy.nutritionPer100g}</h4><span>100 g</span></div>
            {product.nutritionAvailable ? <dl>{nutritionRows.map((row) => {
              const value = product.nutrition?.[row.key];
              return <div key={row.key} className="nutrition-row"><dt>{copy[row.label]}</dt><dd>{value == null ? copy.unavailable : `${numberFormat.format(value)} ${row.unit}`}</dd></div>;
            })}</dl> : <p className="nutrition-missing">{copy.nutritionUnavailable}</p>}
          </section>
        ) : (
          <section className="nutrition-locked">
            <div className="locked-heading"><LockIcon/><h4>{copy.unlockNutrition}</h4></div><p>{copy.unlockDescription}</p>
            <button type="button" onClick={onSubscribe} disabled={checkoutLoading} className="button button-forest">{checkoutLoading ? copy.subscriptionProcessing : copy.subscribe}{!checkoutLoading && <ArrowIcon />}</button>
          </section>
        )}
      </div>
    </article>
  );
}
