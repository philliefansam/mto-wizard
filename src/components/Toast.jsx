import React, { createContext, useContext, useState, useCallback } from 'react';
import Icon from './Icon';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback(({ title, message, type = 'success', duration = 3500 }) => {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, title, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Floating Toast Container */}
      <div
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none p-3 sm:p-0 no-print"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';
          const isWarning = toast.type === 'warning';
          const isInfo = toast.type === 'info' || (!isSuccess && !isError && !isWarning);

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto neu-flat p-3.5 rounded-xl border flex items-start gap-3 shadow-2xl transition-all duration-200 animate-slide-up ${
                isSuccess
                  ? 'border-emerald-500/40 bg-emerald-50/95 dark:bg-[#1a2b20] text-emerald-950 dark:text-emerald-100'
                  : isError
                  ? 'border-rose-500/40 bg-rose-50/95 dark:bg-[#2e1d1f] text-rose-950 dark:text-rose-100'
                  : isWarning
                  ? 'border-amber-500/40 bg-amber-50/95 dark:bg-[#2d251a] text-amber-950 dark:text-amber-100'
                  : 'border-blue-500/40 bg-blue-50/95 dark:bg-[#1b232e] text-blue-950 dark:text-blue-100'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                <Icon
                  name={
                    isSuccess
                      ? 'check_circle'
                      : isError
                      ? 'error'
                      : isWarning
                      ? 'warning'
                      : 'info'
                  }
                  className={`text-xl ${
                    isSuccess
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : isError
                      ? 'text-rose-600 dark:text-rose-400'
                      : isWarning
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-blue-600 dark:text-blue-400'
                  }`}
                  filled
                />
              </div>

              <div className="flex-1 min-w-0">
                {toast.title && (
                  <div className="text-xs font-bold leading-tight mb-1 font-geometric tracking-wide">
                    {toast.title}
                  </div>
                )}
                <div className="text-[11px] leading-relaxed opacity-90 whitespace-pre-line font-medium">
                  {toast.message}
                </div>
              </div>

              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="shrink-0 p-1 -mr-1 -mt-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                title="Dismiss"
              >
                <Icon name="close" className="text-base" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: ({ title, message }) => {
        console.log(`[Toast] ${title ? title + ': ' : ''}${message}`);
      },
    };
  }
  return ctx;
}
