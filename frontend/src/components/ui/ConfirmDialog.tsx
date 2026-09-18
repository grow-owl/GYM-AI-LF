import Modal from "./Modal";
import { AlertTriangle, Trash2, HelpCircle, Loader2 } from "lucide-react";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  tone?: "danger" | "warn" | "accent";
  loading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  tone = "danger",
  loading = false,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const toneConfig = {
    danger: {
      icon: Trash2,
      iconBg: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
      btnBg: "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20",
    },
    warn: {
      icon: AlertTriangle,
      iconBg: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
      btnBg: "bg-amber-500 hover:bg-amber-400 text-(--color-navbar) shadow-amber-500/20",
    },
    accent: {
      icon: HelpCircle,
      iconBg: "bg-(--color-accent)/10 text-(--color-accent) border border-(--color-accent)/20",
      btnBg: "bg-(--color-accent) hover:bg-(--color-accent-hover) text-(--color-navbar) shadow-(--color-accent)/20",
    },
  }[tone];

  const Icon = toneConfig.icon;

  return (
    <Modal onClose={onClose} maxWidth="sm" showCloseButton={false}>
      <div className="text-center space-y-4 pt-2">
        <div className={`mx-auto w-12 h-12 rounded-2xl flex items-center justify-center ${toneConfig.iconBg}`}>
          <Icon size={24} />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-base font-bold text-(--color-text)">{title}</h3>
          <p className="text-xs text-(--color-text-muted) max-w-xs mx-auto leading-relaxed">{description}</p>
        </div>

        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-(--color-surface-2) text-xs font-semibold text-(--color-text) hover:bg-(--color-surface-3) transition-colors cursor-pointer disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${toneConfig.btnBg}`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
