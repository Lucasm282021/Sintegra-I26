import React from 'react';

export default function ToastContainer({ toasts }) {
  return (
    <div className="toast-hub" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast-item toast-${t.type}`}>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
