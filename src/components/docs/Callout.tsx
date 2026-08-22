import { Info, AlertTriangle, Lightbulb, AlertCircle } from "lucide-react";

interface CalloutProps {
  type?: "info" | "warning" | "tip" | "danger";
  title?: string;
  children: React.ReactNode;
}

const styles = {
  info: { border: "border-blue-500/30", bg: "bg-blue-500/5", icon: Info, iconColor: "text-blue-400", titleColor: "text-blue-300" },
  warning: { border: "border-yellow-500/30", bg: "bg-yellow-500/5", icon: AlertTriangle, iconColor: "text-yellow-400", titleColor: "text-yellow-300" },
  tip: { border: "border-emerald-500/30", bg: "bg-emerald-500/5", icon: Lightbulb, iconColor: "text-emerald-400", titleColor: "text-emerald-300" },
  danger: { border: "border-red-500/30", bg: "bg-red-500/5", icon: AlertCircle, iconColor: "text-red-400", titleColor: "text-red-300" },
};

const Callout = ({ type = "info", title, children }: CalloutProps) => {
  const s = styles[type];
  const Icon = s.icon;

  return (
    <div className={`rounded-lg border-l-4 ${s.border} ${s.bg} p-4 my-4`}>
      <div className="flex items-start gap-3">
        <Icon size={18} className={`${s.iconColor} mt-0.5 shrink-0`} />
        <div className="min-w-0">
          {title && <p className={`text-sm font-semibold ${s.titleColor} mb-1`}>{title}</p>}
          <div className="text-sm text-[#a1a1aa] leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  );
};

export default Callout;
