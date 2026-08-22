interface BeeswarmDotProps {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  dimmed: boolean;
  hovered: boolean;
  selected: boolean;
  label: string;
  onEnter: () => void;
  onLeave: () => void;
  onSelect: () => void;
}

export function BeeswarmDot({
  cx,
  cy,
  r,
  fill,
  dimmed,
  hovered,
  selected,
  label,
  onEnter,
  onLeave,
  onSelect,
}: BeeswarmDotProps) {
  return (
    <circle
      cx={cx}
      cy={cy - (hovered ? 3 : 0)}
      r={r}
      fill={fill}
      role="button"
      tabIndex={0}
      aria-label={label}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className="cursor-pointer outline-none"
      style={{
        opacity: dimmed ? 0.28 : hovered || selected ? 1 : 0.88,
        transition: "opacity 220ms ease, cy 180ms ease",
      }}
    />
  );
}