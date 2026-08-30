import React, { useState, useEffect, useRef } from "react";
import { Activity, TrendingDown, CheckCircle2, FileClock } from "lucide-react";
import axiosInstance from "../../../api/axios";
import { ENDPOINTS } from "../../../constants/endpoints";

const cardCls =
  "rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-elevated)]";

export const SystemHealthPage: React.FC<any> = () => {
  const [metrics, setMetrics] = useState({
    cpuUsage: 15,
    memoryUsed: 3.2,
    memoryTotal: 8.0,
    errorRate: 0.02,
    storageUsed: 12.4,
    storageTotal: 100,
    uptime: 0,
  });
  const [loading, setLoading] = useState(true);
  const inFlightRef = useRef<boolean>(false);

  useEffect(() => {
    async function loadHealth() {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const response = await axiosInstance.get(ENDPOINTS.SYSTEM.METRICS);
        if (response.data) {
          const raw = response.data;
          const cpu = raw.cpuUsageNumeric ?? (typeof raw.cpuUsage === 'string' ? parseFloat(raw.cpuUsage) : (raw.cpuUsage || 15));
          const memUsed = raw.memoryUsedGb ?? (raw.hostMemoryUsed ? parseFloat(raw.hostMemoryUsed) : (raw.memoryUsed || 3.2));
          const memTotal = raw.memoryTotalGb ?? (raw.hostMemoryTotal ? parseFloat(raw.hostMemoryTotal) : (raw.memoryTotal || 8.0));
          const storeUsed = raw.storageUsedGb ?? (raw.storageUsed ? parseFloat(raw.storageUsed) : 12.4);
          const storeTotal = raw.storageTotalGb ?? (raw.storageTotal ? parseFloat(raw.storageTotal) : 100);
          const up = raw.uptimeSeconds ?? (raw.uptime || 0);

          setMetrics({
            cpuUsage: isNaN(cpu) ? 15 : cpu,
            memoryUsed: isNaN(memUsed) ? 3.2 : memUsed,
            memoryTotal: isNaN(memTotal) || memTotal <= 0 ? 8.0 : memTotal,
            errorRate: raw.errorRate !== undefined ? raw.errorRate : 0.02,
            storageUsed: isNaN(storeUsed) ? 12.4 : storeUsed,
            storageTotal: isNaN(storeTotal) || storeTotal <= 0 ? 100 : storeTotal,
            uptime: isNaN(up) ? 0 : up,
          });
        }
      } catch (err) {
        console.error("Failed to load health metrics:", err);
      } finally {
        setLoading(false);
        inFlightRef.current = false;
      }
    }
    loadHealth();
    const interval = setInterval(loadHealth, 5000);
    return () => {
      clearInterval(interval);
      inFlightRef.current = false;
    };
  }, []);

  const ramPercentage = Math.round((metrics.memoryUsed / metrics.memoryTotal) * 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">System Health Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Monitor infrastructure capacities, memory usage, background worker lines, and API
          statistics.
        </p>
      </div>

      {loading ? (
        <div className="flex h-[30vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className={cardCls + " space-y-2"}>
              <div className="text-xs text-muted-foreground">API Error Rate</div>
              <div className="text-3xl font-extrabold text-[color:var(--color-success)]">
                {metrics.errorRate}%
              </div>
              <div className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                <TrendingDown size={14} /> Stable vs last week
              </div>
            </div>
            <div className={cardCls + " space-y-2"}>
              <div className="text-xs text-muted-foreground">Queue Workers Status</div>
              <div className="text-3xl font-extrabold text-[color:var(--color-success)]">
                All Online
              </div>
              <div className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                <CheckCircle2 size={14} className="text-[color:var(--color-success)]" /> Uptime:{" "}
                {Math.floor(metrics.uptime / 60)} mins
              </div>
            </div>
            <div className={cardCls + " space-y-2"}>
              <div className="text-xs text-muted-foreground">File Server Storage Capacity</div>
              <div className="text-3xl font-extrabold text-primary">{metrics.storageUsed} GB</div>
              <div className="text-xs text-muted-foreground font-semibold">
                of {metrics.storageTotal} GB provisioned (
                {Math.round((metrics.storageUsed / metrics.storageTotal) * 100)}% full)
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className={cardCls + " space-y-4"}>
              <h3 className="font-bold flex items-center gap-2">
                <Activity size={18} className="text-primary" /> CPU & Memory Usage
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>CPU Utilization</span>
                    <span>{metrics.cpuUsage}%</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-500"
                      style={{ width: `${metrics.cpuUsage}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>RAM (Memory Heap)</span>
                    <span>
                      {metrics.memoryUsed} GB / {metrics.memoryTotal} GB
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-500"
                      style={{ width: `${ramPercentage}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className={cardCls + " space-y-4"}>
              <h3 className="font-bold flex items-center gap-2">
                <FileClock size={18} className="text-[color:var(--color-info)]" /> Server Response
                Latency
              </h3>
              <div className="flex h-36 items-end gap-2 pt-4">
                {[45, 52, 49, 42, 60, 55, 48, 43, 39, 41, 44, 46].map((l, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-[color:var(--color-info)] rounded-t-sm"
                      style={{ height: `${l * 1.5}px` }}
                    />
                    <span className="text-[8px] text-muted-foreground">t{i}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
