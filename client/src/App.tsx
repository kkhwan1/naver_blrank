import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/Dashboard";
import UrlAnalyzer from "@/pages/UrlAnalyzer";

function Router() {
  return (
    <Switch>
      <Route path="/" component={UrlAnalyzer} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/analyze" component={UrlAnalyzer} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
