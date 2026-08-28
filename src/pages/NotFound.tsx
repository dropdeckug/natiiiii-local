import { Link } from "react-router-dom";
import { ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 text-center">
      <div className="space-y-4 max-w-md">
        <h1 className="text-6xl font-extrabold text-foreground tracking-tight">404</h1>
        <h2 className="text-xl font-semibold text-foreground">Page not found</h2>
        <p className="text-sm text-muted-foreground">
          Sorry, we couldn't find the page you're looking for. It might have been moved or deleted.
        </p>
        <div className="pt-2 flex items-center justify-center gap-3">
          <Button asChild variant="default" className="gap-2">
            <Link to="/">
              <Home size={15} />
              Return Home
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/projects">
              <ArrowLeft size={15} />
              Go to Projects
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
