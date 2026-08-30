/**
 * employeeSyncService.ts
 *
 * A centralized service that exposes a subscribe-to-backend-events mechanism
 * using long-polling. This avoids WebSocket complexity while still providing
 * near-real-time synchronization.
 *
 * When any mutation (create/update/delete) is triggered on an employee,
 * call notifyEmployeeChange() to immediately broadcast to all registered
 * listeners in the current browser tab. For cross-tab sync, a simple
 * BroadcastChannel is used.
 */

type SyncCallback = () => void;

class EmployeeSyncService {
  private listeners: Set<SyncCallback> = new Set();
  private channel: BroadcastChannel | null = null;
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private readonly POLL_INTERVAL_MS = 15_000; // 15 seconds

  constructor() {
    // BroadcastChannel for cross-tab sync
    try {
      this.channel = new BroadcastChannel("hrms_employee_sync");
      this.channel.onmessage = () => {
        this.triggerAll();
      };
    } catch {
      // BroadcastChannel not available (private mode, older browser)
      this.channel = null;
    }
  }

  /**
   * Register a callback to be called when employee data changes.
   * Returns an unsubscribe function.
   */
  subscribe(callback: SyncCallback): () => void {
    this.listeners.add(callback);
    this.startPollingIfNeeded();
    return () => {
      this.listeners.delete(callback);
      this.stopPollingIfNoListeners();
    };
  }

  /**
   * Call this after any successful employee create/update/delete API call.
   * This immediately triggers all registered listeners in the current tab
   * and broadcasts to other tabs via BroadcastChannel.
   */
  notifyEmployeeChange(): void {
    this.triggerAll();
    try {
      this.channel?.postMessage({ type: "employee_changed", ts: Date.now() });
    } catch {
      // ignore
    }
  }

  private triggerAll(): void {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch {
        // ignore
      }
    });
  }

  private startPollingIfNeeded(): void {
    if (this.pollingInterval !== null || this.listeners.size === 0) return;
    this.pollingInterval = setInterval(() => {
      this.triggerAll();
    }, this.POLL_INTERVAL_MS);
  }

  private stopPollingIfNoListeners(): void {
    if (this.listeners.size > 0) return;
    if (this.pollingInterval !== null) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }
}

export const employeeSyncService = new EmployeeSyncService();
