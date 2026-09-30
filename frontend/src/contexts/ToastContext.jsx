import { createContext, useContext, useMemo, useState } from "react";
import { CheckCircle2, X, AlertTriangle } from "lucide-react";
const ToastContext = createContext(null);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = (message, type = "success") => {
    const id = crypto.randomUUID();
    setItems((v) => [...v, { id, message, type }]);
    setTimeout(() => setItems((v) => v.filter((x) => x.id !== id)), 4500);
  };
  const value = useMemo(() => ({ push }), []);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed right-4 top-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2"
        aria-live="polite"
      >
        {items.map((item) => (
          <div key={item.id} className="card flex items-start gap-3 p-4">
            <span
              className={
                item.type === "error" ? "text-red-600" : "text-emerald-600"
              }
            >
              {item.type === "error" ? (
                <AlertTriangle size={20} />
              ) : (
                <CheckCircle2 size={20} />
              )}
            </span>
            <p className="flex-1 text-sm font-medium">{item.message}</p>
            <button
              aria-label="Dismiss"
              onClick={() => setItems((v) => v.filter((x) => x.id !== item.id))}
            >
              <X size={17} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);
