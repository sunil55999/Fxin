import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/theme-provider";
import Navigation from "@/components/Navigation";
import Home from "@/pages/Home";
import Plans from "@/pages/Plans";
import SoloChannels from "@/pages/SoloChannels";
import Exness from "@/pages/Exness";
import Admin from "@/pages/Admin";
import MiniApp from "@/pages/MiniApp";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/plans" component={Plans} />
        <Route path="/solo" component={SoloChannels} />
        <Route path="/exness" component={Exness} />
        <Route path="/admin" component={Admin} />
        <Route path="/miniapp" component={MiniApp} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="telegram-pro-theme">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
