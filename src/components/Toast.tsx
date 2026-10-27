import React from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const Toast: React.FC = () => {
  const { toast, clearToast } = useApp();

  if (!toast) return null;

  const bgStyles = {
    success: 'bg-emerald-900/90 border-emerald-500 text-emerald-100',
    error: 'bg-rose-900/90 border-rose-500 text-rose-100',
    warning: 'bg-amber-900/90 border-amber-500 text-amber-100',
    info: 'bg-slate-900/90 border-blue-500 text-blue-100',
  }[toast.type];

  const Icon = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
  }[toast.type];

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-md w-full animate-in slide-in-from-bottom-4 duration-300">
      <div className={`flex items-start gap-3 p-4 rounded-xl border shadow-xl backdrop-blur-md ${bgStyles}`}>
        <Icon className="w-5 h-5 mt-0.5 shrink-0" />
        <div className="flex-1 text-sm">
          {toast.title && <div className="font-semibold mb-0.5">{toast.title}</div>}
          <div className="leading-snug">{toast.message}</div>
        </div>
        <button
          onClick={clearToast}
          className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
