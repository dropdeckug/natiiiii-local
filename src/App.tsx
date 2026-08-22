import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/hooks/useTheme";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Projects from "./pages/Projects";
import ProjectDashboard from "./pages/ProjectDashboard";
import CreateProject from "./pages/CreateProject";
import Pricing from "./pages/Pricing";
import Docs from "./pages/Docs";
import About from "./pages/About";
import MarketingPage from "./pages/MarketingPage";
import GitHubCallback from "./pages/GitHubCallback";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/project/new" element={<CreateProject />} />
            <Route path="/project/:id" element={<ProjectDashboard />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/about" element={<About />} />
            <Route path="/product/:slug" element={<MarketingPage />} />
            <Route path="/solutions/:slug" element={<MarketingPage />} />
            <Route path="/resources/:slug" element={<MarketingPage />} />
            <Route path="/auth/github/callback" element={<GitHubCallback />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
