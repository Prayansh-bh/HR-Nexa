import React from "react";
import { useExitQueries } from "../hooks/useExitQuery";
import { Badge, Btn, cardCls } from "../../../components/ui/DashboardPrimitives";
import { format } from "date-fns";

export function ExitDetailPage({ exitId, onBack }: { exitId: string; onBack: () => void }) {
  const { useExitDetails } = useExitQueries();
  const { data: exit, isLoading } = useExitDetails(exitId);

  if (isLoading) return <div>Loading...</div>;
  if (!exit) return <div>Exit record not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex gap-4 items-center">
        <Btn variant="outline" size="sm" onClick={onBack}>
          ← Back
        </Btn>
        <h1 className="text-2xl font-bold">Exit Details: {exit.employee?.name}</h1>
        <Badge tone="slate">{exit.stage}</Badge>
        <Badge tone={exit.status === "APPROVED" ? "green" : "amber"}>{exit.status}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className={cardCls}>
            <h3 className="font-bold text-lg mb-4">Overview</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Reason</div>
                <div className="font-semibold">{exit.reason}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Proposed LWD</div>
                <div className="font-semibold">
                  {format(new Date(exit.proposedLastWorkingDay), "PPP")}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Approved LWD</div>
                <div className="font-semibold">
                  {exit.approvedLastWorkingDay
                    ? format(new Date(exit.approvedLastWorkingDay), "PPP")
                    : "Pending"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Notice Buyout</div>
                <div className="font-semibold">{exit.noticeBuyoutRequest ? "Requested" : "No"}</div>
              </div>
            </div>
            {exit.additionalComments && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="text-sm text-muted-foreground mb-1">Additional Comments</div>
                <p className="text-sm whitespace-pre-wrap">{exit.additionalComments}</p>
              </div>
            )}
          </div>

          <div className={cardCls}>
            <h3 className="font-bold text-lg mb-4">Checklist Status</h3>
            {exit.checklists?.length === 0 ? (
              <p className="text-muted-foreground text-sm">No checklist generated yet.</p>
            ) : (
              <ul className="space-y-2">
                {exit.checklists?.map((c: any) => (
                  <li
                    key={c.id}
                    className="flex justify-between items-center text-sm p-2 bg-muted/30 rounded-lg"
                  >
                    <span>
                      {c.task} ({c.department})
                    </span>
                    <Badge tone={c.status === "COMPLETED" ? "green" : "slate"}>{c.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className={cardCls}>
            <h3 className="font-bold text-lg mb-4">Timeline</h3>
            <div className="space-y-4">
              {exit.timeline?.map((t: any) => (
                <div key={t.id} className="text-sm">
                  <div className="font-semibold text-primary">{t.action}</div>
                  <div className="text-muted-foreground">{t.description}</div>
                  <div className="text-xs text-muted-foreground/60">
                    {format(new Date(t.createdAt), "PPp")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
