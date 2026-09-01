import React, { useState } from "react";
import { Card, Badge, Btn, Textarea } from "../../../components/ui/DashboardPrimitives";
import {
  usePerformanceReviewsQuery,
  usePerformanceCriteriaQuery,
  usePerformanceMutations,
} from "../../../hooks/usePerformanceQuery";

export function MyReviewsPage({ user, toast }: { user: any; toast: (m: string) => void }) {
  const employeeId = user?.employeeId || user?.employee?.id;
  const { reviews, isLoadingReviews } = usePerformanceReviewsQuery(
    { employeeId: employeeId || undefined },
    { enabled: Boolean(employeeId) },
  );
  const { criteria } = usePerformanceCriteriaQuery();
  const { submitSelfReview } = usePerformanceMutations();

  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [scores, setScores] = useState<Record<string, number>>({});

  // Render backend-authoritative pre-scoped employee reviews directly
  const myReviews = reviews;

  const handleOpen = (review: any) => {
    setSelectedReviewId(review.id);
    setFeedback(review.selfFeedback || "");
    const initialScores: Record<string, number> = {};
    if (review.scores) {
      review.scores.forEach((s: any) => {
        initialScores[s.criterionId] = s.selfScore || 0;
      });
    }
    setScores(initialScores);
  };

  const handleSubmit = async () => {
    if (!selectedReviewId) return;

    // Validate scores
    for (const crit of criteria) {
      if (
        crit.name !== "Attendance" &&
        (scores[crit.id] === undefined || scores[crit.id] < 1 || scores[crit.id] > 5)
      ) {
        toast(`Please provide a score between 1 and 5 for ${crit.name}`);
        return;
      }
    }

    if (!feedback.trim()) {
      toast("Please provide self-feedback details.");
      return;
    }

    try {
      const scoresPayload = criteria.map((crit) => ({
        criterionId: crit.id,
        score: crit.name === "Attendance" ? 0 : scores[crit.id], // Backend handles attendance
        remarks: "Self rated",
      }));

      await submitSelfReview.mutateAsync({
        id: selectedReviewId,
        feedback,
        scores: scoresPayload,
      });

      toast("Self-Assessment submitted successfully");
      setSelectedReviewId(null);
    } catch (err: any) {
      toast(err.message || "Failed to submit assessment");
    }
  };

  if (isLoadingReviews)
    return <div className="p-8 text-center text-muted-foreground">Loading reviews...</div>;

  const selectedReview = myReviews.find((r: any) => r.id === selectedReviewId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Performance Reviews</h1>
        <p className="text-sm text-muted-foreground">
          Complete your self-assessments for active review cycles.
        </p>
      </div>

      {!selectedReviewId ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {myReviews.map((r: any) => (
            <Card key={r.id}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold">{r.reviewCycle?.name || "Review Cycle"}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Deadline: {r.reviewCycle?.deadline || "N/A"}
                  </p>
                </div>
                <Badge
                  tone={
                    r.status === "Draft" ? "amber" : r.status === "Completed" ? "green" : "blue"
                  }
                >
                  {r.status === "Draft"
                    ? "Awaiting Self Review"
                    : r.status === "Self Review"
                      ? "Awaiting Manager Review"
                      : r.status === "Manager Review"
                        ? "Awaiting HR Calibration"
                        : r.status}
                </Badge>
              </div>

              {r.status === "Draft" ? (
                <Btn variant="primary" className="w-full" onClick={() => handleOpen(r)}>
                  Start Self-Assessment
                </Btn>
              ) : (
                <div className="text-sm border-t border-border pt-3 mt-3">
                  <div className="flex justify-between mb-1">
                    <span className="text-muted-foreground">Self Rating:</span>
                    <span className="font-bold">
                      {r.selfRating > 0 ? `${r.selfRating.toFixed(1)}/5` : "Pending"}
                    </span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-muted-foreground">Manager Rating:</span>
                    <span className="font-bold">
                      {r.managerRating > 0 ? `${r.managerRating.toFixed(1)}/5` : "Pending"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Final Rating:</span>
                    <span className="font-bold">
                      {r.finalRating > 0 ? `${r.finalRating.toFixed(1)}/5` : "Pending"}
                    </span>
                  </div>
                </div>
              )}
            </Card>
          ))}
          {myReviews.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 rounded-lg border border-border">
              You have no active performance reviews assigned.
            </div>
          )}
        </div>
      ) : (
        <Card className="max-w-3xl">
          <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
            <div>
              <h2 className="text-xl font-bold">Self Assessment</h2>
              <p className="text-sm text-muted-foreground">
                Cycle: {selectedReview?.reviewCycle?.name}
              </p>
            </div>
            <Btn variant="outline" size="sm" onClick={() => setSelectedReviewId(null)}>
              Back
            </Btn>
          </div>

          <div className="space-y-6">
            <div className="bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-400 p-4 rounded-lg text-sm">
              Please rate yourself honestly on a scale of 1 to 5 for each criterion, where 1 is
              Unsatisfactory and 5 is Outstanding.
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold border-b border-border pb-2">Performance Criteria</h3>
              {criteria.map((crit: any) => {
                if (crit.name === "Attendance") {
                  return (
                    <div
                      key={crit.id}
                      className="flex justify-between items-center p-3 bg-muted/30 rounded border border-border"
                    >
                      <div>
                        <div className="font-medium">{crit.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Automatically calculated by the system based on actual attendance records.
                        </div>
                      </div>
                      <Badge tone="slate">Auto</Badge>
                    </div>
                  );
                }

                return (
                  <div
                    key={crit.id}
                    className="p-3 bg-muted/10 rounded border border-border space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{crit.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {crit.description || "Rate your performance in this area."}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-primary">
                        {scores[crit.id] || 0} / 5
                      </div>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={scores[crit.id] || 1}
                      onChange={(e) =>
                        setScores({ ...scores, [crit.id]: parseInt(e.target.value) })
                      }
                      className="w-full accent-primary"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Needs Improvement (1)</span>
                      <span>Outstanding (5)</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold border-b border-border pb-2">
                Self Feedback & Achievements
              </h3>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Highlight your key achievements, challenges faced, and areas where you exceeded expectations this cycle..."
                className="h-32"
              />
            </div>

            <div className="pt-4 flex justify-end gap-3">
              <Btn variant="outline" onClick={() => setSelectedReviewId(null)}>
                Cancel
              </Btn>
              <Btn onClick={handleSubmit}>Submit Assessment</Btn>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
