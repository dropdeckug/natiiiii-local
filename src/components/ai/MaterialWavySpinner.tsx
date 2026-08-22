import type { ReactNode } from "react";

/**
 * Google's Material Design circular indeterminate progress spinner.
 *
 * This is the canonical Material spinner geometry (66x66 viewBox, r=29.5,
 * circumference 187) with Google's two-part indeterminate motion:
 *   1. the whole SVG rotates 270deg per cycle (`rotator`)
 *   2. the arc grows/shrinks via stroke-dashoffset while rotating (`dash`)
 *   3. the stroke cycles through the four Google brand colors over 4 cycles
 *
 * Rendered at any size via the `size` prop; a slotted child (typically
 * <AiMark />) sits centered inside the ring.
 *
 * Animation classes live in src/index.css (`.g-spinner-*`).
 */
interface MaterialWavySpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  children?: ReactNode;
  /** Use Google brand colors (default) or the app's primary color. */
  brandColors?: boolean;
}

const SIZES: Record<"sm" | "md" | "lg", { box: number; stroke: number; inner: number }> = {
  sm: { box: 22, stroke: 6, inner: 11 },
  md: { box: 28, stroke: 6, inner: 15 },
  lg: { box: 40, stroke: 5.5, inner: 21 },
};

const MaterialWavySpinner = ({
  size = "sm",
  className = "",
  children,
  brandColors = true,
}: MaterialWavySpinnerProps) => {
  const { box, stroke, inner } = SIZES[size];

  return (
    <span
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: box, height: box }}
      role="progressbar"
      aria-label="Working"
    >
      <svg
        className="g-spinner absolute inset-0"
        width={box}
        height={box}
        viewBox="0 0 66 66"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          className={brandColors ? "g-spinner-path g-spinner-colors" : "g-spinner-path text-primary"}
          fill="none"
          stroke={brandColors ? undefined : "currentColor"}
          strokeWidth={stroke}
          strokeLinecap="round"
          cx="33"
          cy="33"
          r="29.5"
        />
      </svg>
      <span
        className="relative inline-flex items-center justify-center text-foreground/90"
        style={{ width: inner, height: inner }}
      >
        {children}
      </span>
    </span>
  );
};

export default MaterialWavySpinner;
