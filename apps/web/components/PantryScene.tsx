import Image from "next/image";
import type { Messages } from "@/lib/i18n";
import { ArrowIcon, SearchIcon } from "./icons";

export function PantryScene({ copy, onSearch }: { copy: Messages; onSearch: (query: string) => void }) {
  return (
    <div className="pantry-scene">
      <div className="scene-orbit" aria-hidden="true" />
      <div className="scene-tile tile-breakfast">
        <button type="button" onClick={() => onSearch("Weetabix")} aria-label={`${copy.viewProducts}: Weetabix`}>
          <span className="tile-category">{copy.categoryCereal}</span>
          <Image src="/images/weetabix.jpg" alt="Weetabix" width={180} height={240} preload unoptimized />
          <span className="tile-bottom">Weetabix <ArrowIcon /></span>
        </button>
      </div>
      <div className="scene-tile tile-spread">
        <button type="button" onClick={() => onSearch("Nutella")} aria-label={`${copy.viewProducts}: Nutella`}>
          <span className="tile-category">{copy.categorySpreads}</span>
          <Image src="/images/nutella.jpg" alt="Nutella" width={210} height={230} preload unoptimized />
          <span className="tile-bottom">Nutella <ArrowIcon /></span>
        </button>
      </div>
      <div className="scene-label"><SearchIcon /><span>{copy.heroSticker}</span><span aria-hidden="true">↗</span></div>
      <div className="scene-caption"><span className="caption-line" aria-hidden="true" />{copy.heroCaption}</div>
      <div className="scene-index" aria-hidden="true">01 — 02 / FOODFINDER</div>
    </div>
  );
}
