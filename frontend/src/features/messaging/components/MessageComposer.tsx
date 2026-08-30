import React, { useState } from "react";
import { Send, Paperclip, Sparkles } from "lucide-react";
import { Btn, inputCls } from "../../../components/ui";

interface MessageComposerProps {
  recipientName: string;
  onSend: (subject: string, body: string) => Promise<void>;
}

export function MessageComposer({ recipientName, onSend }: MessageComposerProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showSubject, setShowSubject] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || isSending) return;

    try {
      setIsSending(true);
      await onSend(subject.trim() || `Message to ${recipientName}`, body.trim());
      setBody("");
      setSubject("");
      setShowSubject(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-border bg-card p-3 md:p-4 space-y-2">
      {/* Subject Input Toggle & Field */}
      {showSubject ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject line (e.g. Project Update)..."
            className={inputCls + " text-xs py-1.5"}
          />
          <button
            type="button"
            onClick={() => setShowSubject(false)}
            className="text-xs text-muted-foreground hover:text-foreground px-2"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowSubject(true)}
          className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1 px-1"
        >
          <Sparkles className="h-3 w-3" /> Add Subject Line
        </button>
      )}

      {/* Main Composer Box */}
      <div className="flex items-end gap-2 bg-muted/40 p-2 rounded-xl border border-border/80 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Type a message to ${recipientName}... (Press Enter to send, Shift+Enter for new line)`}
          rows={2}
          className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-sm resize-none p-1 max-h-32 min-h-[40px] text-foreground placeholder:text-muted-foreground/60"
        />

        <div className="flex items-center gap-1 pb-1">
          <Btn
            type="submit"
            disabled={!body.trim() || isSending}
            size="sm"
            className="rounded-lg shadow-sm"
          >
            {isSending ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">Send</span>
              </>
            )}
          </Btn>
        </div>
      </div>
    </form>
  );
}
