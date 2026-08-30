/**
 * realtimeEvents.service.ts
 *
 * Real-Time Event System using Server-Sent Events (SSE) & BroadcastChannel.
 * Provides multi-user, multi-tab real-time synchronization with automatic
 * reconnection, query cache invalidation hooks, and token-based SSE authentication.
 */

import { BASE_API } from "../config/api";
import { OWNER_STORAGE_KEYS } from "../config/storage";
import axiosInstance from "../api/axios";

export type ConnectionStatus = "connected" | "reconnecting" | "offline";

type EventCallback = (event: { type: string; payload: any; timestamp: string }) => void;
type StatusCallback = (status: ConnectionStatus) => void;

class RealtimeEventsService {
  private eventSource: EventSource | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private eventListeners: Set<EventCallback> = new Set();
  private statusListeners: Set<StatusCallback> = new Set();
  private status: ConnectionStatus = "offline";
  private reconnectTimeout: any = null;
  private lastHeartbeat: number = Date.now();
  private heartbeatChecker: any = null;
  private pendingEvents: { type: string; payload: any; timestamp: string }[] = [];
  private debounceTimeout: any = null;
  private totalRawEvents = 0;
  private totalCoalescedEvents = 0;
  private retryCount = 0;
  private isDocumentVisible = true;
  private wasDisconnectedInBackground = false;

  constructor() {
    this.initBroadcastChannel();
    this.initVisibilityListener();
    if (typeof window !== "undefined") {
      // Connect on next tick to ensure window and localStorage are fully ready
      setTimeout(() => this.connect(), 100);
    }
  }

  private initVisibilityListener() {
    if (typeof document === "undefined") return;
    this.isDocumentVisible = document.visibilityState === "visible";
    document.addEventListener("visibilitychange", () => {
      const visible = document.visibilityState === "visible";
      this.isDocumentVisible = visible;
      if (visible) {
        this.handleVisibilityVisible();
      } else {
        this.handleVisibilityHidden();
      }
    });
  }

  private handleVisibilityHidden() {
    // Pause aggressive heartbeat timeout check while backgrounded
    // Browser timer throttling in background tabs causes false disconnects
    if (this.heartbeatChecker) {
      clearInterval(this.heartbeatChecker);
      this.heartbeatChecker = null;
    }
  }

  private handleVisibilityVisible() {
    // If connection is still healthy and open, resume heartbeat checker and do NOT reconnect
    if (this.eventSource && this.eventSource.readyState === EventSource.OPEN) {
      this.lastHeartbeat = Date.now();
      this.startHeartbeatChecker();
      return;
    }

    // Genuine connection drop occurred while tab was hidden; reconnect once cleanly
    this.wasDisconnectedInBackground = true;
    this.reconnect();
  }

  private initBroadcastChannel() {
    try {
      this.broadcastChannel = new BroadcastChannel("hr_nexa_realtime_channel");
      this.broadcastChannel.onmessage = (msg) => {
        if (msg.data && msg.data.type) {
          this.notifyEventListeners(msg.data, false);
        }
      };
    } catch (err) {
      console.warn(
        "[RealtimeEventsService] BroadcastChannel not supported in this environment",
        err,
      );
    }
  }

  public async connect() {
    if (typeof window === "undefined" || this.eventSource) return;

    const token = localStorage.getItem(OWNER_STORAGE_KEYS.TOKEN);
    if (!token) {
      this.setStatus("offline");
      // Retry in 3 seconds if token isn't stored yet (e.g. initial login)
      this.scheduleReconnect();
      return;
    }

    this.setStatus("reconnecting");

    try {
      // 1. Obtain single-use short-lived SSE ticket using standard Bearer authentication
      const ticketRes = await axiosInstance.post("/subscriptions/realtime/ticket");
      const ticket = ticketRes.data?.ticket;

      if (!ticket) {
        throw new Error("Missing SSE authentication ticket in response");
      }

      // 2. Open EventSource using the single-use ticket (Primary JWT is NEVER placed in URL)
      const ticketParam = `?ticket=${encodeURIComponent(ticket)}`;
      const streamUrl = `${BASE_API}/subscriptions/realtime/stream${ticketParam}`;

      this.eventSource = new EventSource(streamUrl);

      this.eventSource.onopen = () => {
        this.setStatus("connected");
        this.retryCount = 0;
        this.lastHeartbeat = Date.now();
        this.startHeartbeatChecker();
        if (this.wasDisconnectedInBackground) {
          this.wasDisconnectedInBackground = false;
          this.notifyEventListeners(
            {
              type: "connection:resync",
              payload: {},
              timestamp: new Date().toISOString(),
            },
            false,
          );
        }
      };

      this.eventSource.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          this.lastHeartbeat = Date.now();

          if (parsed.type === "ping") {
            return;
          }

          this.notifyEventListeners(parsed, true);
        } catch (err) {
          console.error("[RealtimeEventsService] Failed to parse SSE message", err);
        }
      };

