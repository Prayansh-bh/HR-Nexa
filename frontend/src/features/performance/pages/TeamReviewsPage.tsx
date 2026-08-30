import React, { useState } from "react";
import { Card, Badge, Btn, Textarea } from "../../../components/ui/DashboardPrimitives";
import {
  usePerformanceReviewsQuery,
  usePerformanceCriteriaQuery,
  usePerformanceMutations,
} from "../../../hooks/usePerformanceQuery";

export function TeamReviewsPage({ user, toast }: { user: any; toast: (m: string) => void }) {
  const managerId = user?.employeeId;
  const { reviews, isLoadingReviews } = usePerformanceReviewsQuery(
    { managerId: managerId || undefined },
    { enabled: Boolean(managerId) },
  );
  const { criteria } = usePerformanceCriteriaQuery();
  const { submitManagerReview } = usePerformanceMutations();

  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [recommendations, setRecommendations] = useState({
    promotion: false,
    increment: false,
    training: false,
  });

  // Render backend-authoritative pre-scoped team reviews directly
  const teamReviews = reviews;

  const handleOpen = (review: any) => {
    setSelectedReviewId(review.id);
    setFeedback(review.managerFeedback || "");

    const initialScores: Record<string, number> = {};
    if (review.scores) {
      review.scores.forEach((s: any) => {
        initialScores[s.criterionId] = s.managerScore || s.selfScore || 0;
      });
    }
    setScores(initialScores);

    setRecommendations({
      promotion: review.promotionRecommended || false,
      increment: review.incrementRecommended || false,
      training: review.trainingRecommended || false,
    });
  };

  const handleSubmit = async () => {
    if (!selectedReviewId) return;

    for (const crit of criteria) {
      if (
        crit.name !== "Attendance" &&
        (scores[crit.id] === undefined || scores[crit.id] < 1 || scores[crit.id] > 5)
      ) {
        toast(`Please provide a manager score between 1 and 5 for ${crit.name}`);
        return;
      }
    }

    if (!feedback.trim()) {
      toast("Please provide manager feedback.");
      return;
    }

    try {
      const scoresPayload = criteria.map((crit) => ({
        criterionId: crit.id,
        score: crit.name === "Attendance" ? 0 : scores[crit.id],
        remarks: "Manager rated",
      }));

      await submitManagerReview.mutateAsync({
        id: selectedReviewId,
        feedback,
        promotion: recommendations.promotion,
        increment: recommendations.increment,
        training: recommendations.training,
        scores: scoresPayload,
      });

      toast("Manager Assessment submitted successfully");
      setSelectedReviewId(null);
    } catch (err: any) {
      toast(err.message || "Failed to submit manager assessment");
    }
  };

  if (isLoadingReviews)
    return <div className="p-8 text-center text-muted-foreground">Loading team reviews...</div>;

  const selectedReview = teamReviews.find((r: any) => r.id === selectedReviewId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Team Performance Reviews</h1>
        <p className="text-sm text-muted-foreground">
          Evaluate self-assessments submitted by your direct reports.
        </p>
      </div>

      {!selectedReviewId ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teamReviews.map((r: any) => (
            <Card key={r.id}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold">{r.employee?.name || "Employee"}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cycle: {r.reviewCycle?.name || "N/A"}
                  </p>
                </div>
                <Badge
                  tone={
                    r.status === "Self Review"
                      ? "amber"
                      : r.status === "Manager Review"
                        ? "blue"
                        : r.status === "Draft"
                          ? "slate"
                          : "green"
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

              {r.status === "Self Review" || r.status === "Draft" ? (
                <Btn variant="primary" className="w-full" onClick={() => handleOpen(r)}>
                  {r.status === "Draft" ? "Override / Start Early" : "Evaluate Assessment"}
                </Btn>
              ) : (
                <div className="text-sm border-t border-border pt-3 mt-3 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Self Rating:</span>
                    <span className="font-bold">
                      {r.selfRating > 0 ? `${r.selfRating.toFixed(1)}/5` : "Pending"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Manager Rating:</span>
                    <span className="font-bold text-primary">
                      {r.managerRating > 0 ? `${r.managerRating.toFixed(1)}/5` : "Pending"}
                    </span>
                  </div>
                  <Btn
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => handleOpen(r)}
                  >
                    View Details
                  </Btn>
                </div>
              )}
            </Card>
          ))}
          {teamReviews.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 rounded-lg border border-border">
              You have no team reviews assigned to you.
            </div>
          )}
        </div>
      ) : (
        <Card className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
            <div>
              <h2 className="text-xl font-bold">Manager Assessment</h2>
              <p className="text-sm text-muted-foreground">
                Evaluating {selectedReview?.employee?.name}
              </p>
            </div>
            <Btn variant="outline" size="sm" onClick={() => setSelectedReviewId(null)}>
              Back
            </Btn>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Column: Self Assessment Data */}
            <div className="md:col-span-1 space-y-6 border-r border-border pr-6">
              <div>
                <h3 className="font-semibold border-b border-border pb-2 mb-3">Self Assessment</h3>
                {selectedReview?.status === "Draft" ? (
                  <div className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-3 rounded">
                    Employee has not yet submitted their self-assessment.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-sm">
                      <div className="text-muted-foreground mb-1">Self Rating</div>
                      <div className="text-2xl font-bold">
                        {selectedReview?.selfRating?.toFixed(1)}{" "}
                        <span className="text-sm font-normal text-muted-foreground">/ 5</span>
                      </div>
                    </div>
                    <div className="text-sm">
                      <div className="text-muted-foreground mb-1">Feedback</div>
                      <div className="bg-muted/30 p-3 rounded italic">
                        "{selectedReview?.selfFeedback}"
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Manager Form */}
            <div className="md:col-span-2 space-y-6">
              <div className="space-y-4">
                <h3 className="font-semibold border-b border-border pb-2">Manager Rating</h3>
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
                            Auto-calculated score.
                          </div>
                        </div>
                        <Badge tone="slate">Auto</Badge>
                      </div>
                    );
                  }

                  // Extract employee self score for this criterion
                  const empScore =
                    selectedReview?.scores?.find((s: any) => s.criterionId === crit.id)
                      ?.selfScore || 0;

                  return (
                    <div
                      key={crit.id}
                      className="p-3 bg-muted/10 rounded border border-border space-y-3"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{crit.name}</div>
                          <div className="text-xs text-muted-foreground">{crit.description}</div>
                        </div>
                        <div className="text-sm font-bold text-primary">
                          {scores[crit.id] || 0} / 5
                        </div>
                      </div>

                      {selectedReview?.status !== "Draft" && (
                        <div className="text-xs text-muted-foreground flex justify-between px-1">
                          <span>
                            Employee rated:{" "}
                            <strong className="text-foreground">{empScore}/5</strong>
                          </span>
                        </div>
                      )}

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
                        disabled={
                          selectedReview?.status === "Manager Review" ||
                          selectedReview?.status === "HR Review" ||
                          selectedReview?.status === "Completed"
                        }
                      />
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold border-b border-border pb-2">Manager Feedback</h3>
                <Textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Provide constructive feedback, areas of improvement, and justify your ratings..."
                  className="h-32"
                  disabled={
                    selectedReview?.status === "Manager Review" ||
                    selectedReview?.status === "HR Review" ||
                    selectedReview?.status === "Completed"
                  }
                />
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold border-b border-border pb-2">Recommendations</h3>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recommendations.increment}
                      onChange={(e) =>
                        setRecommendations({ ...recommendations, increment: e.target.checked })
                      }
                      className="rounded text-primary"
                      disabled={
                        selectedReview?.status === "Manager Review" ||
                        selectedReview?.status === "HR Review" ||
                        selectedReview?.status === "Completed"
                      }
                    />
                    Salary Increment
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recommendations.promotion}
                      onChange={(e) =>
                        setRecommendations({ ...recommendations, promotion: e.target.checked })
                      }
                      className="rounded text-primary"
                      disabled={
                        selectedReview?.status === "Manager Review" ||
                        selectedReview?.status === "HR Review" ||
                        selectedReview?.status === "Completed"
                      }
                    />
                    Promotion
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recommendations.training}
                      onChange={(e) =>
                        setRecommendations({ ...recommendations, training: e.target.checked })
                      }
                      className="rounded text-primary"
                      disabled={
                        selectedReview?.status === "Manager Review" ||
                        selectedReview?.status === "HR Review" ||
                        selectedReview?.status === "Completed"
                      }
                    />
                    Needs Training (PIP)
                  </label>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <Btn variant="outline" onClick={() => setSelectedReviewId(null)}>
                  Cancel
                </Btn>
                {(selectedReview?.status === "Draft" ||
                  selectedReview?.status === "Self Review") && (
                  <Btn onClick={handleSubmit}>Submit Manager Review</Btn>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
