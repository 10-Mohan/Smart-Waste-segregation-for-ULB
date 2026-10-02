import { createContext, useContext, useEffect, useState } from 'react';
import './Toast.css';

const ToastContext = createContext(null);

export function Toast({ toast, onDismiss }) {
  return (
    <div className={`ui-toast ui-toast--${toast.variant}`} role={toast.variant === 'bad' ? 'alert' : 'status'}>
      <p>{toast.message}</p>
      <button type="button" aria-label="Dismiss notification" onClick={() => onDismiss(toast.id)}>
        <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16">
          <path d="m4 4 8 8m0-8-8 8" fill="none" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const notify = (message, variant = 'good') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((current) => [...current, { id, message, variant }]);
    return id;
  };
  const dismiss = (id) => setToasts((current) => current.filter((toast) => toast.id !== id));

  useEffect(() => {
    if (!toasts.length) return undefined;
    const timers = toasts.map((toast) => window.setTimeout(() => dismiss(toast.id), 5000));
    return () => timers.forEach(window.clearTimeout);
  }, [toasts]);

  return (
    <ToastContext.Provider value={{ notify, dismiss }}>
      {children}
      <div className="ui-toast-region" role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map((toast) => <Toast key={toast.id} toast={toast} onDismiss={dismiss} />)}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider.');
  return context;
}