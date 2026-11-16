import { type ReactNode, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkspaceLayout } from "@/components/WorkspaceLayout";
import DashboardPage from "@/pages/dashboard";
import TransactionsPage from "@/pages/transactions";
import ReviewPage from "@/pages/review";
import SharedVouchersPage from "@/pages/shared-vouchers";
import AgentsPage from "@/pages/agents";
import ExportPage from "@/pages/export";
import NotFound from "@/pages/not-found";
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from "wouter";
import { WorkspaceProvider } from "@/lib/workspace-context";

const queryClient = new QueryClient();

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function AppRoutes() {
  return (
    <RoutedErrorBoundary>
      <WorkspaceLayout>
        <Switch>
          <Route path="/" component={DashboardPage} />
          <Route path="/transactions" component={TransactionsPage} />
          <Route path="/review" component={ReviewPage} />
          <Route path="/shared" component={SharedVouchersPage} />
          <Route path="/agents" component={AgentsPage} />
          <Route path="/export" component={ExportPage} />
          <Route component={NotFound} />
        </Switch>
      </WorkspaceLayout>
    </RoutedErrorBoundary>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <WorkspaceProvider>
            <AppRoutes />
          </WorkspaceProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
