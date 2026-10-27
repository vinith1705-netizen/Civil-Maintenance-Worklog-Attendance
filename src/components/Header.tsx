import React from 'react';
import {
  Building2,
  Sparkles,
  FileSpreadsheet,
  LogOut,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  Menu,
  Database,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const Header: React.FC<{ onToggleMobileMenu?: () => void }> = ({ onToggleMobileMenu }) => {
  const {
    settings,
    currentUser,
    handleGoogleLogin,
    handleGoogleLogout,
    isLoggingIn,
    syncStatus,
    syncSheetToLocal,
    isSyncing,
    setAiAssistantOpen,
  } = useApp();

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
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold tracking-wider text-amber-700 uppercase bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  {settings.institutionName}
                </span>
                <span className="hidden sm:inline-block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  • {settings.departmentName}
                </span>
              </div>
              <h1 className="text-sm md:text-base font-bold text-slate-900 tracking-tight leading-tight flex items-center gap-1.5">
                <span>Civil Maintenance Worklog & Attendance</span>
                <span className="hidden md:inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-medium">
                  v2.5 PROD
                </span>
              </h1>
            </div>
          </div>
        </div>

        {/* Right: Quick actions, Sheet status, AI button, Google Sign-in */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* AI Assistant Button */}
          <button
            type="button"
            onClick={() => setAiAssistantOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-amber-600 text-white text-xs font-semibold shadow-md shadow-indigo-500/20 hover:opacity-95 transition"
            title="Civil Maintenance AI Assistant"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-200" />
            <span className="hidden sm:inline">AI Assistant</span>
          </button>

          {/* Google Sheet Sync Status Badge */}
          {settings.spreadsheetId ? (
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-medium max-w-[120px] truncate" title={settings.spreadsheetUrl}>
                Connected
              </span>
              <button
                onClick={syncSheetToLocal}
                disabled={isSyncing}
                title="Sync from Google Sheet"
                className="p-1 hover:bg-emerald-100 rounded text-emerald-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          ) : (
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs">
              <Database className="w-3.5 h-3.5 text-slate-400" />
              <span>Local Storage Active</span>
            </div>
          )}

          {/* Google Auth Button / User Profile */}
          {currentUser ? (
            <div className="flex items-center gap-2 pl-1 border-l border-slate-200">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'User'}
                  className="w-8 h-8 rounded-full border border-slate-300"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                  {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <div className="hidden xl:block text-left text-xs leading-tight">
                <div className="font-semibold text-slate-800 truncate max-w-[110px]">
                  {currentUser.displayName || 'Authorized User'}
                </div>
                <div className="text-[10px] text-emerald-600 flex items-center gap-0.5">
                  <ShieldCheck className="w-3 h-3" /> Sheets Ready
                </div>
              </div>
              <button
                onClick={handleGoogleLogout}
                title="Sign out"
                className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl shadow-xs transition disabled:opacity-60"
            >
              <svg className="w-4 h-4" viewBox="0 0 48 48">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              <span>{isLoggingIn ? 'Connecting...' : 'Sign in with Google'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
