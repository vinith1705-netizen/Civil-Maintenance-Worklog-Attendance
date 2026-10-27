import React, { useState } from 'react';
import {
  AlertTriangle,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  X,
  HardDrive,
  Key,
} from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';

interface UnauthorizedDomainModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
}

export const UnauthorizedDomainModal: React.FC<UnauthorizedDomainModalProps> = ({
  isOpen,
  onClose,
  onRetry,
}) => {
  const [copied, setCopied] = useState(false);
  const [showManualToken, setShowManualToken] = useState(false);
  const [manualTokenInput, setManualTokenInput] = useState('');

  if (!isOpen) return null;

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const projectId = firebaseConfig.projectId || 'gen-lang-client-0269029537';
  const consoleAuthUrl = `https://console.firebase.google.com/project/${projectId}/authentication/settings`;

  const handleCopyDomain = () => {
    if (!currentHostname) return;
    navigator.clipboard.writeText(currentHostname);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">
                Firebase: Domain Not Authorized
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                Error code: auth/unauthorized-domain
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Explanation */}
        <p className="text-xs text-slate-600 mb-4 leading-relaxed">
          Firebase Authentication restricts Google Sign-In to authorized web domains. Because this
          app is running on Google Cloud Run/AI Studio preview, this domain needs to be added to your
          Firebase project's Authorized Domains list.
        </p>

        {/* Domain to Copy Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Domain to Authorize:
            </span>
            <button
              type="button"
              onClick={handleCopyDomain}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                copied
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy Domain</span>
                </>
              )}
            </button>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-2 font-mono text-xs text-slate-800 break-all select-all font-semibold">
            {currentHostname || 'ais-dev-mfmpf7sl5hafqwsmbvnytx-987274072848.asia-southeast1.run.app'}
          </div>
        </div>

        {/* 3 Step Resolution Guide */}
        <div className="space-y-2.5 mb-5 text-xs text-slate-700">
          <div className="font-bold text-slate-900 text-xs">How to fix in 30 seconds:</div>

          <div className="flex items-start gap-2.5 p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-100">
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
              1
            </span>
            <div className="flex-1">
              <span className="font-semibold text-slate-900">Open Firebase Authentication Settings:</span>
              <div className="mt-1.5">
                <a
                  href={consoleAuthUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs shadow-xs transition"
                >
                  <span>Open Firebase Console Settings</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="w-5 h-5 rounded-full bg-slate-700 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
              2
            </span>
            <div>
              <span className="font-semibold text-slate-900">
                Go to "Authorized domains" section:
              </span>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Click <span className="font-semibold text-slate-700">"Add domain"</span> button at the bottom of the list.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="w-5 h-5 rounded-full bg-slate-700 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
              3
            </span>
            <div>
              <span className="font-semibold text-slate-900">Paste and Save:</span>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Paste the domain and click <span className="font-semibold text-slate-700">Done</span>. Then return here and click "Try Sign-In Again".
              </p>
            </div>
          </div>
        </div>

        {/* Offline / Local Mode Reassurance */}
        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 mb-5 flex items-start gap-2.5 text-xs text-emerald-800">
          <HardDrive className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-emerald-900">Work is Never Lost (Local Storage Active)</div>
            <p className="text-[11px] text-emerald-700 mt-0.5">
              All 34 labours, daily attendance, wage calculations, work categories, and daily worklogs are safely persisted in your browser's local storage and can be exported as Excel/CSV anytime.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100 transition cursor-pointer text-center"
          >
            Continue in Local Storage Mode
          </button>

          <button
            type="button"
            onClick={onRetry}
            className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/20 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Sign-In Again</span>
          </button>
        </div>
      </div>
    </div>
  );
};
