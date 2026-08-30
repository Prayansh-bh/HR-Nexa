export interface EmailAttachment {
  filename: string;
  content?: string | Buffer | any;
  path?: string;
  contentType?: string;
}

export interface SendEmailOptions {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  messageId?: string;
}
