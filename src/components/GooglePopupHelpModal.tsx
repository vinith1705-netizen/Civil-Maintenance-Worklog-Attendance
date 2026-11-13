import React from 'react';
import {
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

interface GooglePopupHelpModalProps {
  isOpen: boolean;
  errorCode?: string;
  onClose: () => void;
  onRetryFirebase: () => void;
}

export const GooglePopupHelpModal: React.FC<GooglePopupHelpModalProps> = ({
  isOpen,
  errorCode,
  onClose,
  onRetryFirebase,
}) => {
  const { handleDirectGoogleLogin, isLoggingIn } = useApp();

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '/';
  const isBlocked = errorCode === 'auth/popup-blocked';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">
                {isBlocked ? 'Google Sign-In Popup Blocked' : 'Google Sign-In Popup Closed'}
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                {errorCode || 'auth/popup-closed-by-user'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Explanation */}
        <p className="text-xs text-slate-600 mb-4 leading-relaxed">
          The Google Sign-In popup closed before completing authentication. Inside embedded preview windows,
          browser third-party storage rules or popup blockers often interrupt Firebase&apos;s popup bridge.
          Use <strong>Direct Google OAuth</strong> below or open the app in a standalone browser tab to connect your Google Sheet.
        </p>

        {/* Option 1: Direct GIS OAuth */}
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2.5 mb-3">
          <div className="flex items-center gap-2 text-emerald-950 font-bold text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Option 1: Connect Directly via Google OAuth (Recommended)</span>
          </div>
          <p className="text-[11px] text-emerald-800 leading-relaxed">
            Connects directly with Google Sheets &amp; Drive without using Firebase&apos;s popup iframe bridge.
          </p>
          <button
            type="button"
            onClick={handleDirectGoogleLogin}
            disabled={isLoggingIn}
            className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isLoggingIn ? 'Connecting...' : 'Connect Directly with Google'}</span>
          </button>
        </div>

        {/* Option 2: Open App in New Tab */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 mb-4">
          <div className="text-slate-900 font-bold text-xs">
            Option 2: Open App in a Full Browser Tab
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            If your browser blocks popups inside an embedded preview frame, opening the app in its own tab lets Google Sign-In complete normally.
          </p>
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2 px-4 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl font-semibold text-xs transition flex items-center justify-center gap-2"
          >
            <span>Open App in New Tab</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100 transition cursor-pointer text-center"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onRetryFirebase}
            disabled={isLoggingIn}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Standard Sign-In</span>
          </button>
        </div>
      </div>
    </div>
  );
};
