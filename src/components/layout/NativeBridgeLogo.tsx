import React from "react";

const NativeBridgeLogo = React.forwardRef<SVGSVGElement, { size?: number }>(
  ({ size = 28 }, ref) => (
    <svg ref={ref} width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Bridge arch */}
      <path
        d="M4 24 C4 14, 16 6, 28 24"
        stroke="hsl(217, 91%, 60%)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Bridge pillars */}
      <line x1="10" y1="18" x2="10" y2="26" stroke="hsl(217, 91%, 60%)" strokeWidth="2" strokeLinecap="round" />
      <line x1="22" y1="18" x2="22" y2="26" stroke="hsl(217, 91%, 60%)" strokeWidth="2" strokeLinecap="round" />
      {/* Road */}
      <line x1="2" y1="26" x2="30" y2="26" stroke="hsl(142, 76%, 45%)" strokeWidth="2" strokeLinecap="round" />
      {/* Mobile device on left */}
      <rect x="3" y="6" width="6" height="10" rx="1" stroke="hsl(210, 20%, 70%)" strokeWidth="1.2" fill="none" />
      <circle cx="6" cy="14" r="0.6" fill="hsl(210, 20%, 70%)" />
      {/* Code brackets on right */}
      <path d="M24 8 L21 11 L24 14" stroke="hsl(142, 76%, 45%)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M27 8 L30 11 L27 14" stroke="hsl(142, 76%, 45%)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
);

NativeBridgeLogo.displayName = "NativeBridgeLogo";

export default NativeBridgeLogo;
