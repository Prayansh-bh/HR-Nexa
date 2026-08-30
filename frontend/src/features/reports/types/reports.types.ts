export type ReportFilter = {
  startDate?: string;
  endDate?: string;
  department?: string;
  format?: "pdf" | "excel" | "csv";
};

export type HRAnalyticsData = {
  totalHeadcount: number;
  retentionRate: number;
  attritionRate: number;
  avgTenureYears: number;
  departmentDistribution: { name: string; count: number }[];
};
