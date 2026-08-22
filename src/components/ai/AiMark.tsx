/**
 * AiMark — small NativeBridge "AI" glyph used wherever the agent needs an icon.
 * Replaces the old Lucide `Sparkles` (star) representation. Pure SVG, themed
 * with `currentColor` so callers control the color via Tailwind text classes.
 */
interface AiMarkProps {
  size?: number;
  className?: string;
}

const AiMark = ({ size = 14, className = "" }: AiMarkProps) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Stylised "A" — three strokes that read as an AI mark, never a star. */}
      <path d="M5 20 L12 4 L19 20" />
      <path d="M8 14 L16 14" />
    </svg>
  );
};

export default AiMark;
