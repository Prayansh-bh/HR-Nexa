-- CreateIndex
CREATE UNIQUE INDEX "PerformanceReview_reviewCycleId_employeeId_key" ON "PerformanceReview"("reviewCycleId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceCriterionScore_reviewId_criterionId_key" ON "PerformanceCriterionScore"("reviewId", "criterionId");
