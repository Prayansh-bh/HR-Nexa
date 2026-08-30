import { useEffect, useState } from "react";
import { BarChart3, Users, TrendingDown, Loader2 } from "lucide-react";
import { Card, PageHeader } from "../../../components/ui";
import { useEmployeesQuery } from "../../../hooks/useEmployeesQuery";
import { dashboardService } from "../../../services/dashboard.service";

export function HRAnalyticsPage() {
  const { data: employeesData, employees: employeesProp, isLoading: isLoadingEmps } = useEmployeesQuery();
  const employees: any[] = Array.isArray(employeesProp) && employeesProp.length > 0
    ? employeesProp
    : (Array.isArray(employeesData)
        ? employeesData
        : (employeesData && Array.isArray((employeesData as any).data) ? (employeesData as any).data : (Array.isArray(employeesProp) ? employeesProp : [])));

  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);

  useEffect(() => {
    let mounted = true;
    setIsLoadingAnalytics(true);
    dashboardService
      .getDashboardAnalytics()
      .then((data) => {
        if (mounted) {
          setAnalytics(data);
        }
      })
      .catch(() => {
        /* Graceful fallback — show employee-derived stats */
      })
      .finally(() => {
        if (mounted) setIsLoadingAnalytics(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Department breakdown derived from employee list (always real data)
  const departments = Array.from(new Set(employees.map((e: any) => e.department).filter(Boolean)));
  const deptCounts = departments
    .map((dept) => ({
      name: dept as string,
      count: employees.filter((e: any) => e.department === dept).length,
    }))
    .sort((a, b) => b.count - a.count);
  const maxCount = Math.max(...deptCounts.map((d) => d.count), 1);

  // Gender breakdown derived from employee list
  const genderMap: Record<string, number> = {};
  employees.forEach((e: any) => {
    const g = (e.gender || "Unknown").trim();
    genderMap[g] = (genderMap[g] || 0) + 1;
  });
  const totalWithGender = employees.length || 1;

  const isLoading = isLoadingEmps || isLoadingAnalytics;

  return (
    <div className="space-y-6">
      <PageHeader
        title="HR Analytics"
        subtitle="Demographics reports, attrition factors, and department distributions — powered by live data."
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* KPI Strip from reports/dashboard */}
          {analytics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Employees", value: analytics.employees?.total ?? employees.length },
                {
                  label: "Active",
                  value:
                    analytics.employees?.active ??
                    employees.filter((e: any) => e.status === "Active").length,
                },
                { label: "On Leave", value: analytics.employees?.onLeave ?? 0 },
                { label: "Pending Leaves", value: analytics.leaves?.pending ?? 0 },
              ].map((kpi) => (
                <Card key={kpi.label} className="!p-4 text-center">
                  <div className="text-2xl font-extrabold text-foreground">{kpi.value}</div>
                  <div className="text-xs text-muted-foreground mt-1 font-medium">{kpi.label}</div>
                </Card>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Department Headcount Bar Chart */}
            <Card className="space-y-4 md:col-span-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-sm">Department Headcount</h3>
              </div>
              {deptCounts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No employee data available.
                </p>
              ) : (
                <div className="space-y-3">
                  {deptCounts.map((dept) => {
                    const pct = Math.round((dept.count / maxCount) * 100);
                    return (
                      <div key={dept.name}>
                        <div className="flex justify-between text-xs font-semibold mb-1">
                          <span>{dept.name}</span>
                          <span className="text-muted-foreground">
                            {dept.count} employee{dept.count !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full btn-gradient rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Gender Diversity */}
            <Card className="space-y-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-sm">Staff Diversity Balance</h3>
              </div>
              {Object.keys(genderMap).length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No gender data recorded.
                </p>
              ) : (
                <div className="space-y-3 pt-2 text-xs font-semibold">
                  {Object.entries(genderMap).map(([gender, count]) => {
                    const pct = Math.round((count / totalWithGender) * 100);
                    return (
                      <div key={gender}>
                        <div className="flex justify-between mb-1">
                          <span>{gender}</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Attrition Trend */}
            <Card className="space-y-4 md:col-span-3">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-destructive" />
                <h3 className="font-bold text-sm">Attrition Trend (Last 12 Months)</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Attrition trend analysis requires historical exit data. As resignations are
                submitted and processed through the Exit Management module, trend charts will be
                populated here automatically.
              </p>
              {analytics?.employees?.inactive !== undefined && (
                <div className="flex items-center gap-3 rounded-lg bg-muted/30 px-4 py-3">
                  <span className="text-2xl font-extrabold text-destructive">
                    {analytics.employees.inactive}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    inactive / separated employees on record
                  </span>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
