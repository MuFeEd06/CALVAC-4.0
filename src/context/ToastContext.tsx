import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface ToastCtx { showToast: (msg: string, ok?: boolean) => void; }
const ToastContext = createContext<ToastCtx>({ showToast: () => {} });

let _id = 0;
interface ToastItem { id: number; msg: string; ok: boolean; }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((msg: string, ok = true) => {
    const id = ++_id;
    setToasts(prev => [...prev, { id, msg, ok }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2500);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div key={t.id} className="toast-item"
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              style={{ borderLeftColor: t.ok ? 'var(--primary)' : '#e53e3e' }}>
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
