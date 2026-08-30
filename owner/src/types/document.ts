export type DocRecord = {
  id: string;
  employee: string;
  type: "Offer" | "Appointment" | "Experience";
  issued: string;
  salary: number;
  designation: string;
};

export type EmpDoc = {
  id: string;
  employee: string;
  docType: string;
  fileName: string;
  uploaded: string;
  size: string;
  fileData?: string;
};

export type Message = {
  id: string;
  to: string;
  from: string;
  toEmail?: string;
  fromEmail?: string;
  toUserId?: string;
  fromUserId?: string;
  senderName?: string;
  receiverName?: string;
  subject: string;
  body: string;
  timestamp: string;
  read: boolean;
};

export type Broadcast = {
  id: string;
  t: string;
  d: string;
  date: string;
  author: string;
  read: number;
};
