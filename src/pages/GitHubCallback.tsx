import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useProjectStore } from "@/stores/projectStore";

const GitHubCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const setGithubAccessToken = useProjectStore((s) => s.setGithubAccessToken);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (session) {
          if (session.provider_token) {
            setGithubAccessToken(session.provider_token);
          }
          toast.success("Successfully authenticated with GitHub");
          navigate("/projects", { replace: true });
        } else {
          // Wait for auth state change
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_IN" && session) {
              if (session.provider_token) {
                setGithubAccessToken(session.provider_token);
              }
              toast.success("Successfully authenticated with GitHub");
              navigate("/projects", { replace: true });
            }
          });
          return () => subscription.unsubscribe();
        }
      } catch (err: any) {
        console.error("Auth callback error:", err);
        setError(err?.message || "Failed to complete authentication");
        toast.error(err?.message || "Authentication failed");
        setTimeout(() => navigate("/auth", { replace: true }), 2500);
      }
    };

    handleAuthCallback();
  }, [navigate, setGithubAccessToken]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      {error ? (
        <div className="text-center space-y-3">
          <p className="text-destructive font-medium">{error}</p>
          <p className="text-xs text-muted-foreground">Redirecting to login...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">Completing authentication...</p>
        </div>
      )}
    </div>
  );
};

export default GitHubCallback;
