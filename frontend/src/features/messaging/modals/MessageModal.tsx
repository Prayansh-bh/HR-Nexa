import React, { useState } from "react";
import { Send } from "lucide-react";
import { ModalShell, Field, Btn, Avatar, inputCls } from "../../../components/ui";
import type { Employee } from "../../../types";

interface MessageModalProps {
  emp: Employee;
  onClose: () => void;
  onSent: (subject: string, body: string) => void;
}

export function MessageModal({ emp, onClose, onSent }: MessageModalProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const send = () => {
    if (!subject.trim() || !body.trim()) return;
    onSent(subject, body);
    onClose();
  };

  return (
    <ModalShell title={`Message - ${emp.name}`} onClose={onClose}>
      <div className="flex items-center gap-3 mb-4 rounded-lg bg-muted/40 p-3">
        <Avatar initials={emp.avatar} />
        <div className="min-w-0">
          <div className="font-semibold truncate">{emp.name}</div>
          <div className="text-xs text-muted-foreground truncate">{emp.email}</div>
        </div>
      </div>
      <div className="space-y-4">
        <Field label="Subject *">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={inputCls}
            placeholder="e.g. Quick sync tomorrow"
          />
        </Field>
        <Field label="Message *">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className={inputCls + " min-h-[140px] py-2"}
            placeholder="Write your message…"
          />
        </Field>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Btn variant="outline" onClick={onClose}>
          Cancel
        </Btn>
        <Btn onClick={send}>
          <Send className="h-4 w-4" /> Send Message
        </Btn>
      </div>
    </ModalShell>
  );
}
