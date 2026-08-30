import React from "react";
import { ModalShell } from "./ModalShell";
import { Btn } from "./Btn";
import { AlertTriangle } from "lucide-react";

export interface ConfirmModalProps {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "danger" | "primary" | "warning" | "outline" | "success" | "ghost";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title = "Confirm Action",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "danger",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const btnVariant = confirmVariant === "warning" ? "primary" : confirmVariant;
  return (
    <ModalShell title={title} onClose={onCancel}>
      <div className="flex items-start gap-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="flex-1 text-sm text-foreground leading-relaxed pt-1">
          {message}
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2.5">
        <Btn variant="outline" onClick={onCancel}>
          {cancelText}
        </Btn>
        <Btn variant={btnVariant} onClick={onConfirm}>
          {confirmText}
        </Btn>
      </div>
    </ModalShell>
  );
}
