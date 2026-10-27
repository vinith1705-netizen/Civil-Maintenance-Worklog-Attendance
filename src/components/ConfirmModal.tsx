import React from 'react';
import { AlertCircle, FileSpreadsheet, ShieldAlert } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  details?: { label: string; value: string }[];
  isGoogleSheetSync?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  details,
  isGoogleSheetSync,
  confirmLabel = 'Confirm & Save',
  cancelLabel = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              isDestructive
                ? 'bg-red-100 text-red-600'
                : isGoogleSheetSync
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-indigo-100 text-indigo-600'
            }`}
          >
            {isDestructive ? (
              <ShieldAlert className="w-6 h-6" />
            ) : isGoogleSheetSync ? (
              <FileSpreadsheet className="w-6 h-6" />
            ) : (
              <AlertCircle className="w-6 h-6" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">Department of Civil Maintenance — Data Safety Check</p>
          </div>
        </div>

        <p className="text-sm text-slate-600 mb-4 leading-relaxed">{message}</p>

        {details && details.length > 0 && (
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 mb-5 space-y-2 text-xs">
            {details.map((d, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">{d.label}:</span>
                <span className="text-slate-800 font-semibold text-right max-w-[260px] truncate">{d.value}</span>
              </div>
            ))}
          </div>
        )}

        {isGoogleSheetSync && (
          <div className="flex items-center gap-2 p-2.5 bg-emerald-50 text-emerald-800 rounded-lg text-xs mb-5 border border-emerald-200">
            <FileSpreadsheet className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>This will safely append/update your record in Google Sheets without modifying existing rows.</span>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-medium text-sm hover:bg-slate-100 transition"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-xl font-semibold text-sm text-white shadow-md transition ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20'
                : 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/20'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
