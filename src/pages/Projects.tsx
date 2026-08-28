import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, LogOut, Layers, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import ProjectCard from "@/components/projects/ProjectCard";
import CreateProjectWizard from "@/components/projects/CreateProjectWizard";
import NativeBridgeLogo from "@/components/layout/NativeBridgeLogo";

interface ProjectItem {
  id: string;
  name: string;
  framework: string;
  engine: string;
  platforms: string[];
  plan: string;
  created_at: string;
  updated_at: string;
}

const Projects = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUserEmail(session.user.email || "Developer");

      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) {
        console.warn("Could not fetch projects from database:", error);
      } else if (data) {
        setProjects(
          data.map((p: any) => ({
            id: p.id,
            name: p.name || "Untitled Project",
            framework: p.framework || "react",
            engine: p.engine || "capacitor",
            platforms: p.platforms || ["android"],
            plan: p.plan || "free",
            created_at: p.created_at || new Date().toISOString(),
            updated_at: p.updated_at || new Date().toISOString(),
          }))
        );
      }
    } catch (err: any) {
      console.warn("Error fetching projects:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", projectId);

      if (error) throw error;
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      toast.success("Project deleted");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete project");
    }
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-md px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <NativeBridgeLogo size={28} />
            <span className="text-base font-bold tracking-tight text-foreground">NativeBridge</span>
          </Link>
          <span className="text-muted-foreground text-xs">/</span>
          <span className="text-xs font-medium text-muted-foreground">Projects</span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/docs"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            Docs <ExternalLink size={12} />
          </Link>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {userEmail}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="text-xs text-muted-foreground hover:text-foreground h-8 px-2.5"
          >
            <LogOut size={13} className="mr-1.5" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Your Projects</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage your apps, build pipelines, and store signing keys
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <Button
              onClick={() => setWizardOpen(true)}
              className="gap-2 h-9 px-4 font-semibold shrink-0"
            >
              <Plus size={16} />
              New Project
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-card border-border text-xs"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchProjects}
            className="h-9 px-3 text-xs border-border"
          >
            <RefreshCw size={13} className="mr-1.5" />
            Refresh
          </Button>
        </div>

        {/* Grid or Empty State */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-9 h-9 rounded" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </div>
        ) : filteredProjects.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((proj) => (
              <ProjectCard
                key={proj.id}
                project={proj}
                onClick={() => navigate(`/project/${proj.id}`)}
                onDelete={() => handleDeleteProject(proj.id)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 text-primary">
              <Layers size={28} />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">
              {search ? "No matching projects" : "No projects yet"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              {search
                ? `No project found matching "${search}". Try a different search term.`
                : "Create your first project to convert your web application into a native mobile app."}
            </p>
            <Button onClick={() => setWizardOpen(true)} className="gap-2">
              <Plus size={16} />
              Create Project
            </Button>
          </div>
        )}
      </main>

      <CreateProjectWizard
        open={wizardOpen}
        onClose={() => {
          setWizardOpen(false);
          fetchProjects();
        }}
      />
    </div>
  );
};

export default Projects;
