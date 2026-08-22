import { ReactNode } from "react";

/** Page title + subtitle, Supabase settings style. */
export const SettingsHeader = ({ title, description }: { title: string; description: string }) => (
  <div className="mb-8">
    <h1 className="text-xl font-normal text-foreground">{title}</h1>
    <p className="text-sm text-muted-foreground mt-1">{description}</p>
  </div>
);

export const SectionTitle = ({ children }: { children: ReactNode }) => (
  <h2 className="text-base font-normal text-foreground mb-3">{children}</h2>
);

/** Bordered card container used for every settings block. */
export const SettingsCard = ({ children, footer }: { children: ReactNode; footer?: ReactNode }) => (
  <div className="rounded-md border border-border bg-card/40 overflow-hidden">
    <div className="divide-y divide-border">{children}</div>
    {footer && (
      <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/20 px-5 py-3">
        {footer}
      </div>
    )}
  </div>
);

/** Two-column row: label/description on the left, control on the right. */
export const SettingsRow = ({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children?: ReactNode;
}) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 px-5 py-4 items-center">
    <div>
      <p className="text-sm text-foreground">{label}</p>
      {description && <p className="text-[13px] text-muted-foreground mt-0.5">{description}</p>}
    </div>
    <div className="md:justify-self-stretch">{children}</div>
  </div>
);

/** Uppercase micro label used above chart values. */
export const MetricLabel = ({ children, dot }: { children: ReactNode; dot?: string }) => (
  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
    {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />}
    {children}
  </div>
);

export const Tabs = ({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) => (
  <div className="flex items-center gap-5 border-b border-border mb-6">
    {tabs.map((t) => (
      <button
        key={t.id}
        onClick={() => onChange(t.id)}
        className={`-mb-px border-b-2 pb-2 text-[13px] transition-colors ${
          active === t.id
            ? "border-foreground text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        {t.label}
      </button>
    ))}
  </div>
);
