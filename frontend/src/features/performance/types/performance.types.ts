export type PerformanceReview = {
  id: string;
  employeeId: string;
  employeeName: string;
  cycle: string;
  rating: number; // 1-5
  status: "Draft" | "Self-Reviewed" | "Manager-Reviewed" | "Completed";
  submittedDate: string;
};

export type Goal = {
  id: string;
  employeeId: string;
  title: string;
  targetDate: string;
  progressPercentage: number;
  status: "In Progress" | "Completed" | "Behind";
};