      this.eventSource.onerror = () => {
        this.setStatus("reconnecting");
        this.cleanupEventSource();
        this.scheduleReconnect();
      };
    } catch (err) {
      this.setStatus("reconnecting");
      this.cleanupEventSource();
      this.scheduleReconnect();
    }
  }

  private startHeartbeatChecker() {
    if (this.heartbeatChecker) clearInterval(this.heartbeatChecker);
    if (!this.isDocumentVisible) return;

    this.heartbeatChecker = setInterval(() => {
      if (!this.isDocumentVisible) return;
      // If no heartbeat for > 45s while visible, genuine connection loss occurred
      if (Date.now() - this.lastHeartbeat > 45_000) {
        console.warn(
          "[RealtimeEventsService] Realtime SSE stream heartbeat missed. Reconnecting...",
        );
        this.reconnect();
      }
    }, 15_000);
  }

  public reconnect() {
    this.cleanupEventSource();
    this.connect();
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.retryCount++;
    const delay = Math.min(30_000, 2_000 * Math.pow(1.5, Math.min(this.retryCount, 6)));
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private cleanupEventSource() {
    if (this.heartbeatChecker) clearInterval(this.heartbeatChecker);
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  private setStatus(newStatus: ConnectionStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusListeners.forEach((cb) => cb(newStatus));
    }
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public subscribeStatus(callback: StatusCallback): () => void {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  public subscribeEvents(callback: EventCallback): () => void {
    this.eventListeners.add(callback);
    return () => {
      this.eventListeners.delete(callback);
    };
  }

  private notifyEventListeners(
    event: { type: string; payload: any; timestamp: string },
    broadcast: boolean,
  ) {
    if (broadcast && this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(event);
      } catch (err) {
        // Ignore cross-tab broadcast errors
      }
    }

    this.totalRawEvents++;
    this.pendingEvents.push(event);

    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    this.debounceTimeout = setTimeout(() => {
      this.debounceTimeout = null;
      const eventsToProcess = [...this.pendingEvents];
      this.pendingEvents = [];

      // Coalesce events by composite key: type + entityId
      const coalescedMap = new Map<string, { type: string; payload: any; timestamp: string }>();
      eventsToProcess.forEach((evt) => {
        const payload = evt.payload || {};
        const entityId = payload.id || payload.employeeId || payload.companyId || "";
        const key = `${evt.type}-${entityId}`;
        coalescedMap.set(key, evt); // Overwrites with the latest event
      });

      this.totalCoalescedEvents += coalescedMap.size;
      const savedCount = eventsToProcess.length - coalescedMap.size;
      if (savedCount > 0) {
        console.log(
          `[RealtimeEventsService] Coalesced ${eventsToProcess.length} events into ${coalescedMap.size} unique entity events. Prevented ${savedCount} duplicate updates. Total raw: ${this.totalRawEvents}, Total processed: ${this.totalCoalescedEvents}`,
        );
      }

      // Notify listeners for each coalesced event
      coalescedMap.forEach((evt) => {
        this.eventListeners.forEach((cb) => {
          try {
            cb(evt);
          } catch (err) {
            console.error("[RealtimeEventsService] Listener error:", err);
          }
        });
      });
    }, 300);
  }
}

export const realtimeEventsService = new RealtimeEventsService();
