export type ReviewCycle = {
  id?: string;
  name: string;
  target: string;
  status: "Draft" | "Active" | "Completed";
};
