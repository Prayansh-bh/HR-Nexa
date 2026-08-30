export type Announcement = {
  id: string;
  title: string;
  content: string;
  date: string;
  author: string;
  readCount: number;
};

export type Message = {
  id: string;
  toEmail: string;
  fromEmail: string;
  subject: string;
  body: string;
  timestamp: string;
  read: boolean;
};
