export type JobPosting = {
  id: string;
  title: string;
  department: string;
  location: string;
  type: "Full-Time" | "Part-Time" | "Contract" | "Remote";
  applicantsCount: number;
  status: "Open" | "Closed" | "Draft";
  createdAt: string;
};

export type Candidate = {
  id: string;
  name: string;
  email: string;
  jobId: string;
  jobTitle: string;
  stage: "Applied" | "Screening" | "Interview" | "Offered" | "Hired" | "Rejected";
  experience: string;
  appliedDate: string;
};
