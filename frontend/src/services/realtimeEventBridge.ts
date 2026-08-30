import { QueryClient } from "@tanstack/react-query";
import { realtimeEventsService } from "./realtimeEvents.service";

/**
 * RealtimeEventBridge
 *
 * Single canonical bridge between Server-Sent Events (SSE) / BroadcastChannel
 * and TanStack Query's QueryClient.
 * Replaces fragmented per-hook subscriptions with a single event listener.
 */
export function setupRealtimeEventBridge(queryClient: QueryClient): () => void {
  return realtimeEventsService.subscribeEvents((event) => {
    const type = event.type || "";

    if (type.startsWith("employee.") || type.startsWith("seat.")) {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["designations"] });
    } else if (type.startsWith("attendance.")) {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["attendanceMatrix"] });
    } else if (type.startsWith("leave.")) {
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      queryClient.invalidateQueries({ queryKey: ["leaveEvents"] });
      queryClient.invalidateQueries({ queryKey: ["leaveTypes"] });
    } else if (type.startsWith("payroll.") || type.startsWith("salary.")) {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
    } else if (type.startsWith("company.")) {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["subscriptionStats"] });
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["designations"] });
    } else if (type.startsWith("plan.")) {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
    } else if (type.startsWith("invoice.")) {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["subscriptionStats"] });
    } else if (type.startsWith("ticket.")) {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    } else if (type.startsWith("recruitment.")) {
      queryClient.invalidateQueries({ queryKey: ["recruitmentOverview"] });
    } else if (type.startsWith("announcement.") || type.startsWith("notice.")) {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    } else if (type.startsWith("audit.")) {
      queryClient.invalidateQueries({ queryKey: ["auditLogs"] });
    } else if (type.startsWith("performance.")) {
      queryClient.invalidateQueries({ queryKey: ["performance"] });
    } else if (type.startsWith("device.")) {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    } else if (type.startsWith("zone.")) {
      queryClient.invalidateQueries({ queryKey: ["zones"] });
    }
  });
}
