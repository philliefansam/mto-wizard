import React, { useEffect, useRef } from 'react';
import Icon from './Icon';

/**
 * Accessible native <dialog> confirmation modal replacing browser confirm().
 * Uses showModal() so the browser manages top-layer stacking, inert background,
 * Escape dismissal, and focus restoration automatically.
 */
export default function ConfirmDialog({
  isOpen,
  title = 'Confirm Action',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const isDanger = variant === 'danger';

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      onCancel={(e) => {
        if (e.target !== dialogRef.current) return;
        e.preventDefault();
        onCancel?.();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          onCancel?.();
        }
      }}
      className="m-auto p-0 bg-transparent border-0 max-w-md w-[calc(100%-2rem)] backdrop:bg-[#202124]/75 backdrop:backdrop-blur-sm no-print"
    >
      <div className="bg-[#e0e5ec] dark:bg-[#202124] rounded-2xl p-5 neu-flat border border-slate-300/60 dark:border-[#3c4043] shadow-2xl space-y-4">
        <div className="flex items-start gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
              isDanger
                ? 'bg-rose-600 text-white'
                : 'bg-blue-600 text-white'
            }`}
          >
            <Icon name={isDanger ? 'warning' : 'info'} className="text-xl text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2
              id="confirm-dialog-title"
              className="text-base font-bold text-slate-800 dark:text-slate-100 font-geometric"
            >
              {title}
            </h2>
            <p
              id="confirm-dialog-message"
              className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed"
            >
              {message}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-300/60 dark:border-[#3c4043]">
          <button
            type="button"
            onClick={onCancel}
            className="neu-btn px-4 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm transition-all ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'neu-btn-primary'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
