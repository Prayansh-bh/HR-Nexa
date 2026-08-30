import "./i18n";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { setupRealtimeEventBridge } from "./services/realtimeEventBridge";

export const queryClient = new QueryClient();
setupRealtimeEventBridge(queryClient);

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
