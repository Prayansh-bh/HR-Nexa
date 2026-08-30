import React, { useState } from "react";
import { Check, X, RefreshCw, Loader2, Calendar, Users, Eye, ClipboardList } from "lucide-react";
import { PageHeader, Field, Btn, Badge, inputCls, cardCls } from "../../../components/ui/DashboardPrimitives";
import { useTeamDprsQuery, useReviewDprMutations } from "../../../hooks/useDprQuery";
import { useToast } from "../../../hooks";

interface ManagerDprPageProps {
  title?: string;
  subtitle?: string;
}

export function ManagerDprPage({
  title = "Team Daily Progress Reviews",
  subtitle = "Approve and monitor Daily Progress Reports of your team members",
}: ManagerDprPageProps = {}) {
  const toast = useToast();

  // Filters State
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>("");
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  const filters = {
    employeeId: filterEmployeeId || undefined,
    reportDate: filterDate || undefined,
    status: filterStatus || undefined,
  };

  const { data: teamReports = [], isLoading, isError, refetch } = useTeamDprsQuery(filters);
  const { approveDpr, rejectDpr, requestCorrectionDpr } = useReviewDprMutations();

  // Selected Report for detail view
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [remark, setRemark] = useState<string>("");
  const [isReviewing, setIsReviewing] = useState(false);

  const selectedReport = teamReports.find((r: any) => r.id === selectedReportId) || teamReports[0];

  // Extract unique employees from reports for the filter list
  const uniqueEmployees = Array.from(
    new Map(
      teamReports
        .filter((r: any) => r.employee)
        .map((r: any) => [r.employee.id, r.employee]),
    ).values(),
  );

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "APPROVED":
        return <Badge tone="green">Approved</Badge>;
      case "REJECTED":
        return <Badge tone="rose">Rejected</Badge>;
      case "CORRECTION_REQUIRED":
        return <Badge tone="amber">Correction Required</Badge>;
      case "SUBMITTED":
        return <Badge tone="indigo">Submitted</Badge>;
      default:
        return <Badge tone="slate">Draft</Badge>;
    }
  };

  const calculateTotalTime = (taskItems: any[]) => {
    const totalMinutes = taskItems.reduce((sum: number, t: any) => sum + (t.minutesSpent || 0), 0);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hrs}h ${mins}m`;
  };

  const handleReview = async (action: "approve" | "reject" | "correction") => {
    if (!selectedReport) return;
    setIsReviewing(true);

    try {
      const payload = { reviewerRemark: remark || undefined };
      if (action === "approve") {
        await approveDpr.mutateAsync({ id: selectedReport.id, payload });
        toast.push("Daily Progress Report approved successfully.", "success");
      } else if (action === "reject") {
        await rejectDpr.mutateAsync({ id: selectedReport.id, payload });
        toast.push("Daily Progress Report rejected.", "success");
      } else if (action === "correction") {
        await requestCorrectionDpr.mutateAsync({ id: selectedReport.id, payload });
        toast.push("Correction requested for progress report.", "success");
      }
      setRemark("");
      refetch();
    } catch (err: any) {
      toast.push(err?.message || "Failed to process review action.", "error");
    } finally {
      setIsReviewing(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
      />

      {/* Filters Bar */}
      <div className={`${cardCls} grid grid-cols-1 gap-4 sm:grid-cols-4 items-end`}>
        <Field label="Employee">
          <select
            value={filterEmployeeId}
            onChange={(e) => setFilterEmployeeId(e.target.value)}
            className={inputCls}
          >
            <option value="">All Employees</option>
            {uniqueEmployees.map((e: any) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Report Date">
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field label="Status">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={inputCls}
          >
            <option value="">All Statuses</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="CORRECTION_REQUIRED">Correction Required</option>
          </select>
        </Field>

        <div className="flex gap-2">
          <Btn onClick={() => refetch()} variant="outline" className="w-full justify-center">
            <RefreshCw className="h-4 w-4" /> Sync
          </Btn>
          {(filterEmployeeId || filterDate || filterStatus) && (
            <Btn
              onClick={() => {
                setFilterEmployeeId("");
                setFilterDate("");
                setFilterStatus("");
              }}
              variant="ghost"
              className="w-full justify-center"
            >
              Clear
            </Btn>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Side: Report Cards List */}
        <div className={`${cardCls} space-y-4 h-[600px] overflow-y-auto`}>
          <h2 className="text-lg font-bold flex items-center gap-2 border-b border-border pb-3">
            <ClipboardList className="h-5 w-5 text-indigo-500" />
            <span>Reports Queue</span>
          </h2>

          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : isError || teamReports.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center p-8">No progress reports found matching filters.</p>
          ) : (
            <div className="space-y-3">
              {teamReports.map((r: any) => (
                <div
                  key={r.id}
                  onClick={() => setSelectedReportId(r.id)}
                  className={`rounded-xl border p-3 cursor-pointer transition hover:bg-muted/10 ${
                    selectedReport?.id === r.id ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">{r.employee?.name}</span>
                    {getStatusBadge(r.status)}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {r.reportDate}
                    </span>
                    <span>Effort: {calculateTotalTime(r.tasks || [])}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Detailed Review Panel */}
        <div className="lg:col-span-2">
          {selectedReport ? (
            <div className={`${cardCls} space-y-6 min-h-[600px] flex flex-col justify-between`}>
              <div className="space-y-6">
                {/* Detail Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
                  <div>
                    <h2 className="text-lg font-bold">{selectedReport.employee?.name}</h2>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Calendar className="h-3 w-3" /> Report Date: {selectedReport.reportDate}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-semibold">Current status:</span>
                    {getStatusBadge(selectedReport.status)}
                  </div>
                </div>

                {/* Content Section */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground">Summary</span>
                    <p className="text-sm bg-muted/20 p-4 rounded-xl border border-border whitespace-pre-wrap">
                      {selectedReport.summary}
                    </p>
                  </div>

                  {selectedReport.blockers && (
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-muted-foreground">Blockers / Concerns</span>
                      <p className="text-sm bg-destructive/5 text-destructive p-3 rounded-xl border border-destructive/15">
                        {selectedReport.blockers}
                      </p>
                    </div>
                  )}
                </div>

                {/* Tasks List */}
                <div className="space-y-3">
                  <h3 className="font-bold text-sm border-t border-border pt-4">Reported Tasks</h3>
                  {selectedReport.tasks && selectedReport.tasks.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {selectedReport.tasks.map((task: any) => (
                        <div key={task.id} className="rounded-xl border border-border p-3 bg-muted/5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-foreground line-clamp-1">{task.title}</span>
                            <span className="text-[10px] bg-muted px-2 py-0.5 rounded font-medium">{task.status}</span>
                          </div>
                          {task.description && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2">{task.description}</p>
                          )}
                          <div className="text-[10px] text-muted-foreground">Effort: {task.minutesSpent} mins</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No tasks listed under this report.</p>
                  )}
                </div>
              </div>

              {/* Action Board (Only enabled for review if status is SUBMITTED) */}
              <div className="border-t border-border pt-4 mt-6 space-y-4">
                <Field label="Reviewer remarks & notes" id="remark">
                  <textarea
                    id="remark"
                    rows={2}
                    placeholder="Provide comments, reasons for rejection, or correction guidelines..."
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    disabled={selectedReport.status !== "SUBMITTED" || isReviewing}
                    className={`${inputCls} h-auto py-2`}
                  />
                </Field>

                {selectedReport.status === "SUBMITTED" ? (
                  <div className="flex flex-wrap gap-2">
                    <Btn
                      onClick={() => handleReview("approve")}
                      variant="success"
                      disabled={isReviewing}
                      className="flex-1 min-w-[120px]"
                    >
                      <Check className="h-4 w-4" /> Approve
                    </Btn>
                    <Btn
                      onClick={() => handleReview("correction")}
                      variant="outline"
                      disabled={isReviewing}
                      className="flex-1 min-w-[120px]"
                    >
                      <RefreshCw className="h-4 w-4" /> Request Correction
                    </Btn>
                    <Btn
                      onClick={() => handleReview("reject")}
                      variant="danger"
                      disabled={isReviewing}
                      className="flex-1 min-w-[120px]"
                    >
                      <X className="h-4 w-4" /> Reject
                    </Btn>
                  </div>
                ) : selectedReport.reviewerRemark ? (
                  <div className="rounded-xl bg-muted/40 p-4 border border-border">
                    <span className="text-[10px] font-semibold text-muted-foreground block mb-1">YOUR REVIEW FEEDBACK</span>
                    <p className="text-xs text-foreground italic">"{selectedReport.reviewerRemark}"</p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className={`${cardCls} flex flex-col items-center justify-center min-h-[600px] text-muted-foreground`}>
              <Eye className="h-12 w-12 text-muted-foreground/45 mb-2" />
              <p className="text-sm">Select a report from the queue to view details and review.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
