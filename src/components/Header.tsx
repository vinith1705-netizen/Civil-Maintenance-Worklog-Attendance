import React from 'react';
import {
  Sparkles,
  FileSpreadsheet,
  LogOut,
  ExternalLink,
  Menu,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const Header: React.FC<{ onToggleMobileMenu?: () => void }> = ({ onToggleMobileMenu }) => {
  const {
    settings,
    accessToken,
    googleAuthExpired,
    syncStatus,
    reconnectGoogleAndSync,
    handleGoogleLogin,
    handleGoogleLogout,
    isLoggingIn,
    setActiveTab,
    setAiAssistantOpen,
  } = useApp();

  const isSheetConnected = Boolean(accessToken && settings.spreadsheetId && !googleAuthExpired);
  const isSignedInWithoutSheet = Boolean(accessToken && !settings.spreadsheetId && !googleAuthExpired);
  const hasError = syncStatus.status === 'error';

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs no-print">
      <div className="px-4 lg:px-6 py-2.5 flex items-center justify-between gap-4">
        {/* Left: Institute Brand & App Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition"
            aria-label="Toggle navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-600 to-amber-700 text-white flex items-center justify-center shadow-md shadow-amber-600/20 font-black text-sm tracking-wider">
              BIT
            </div>
            <div>
              <h1 className="text-sm md:text-base font-bold text-slate-900 tracking-tight leading-tight flex items-center gap-1.5">
                <span>Civil Maintenance Worklog & Attendance</span>
                <span className="hidden md:inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-medium">
                  v2.5 PROD
                </span>
              </h1>
            </div>
          </div>
        </div>

        {/* Right: AI Assistant & Google Sheet Connection */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* AI Assistant Button */}
          <button
            type="button"
            onClick={() => setAiAssistantOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-amber-600 text-white text-xs font-semibold shadow-md shadow-indigo-500/20 hover:opacity-95 transition cursor-pointer"
            title="Civil Maintenance AI Assistant"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-200" />
            <span className="hidden sm:inline">AI Assistant</span>
          </button>

          {/* Accurate Google Sheet Connection Status */}
          {isSheetConnected && !hasError ? (
            <div className="flex items-center gap-1.5 sm:gap-2 pl-2 border-l border-slate-200">
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-2xs"
                title="Google Sheet Connected & Verified"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Google Sheet Connected</span>
              </div>

              {settings.spreadsheetUrl && (
                <a
                  href={settings.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                  title="Open Google Sheet in new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline text-[11px]">Open Sheet</span>
                </a>
              )}

              <button
                onClick={handleGoogleLogout}
                title="Disconnect Google Sheet"
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : isSignedInWithoutSheet || (accessToken && hasError) ? (
            <div className="flex items-center gap-1.5 sm:gap-2 pl-2 border-l border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold shadow-2xs transition cursor-pointer"
                title={syncStatus.message || 'Open Admin Settings to link or check your Google Spreadsheet'}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>{hasError ? 'Sheet Error — Check Settings' : 'Link Google Sheet'}</span>
              </button>

              <button
                onClick={handleGoogleLogout}
                title="Sign out Google account"
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={googleAuthExpired ? reconnectGoogleAndSync : handleGoogleLogin}
              disabled={isLoggingIn}
              className={`flex items-center gap-2 px-3.5 py-1.5 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition disabled:opacity-60 cursor-pointer ${
                googleAuthExpired || hasError
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-emerald-700 hover:bg-emerald-800'
              }`}
              title={
                syncStatus.message ||
                (googleAuthExpired
                  ? 'Google session expired. Click to reconnect Google Sheet.'
                  : 'Connect Google Sheet with one click')
              }
            >
              <FileSpreadsheet className="w-4 h-4 text-white/90" />
              <span>
                {isLoggingIn
                  ? 'Connecting...'
                  : googleAuthExpired
                  ? 'Reconnect Google Sheet'
                  : 'Connect Google Sheet'}
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
