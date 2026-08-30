import React, { useState, useEffect } from "react";
import { Plus, Trash2, Send, Loader2, ClipboardCheck, AlertCircle, CheckCircle2 } from "lucide-react";
import { PageHeader, Field, Btn, Badge, inputCls, cardCls } from "../../../components/ui/DashboardPrimitives";
import { useMyDprHistoryQuery, useDprMutations } from "../../../hooks/useDprQuery";
import { useToast } from "../../../hooks";

interface TaskItem {
  title: string;
  description: string;
  status: "COMPLETED" | "IN_PROGRESS" | "BLOCKED";
  minutesSpent: number;
}

export function EmployeeDprPage() {
  const toast = useToast();
  const { data: history = [], isLoading, isError, refetch } = useMyDprHistoryQuery();
  const { createDpr, updateDpr, submitDpr } = useDprMutations();

  // Selected date defaults to today
  const getTodayString = () => new Date().toISOString().split("T")[0];
  const [reportDate, setReportDate] = useState<string>(getTodayString());

  // Form State
  const [reportId, setReportId] = useState<string | null>(null);
  const [summary, setSummary] = useState<string>("");
  const [blockers, setBlockers] = useState<string>("");
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [status, setStatus] = useState<string>("DRAFT");
  const [reviewerRemark, setReviewerRemark] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load existing report for selected date if exists in history
  useEffect(() => {
    const existing = history.find((h: any) => h.reportDate === reportDate);
    if (existing) {
      setReportId(existing.id);
      setSummary(existing.summary);
      setBlockers(existing.blockers || "");
      setStatus(existing.status);
      setReviewerRemark(existing.reviewerRemark);
      if (existing.tasks && existing.tasks.length > 0) {
        setTasks(
          existing.tasks.map((t: any) => ({
            title: t.title,
            description: t.description || "",
            status: t.status,
            minutesSpent: t.minutesSpent,
          })),
        );
      } else {
        setTasks([]);
      }
    } else {
      // Clear form for fresh entry
      setReportId(null);
      setSummary("");
      setBlockers("");
      setTasks([{ title: "", description: "", status: "IN_PROGRESS", minutesSpent: 0 }]);
      setStatus("DRAFT");
      setReviewerRemark(null);
    }
  }, [reportDate, history]);

  const handleAddTask = () => {
    setTasks([...tasks, { title: "", description: "", status: "IN_PROGRESS", minutesSpent: 0 }]);
  };

  const handleRemoveTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  const handleTaskChange = (index: number, field: keyof TaskItem, value: any) => {
    const newTasks = [...tasks];
    newTasks[index] = { ...newTasks[index], [field]: value };
    setTasks(newTasks);
  };

  const validateForm = (isSubmit: boolean) => {
    if (!summary.trim()) {
      toast.push("Please provide a summary of today's work.", "error");
      return false;
    }
    if (tasks.length === 0) {
      toast.push("Please add at least one work item.", "error");
      return false;
    }
    for (const t of tasks) {
      if (!t.title.trim()) {
        toast.push("Please fill in all task titles.", "error");
        return false;
      }
      if (isSubmit) {
        if (t.minutesSpent <= 0 || isNaN(t.minutesSpent)) {
          toast.push("Minutes spent on each task must be greater than 0.", "error");
          return false;
        }
      } else {
        if (t.minutesSpent < 0 || isNaN(t.minutesSpent)) {
          toast.push("Minutes spent on each task cannot be negative.", "error");
          return false;
        }
      }
    }
    return true;
  };

  const handleSaveDraft = async () => {
    if (!validateForm(false)) return;
    setIsSubmitting(true);

    const payload = {
      reportDate,
      summary,
      blockers: blockers || null,
      tasks: tasks.map((t) => ({
        title: t.title,
        description: t.description || null,
        status: t.status,
        minutesSpent: Number(t.minutesSpent),
      })),
    };

    try {
      if (reportId) {
        await updateDpr.mutateAsync({ id: reportId, payload });
        toast.push("Daily Progress Report draft updated successfully.", "success");
      } else {
        await createDpr.mutateAsync(payload);
        toast.push("Daily Progress Report draft saved successfully.", "success");
      }
      refetch();
    } catch (err: any) {
      toast.push(err?.message || "Failed to save draft progress report.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm(true)) return;
    setIsSubmitting(true);

    try {
      let activeId = reportId;
      const payload = {
        reportDate,
        summary,
        blockers: blockers || null,
        tasks: tasks.map((t) => ({
          title: t.title,
          description: t.description || null,
          status: t.status,
          minutesSpent: Number(t.minutesSpent),
        })),
      };

      // 1. Save or update current state first
      if (activeId) {
        await updateDpr.mutateAsync({ id: activeId, payload });
      } else {
        const res = await createDpr.mutateAsync(payload);
        activeId = res.id;
      }

      // 2. Submit the report
      if (activeId) {
        await submitDpr.mutateAsync(activeId);
        toast.push("Daily Progress Report submitted successfully.", "success");
      }
      refetch();
    } catch (err: any) {
      toast.push(err?.message || "Failed to submit progress report.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

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

  const isLocked = status === "SUBMITTED" || status === "APPROVED" || status === "REJECTED";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Progress Report"
        subtitle="Manage and report your daily tasks, work items, and blockers"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Report Editor Form */}
        <div className={`lg:col-span-2 ${cardCls} space-y-6`}>
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-muted-foreground">Status:</span>
              {getStatusBadge(status)}
            </div>

            <div className="w-full sm:w-auto">
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className={`${inputCls} max-w-[180px]`}
              />
            </div>
          </div>

          {reviewerRemark && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 text-amber-600 dark:text-amber-400 space-y-1">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>Reviewer Feedback</span>
              </div>
              <p className="text-xs">{reviewerRemark}</p>
            </div>
          )}

          <div className="space-y-4">
            <Field label="Daily Work Summary" id="summary">
              <textarea
                id="summary"
                rows={3}
                placeholder="Briefly describe your overall achievements for today..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                disabled={isLocked}
                className={`${inputCls} h-auto py-2`}
              />
            </Field>

            <Field label="Blockers or Remarks (Optional)" id="blockers">
              <input
                type="text"
                id="blockers"
                placeholder="Mention any issues delaying tasks..."
                value={blockers}
                onChange={(e) => setBlockers(e.target.value)}
                disabled={isLocked}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between border-t border-border pt-4">
              <h3 className="font-bold text-sm">Work Items / Tasks</h3>
              {!isLocked && (
                <Btn onClick={handleAddTask} variant="outline" size="sm">
                  <Plus className="h-3 w-3" /> Add Item
                </Btn>
              )}
            </div>

            {tasks.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No work items added. Click 'Add Item' to list tasks.</p>
            ) : (
              <div className="space-y-3">
                {tasks.map((task, index) => (
                  <div key={index} className="rounded-xl border border-border p-4 bg-muted/20 relative space-y-3">
                    {!isLocked && (
                      <button
                        onClick={() => handleRemoveTask(index)}
                        className="absolute right-4 top-4 text-muted-foreground hover:text-destructive transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Task Title">
                        <input
                          type="text"
                          placeholder="e.g. Code database schema"
                          value={task.title}
                          onChange={(e) => handleTaskChange(index, "title", e.target.value)}
                          disabled={isLocked}
                          className={inputCls}
                        />
                      </Field>

                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Status">
                          <select
                            value={task.status}
                            onChange={(e) => handleTaskChange(index, "status", e.target.value)}
                            disabled={isLocked}
                            className={inputCls}
                          >
                            <option value="COMPLETED">Completed</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="BLOCKED">Blocked</option>
                          </select>
                        </Field>

                        <Field label="Time Spent (mins)">
                          <input
                            type="number"
                            min="1"
                            value={task.minutesSpent}
                            onChange={(e) => handleTaskChange(index, "minutesSpent", Number(e.target.value))}
                            disabled={isLocked}
                            className={inputCls}
                          />
                        </Field>
                      </div>
                    </div>

                    <Field label="Task Details / Subtasks">
                      <input
                        type="text"
                        placeholder="Additional details..."
                        value={task.description}
                        onChange={(e) => handleTaskChange(index, "description", e.target.value)}
                        disabled={isLocked}
                        className={inputCls}
                      />
                    </Field>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!isLocked && (
            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <Btn onClick={handleSaveDraft} variant="outline" disabled={isSubmitting}>
                Save Draft
              </Btn>
              <Btn onClick={handleSubmit} variant="primary" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submit Report
              </Btn>
            </div>
          )}
        </div>

        {/* Previous DPR History Sidebar */}
        <div className={`${cardCls} space-y-4 h-fit`}>
          <h2 className="text-lg font-bold flex items-center gap-2 border-b border-border pb-3">
            <ClipboardCheck className="h-5 w-5 text-indigo-500" />
            <span>Reporting History</span>
          </h2>

          {isLoading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : isError || history.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center p-4">No past daily reports found.</p>
          ) : (
            <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
              {history.map((h: any) => (
                <div
                  key={h.id}
                  onClick={() => setReportDate(h.reportDate)}
                  className={`rounded-xl border p-3 bg-muted/10 cursor-pointer transition hover:bg-muted/20 hover:border-primary/40 ${
                    reportDate === h.reportDate ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">{h.reportDate}</span>
                    {getStatusBadge(h.status)}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground line-clamp-1">{h.summary}</p>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Effort: {calculateTotalTime(h.tasks || [])}</span>
                    <span>{h.tasks?.length || 0} items</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
