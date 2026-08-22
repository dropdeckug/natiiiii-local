import * as React from "react";
import { cn } from "@/lib/utils";

export interface FloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: React.ReactNode;
  trailing?: React.ReactNode;
}

/**
 * Material-style floating-label input.
 * The label sits inside the field by default and animates onto the top
 * border when the field is focused or filled.
 */
export const FloatingInput = React.forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ label, hint, trailing, className, id: idProp, value, defaultValue, ...props }, ref) => {
    const reactId = React.useId();
    const id = idProp || reactId;
    return (
      <div className="space-y-1.5">
        <div className="relative">
          <input
            ref={ref}
            id={id}
            value={value}
            defaultValue={defaultValue}
            placeholder=" "
            {...props}
            className={cn(
              "peer block w-full bg-transparent rounded-xl border border-border/70 px-3.5 pt-5 pb-2 text-sm text-foreground outline-none transition-all",
              "focus:border-primary focus:ring-2 focus:ring-primary/15",
              "placeholder-transparent",
              trailing && "pr-10",
              className,
            )}
          />
          <label
            htmlFor={id}
            className={cn(
              "pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 px-1 text-sm text-muted-foreground transition-all",
              "peer-focus:top-0 peer-focus:text-[11px] peer-focus:text-primary peer-focus:bg-background",
              "peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:bg-background",
            )}
          >
            {label}
          </label>
          {trailing && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-muted-foreground">
              {trailing}
            </div>
          )}
        </div>
        {hint && <p className="text-[11px] text-muted-foreground/80 px-1">{hint}</p>}
      </div>
    );
  },
);
FloatingInput.displayName = "FloatingInput";
