import type { CoinDesign } from "@/lib/tokens";

/** A drawn coin face that mirrors what was engraved, so the page feels like the coin in your hand. */
export default function CoinEmblem({ design, label }: { design: CoinDesign; label: string }) {
  return (
    <div className="coin-face" role="img" aria-label={label}>
      <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">
        <circle cx="60" cy="60" r="56" className="coin-rim" />
        <circle cx="60" cy="60" r="48" className="coin-inner" />
        <g className="coin-mark">{mark(design)}</g>
      </svg>
    </div>
  );
}

function mark(design: CoinDesign) {
  switch (design) {
    case "flower":
      return (
        <>
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <ellipse key={deg} cx="60" cy="42" rx="9" ry="16" transform={`rotate(${deg} 60 60)`} />
          ))}
          <circle cx="60" cy="60" r="8" className="coin-center" />
        </>
      );
    case "cross":
      return (
        <>
          <rect x="54" y="26" width="12" height="68" rx="2" />
          <rect x="38" y="44" width="44" height="12" rx="2" />
        </>
      );
    case "heart":
      return <path d="M60 88 C 30 66, 30 38, 48 36 C 55 35, 59 40, 60 45 C 61 40, 65 35, 72 36 C 90 38, 90 66, 60 88 Z" />;
    case "sun":
      return (
        <>
          <circle cx="60" cy="60" r="15" />
          {Array.from({ length: 12 }, (_, i) => i * 30).map((deg) => (
            <rect key={deg} x="58" y="25" width="4" height="12" rx="2" transform={`rotate(${deg} 60 60)`} />
          ))}
        </>
      );
    case "leaf":
      return (
        <>
          <path d="M60 28 C 86 44, 86 76, 60 92 C 34 76, 34 44, 60 28 Z" />
          <path d="M60 36 L60 90" className="coin-vein" />
        </>
      );
    default:
      return <circle cx="60" cy="60" r="6" />;
  }
}
