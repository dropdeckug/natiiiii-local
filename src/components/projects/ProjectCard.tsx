import { formatDistanceToNow } from "date-fns";
import { Smartphone, Globe, Monitor, MoreVertical, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const engineLabels: Record<string, string> = {
  capacitor: "Capacitor",
  webview: "WebView",
  ionic: "Ionic",
  twa: "TWA",
  electron: "Electron",
};

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    framework: string;
    engine: string;
    platforms: string[];
    plan: string;
    created_at: string;
    updated_at: string;
  };
  onClick: () => void;
  onDelete?: () => void;
}

const ProjectCard = ({ project, onClick, onDelete }: ProjectCardProps) => {
  const platformIcons = {
    android: <Smartphone size={12} />,
    ios: <Smartphone size={12} />,
    web: <Globe size={12} />,
    desktop: <Monitor size={12} />,
  };

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col gap-3 rounded-[4px] border border-border bg-card p-4 cursor-pointer transition-all hover:border-primary/40 hover:bg-muted/30"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-muted text-sm font-medium text-foreground">
            {project.name[0]?.toUpperCase() || "P"}
          </div>
          <div>
            <h3 className="font-medium text-foreground text-sm leading-tight">
              {project.name}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {engineLabels[project.engine] || project.engine}
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            onClick={(e) => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-[3px] hover:bg-muted"
          >
            <MoreVertical size={14} className="text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-[4px]">
            {onDelete && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="text-destructive focus:text-destructive rounded-[3px]"
              >
                <Trash2 size={13} className="mr-2" />
                Delete project
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-1.5">
        {project.platforms.map((p) => (
          <Badge
            key={p}
            variant="secondary"
            className="text-[10px] px-1.5 py-0 gap-1 font-normal rounded-[3px]"
          >
            {platformIcons[p as keyof typeof platformIcons]}
            {p}
          </Badge>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Updated {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
      </p>
    </div>
  );
};

export default ProjectCard;
