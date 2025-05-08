import { Switch, Route } from "wouter";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import { socketProvider } from "@/lib/socket";
import { useEffect } from "react";

export default function App() {
  // Connect to WebSocket when app loads
  useEffect(() => {
    socketProvider.connect();
    return () => socketProvider.disconnect();
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <Switch>
        <Route path="/" component={HomePage} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}
