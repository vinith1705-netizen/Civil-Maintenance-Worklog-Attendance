import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Save,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Building2,
  Unlink,
  ShieldAlert,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const SettingsView: React.FC = () => {
  const {
    workers,
    settings,
    updateSettings,
    connectGoogleSpreadsheet,
    createGoogleSpreadsheet,
    disconnectGoogleSpreadsheet,
    verifyGoogleSheetConnection,
    syncSheetToLocal,
    resetToSeedData,
    currentUser,
    handleGoogleLogin,
    handleDirectGoogleLogin,
    reconnectGoogleAndSync,
    accessToken,
    googleAuthExpired,
    isLoggingIn,
    syncStatus,
    isSyncing,
    isUpdatingLabour,
    updateLabourToGoogleSheet,
    updateAttendanceToGoogleSheet,
    updateWorklogToGoogleSheet,
    updateAllToGoogleSheet,
    showToast,
    setShowUnauthorizedModal,
  } = useApp();

  const [institutionName, setInstitutionName] = useState(settings.institutionName);
  const [departmentName, setDepartmentName] = useState(settings.departmentName);
  const [defaultWorkingHours, setDefaultWorkingHours] = useState(settings.defaultWorkingHours);

  // Wage rules
  const [fullDayMult, setFullDayMult] = useState(settings.wageRules.fullDayPresent);
  const [halfDayMult, setHalfDayMult] = useState(settings.wageRules.halfDayPresent);
  const [permissionMult, setPermissionMult] = useState(settings.wageRules.permission);
  const [holidayMult, setHolidayMult] = useState(settings.wageRules.holiday);

  // Sheets config
  const [sheetInput, setSheetInput] = useState(settings.spreadsheetUrl || settings.spreadsheetId || '');
  const [newSheetTitle, setNewSheetTitle] = useState('BIT Civil Maintenance Worklog & Attendance');
  const [detectedSheets, setDetectedSheets] = useState<string[]>([]);

  const hasValidGoogleToken = Boolean(accessToken && !googleAuthExpired);
  const isSheetActive = Boolean(hasValidGoogleToken && settings.spreadsheetId && syncStatus.status !== 'error');

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      institutionName,
      departmentName,
      defaultWorkingHours,
      wageRules: {
        fullDayPresent: Number(fullDayMult),
        halfDayPresent: Number(halfDayMult),
        absent: 0,
        leave: 0,
        permission: Number(permissionMult),
        holiday: Number(holidayMult),
      },
    });
  };

  const handleConnectSheet = async () => {
    if (!sheetInput.trim()) {
      showToast('error', 'Please enter a Google Spreadsheet URL or ID.');
      return;
    }
    try {
      const res = await connectGoogleSpreadsheet(sheetInput.trim());
      setDetectedSheets(res.sheets);
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleCreateNewSheet = async () => {
    try {
      const res = await createGoogleSpreadsheet(newSheetTitle);
      setSheetInput(res.url);
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
        <div>
          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px] font-bold uppercase tracking-wider">
            System Administration
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-1">Admin & Google Sheet Settings</h2>
          <p className="text-xs text-slate-500">
            Configure institutional titles, wage multiplier rules, and Google Spreadsheet source of truth.
          </p>
        </div>
      </div>

      {/* 1. Google Spreadsheet Connection Center */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-900">Google Spreadsheet Integration</h3>
          </div>
          {isSheetActive ? (
            <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-bold border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" /> Connected & Active
            </span>
          ) : syncStatus.status === 'error' ? (
            <span className="flex items-center gap-1 text-xs text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full font-bold border border-rose-200">
              <ShieldAlert className="w-3.5 h-3.5" /> Connection Error
            </span>
          ) : googleAuthExpired ? (
            <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full font-bold border border-amber-200">
              <AlertCircle className="w-3.5 h-3.5" /> Session Expired — Reconnect
            </span>
          ) : hasValidGoogleToken && !settings.spreadsheetId ? (
            <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full font-bold border border-amber-200">
              <AlertCircle className="w-3.5 h-3.5" /> Signed In — No Sheet Linked
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full font-bold border border-amber-200">
              <AlertCircle className="w-3.5 h-3.5" /> Not Connected
            </span>
          )}
        </div>

        {/* Diagnostic Error Banner */}
        {syncStatus.status === 'error' && syncStatus.message && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-rose-950">Google Sheet Connection Error</div>
                <p className="text-rose-800 mt-0.5 leading-relaxed">{syncStatus.message}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={hasValidGoogleToken && settings.spreadsheetId ? verifyGoogleSheetConnection : reconnectGoogleAndSync}
              disabled={isLoggingIn || isSyncing}
              className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg font-bold text-[11px] shrink-0 transition cursor-pointer disabled:opacity-50"
            >
              {isLoggingIn ? 'Reconnecting...' : hasValidGoogleToken && settings.spreadsheetId ? 'Retry Connection' : 'Reconnect Google'}
            </button>
          </div>
        )}

        {!hasValidGoogleToken ? (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="font-bold text-slate-900 text-sm">
                {googleAuthExpired
                  ? 'Google OAuth Session Expired — Reconnect Required'
                  : 'Google Workspace Sign-In Required'}
              </div>
              <p className="mt-0.5">
                {googleAuthExpired
                  ? `Signed in as ${currentUser?.email || 'your Google account'}, but the 1-hour Google Sheets access token has expired or reset after reload. Click "Sign in with Google" to reconnect and enable live auto-save.`
                  : 'Sign in with Google and grant Google Sheets permissions to link or create your spreadsheet.'}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span className="font-medium">Current Domain:</span>
                <code className="bg-slate-200/80 px-1.5 py-0.5 rounded text-slate-800 font-mono text-[10px]">
                  {typeof window !== 'undefined' ? window.location.hostname : 'run.app'}
                </code>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowUnauthorizedModal(true)}
                className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-semibold text-xs transition cursor-pointer"
              >
                Domain Setup Guide
              </button>
              <a
                href={typeof window !== 'undefined' ? window.location.href : '/'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-semibold text-xs transition"
                title="Open app in a full browser tab if popups are blocked inside iframe"
              >
                <span>New Tab</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <button
                type="button"
                onClick={handleDirectGoogleLogin}
                disabled={isLoggingIn}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
                title="Direct Google OAuth (bypasses Firebase popup iframe)"
              >
                {isLoggingIn ? 'Connecting...' : 'Direct OAuth Connect'}
              </button>
              <button
                type="button"
                onClick={googleAuthExpired ? reconnectGoogleAndSync : handleGoogleLogin}
                disabled={isLoggingIn}
                className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-xl font-semibold text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                <span>{isLoggingIn ? 'Connecting...' : 'Sign in with Google'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Existing Google Spreadsheet URL or ID
                </label>
                {currentUser?.email && (
                  <span className="text-[11px] text-slate-500">
                    Signed in: <strong className="text-slate-700">{currentUser.email}</strong>
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={sheetInput}
                  onChange={(e) => setSheetInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit..."
                  className="flex-1 min-w-[220px] p-2.5 border border-slate-300 rounded-xl text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={handleConnectSheet}
                  disabled={isSyncing}
                  className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {isSyncing ? 'Inspecting...' : 'Connect Sheet'}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                The application inspects headers dynamically and appends attendance & worklogs without overwriting existing data.
              </p>
              {detectedSheets.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
                  <span className="text-slate-500 font-semibold">Detected Tabs:</span>
                  {detectedSheets.map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {settings.spreadsheetId && (
              <>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-slate-600 font-medium">Linked ID: </span>
                    <span className="font-mono font-bold text-slate-900">{settings.spreadsheetId}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={settings.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${settings.spreadsheetId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-emerald-800 font-bold hover:underline"
                    >
                      <span>Open in Google Sheets</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      type="button"
                      onClick={verifyGoogleSheetConnection}
                      disabled={isSyncing}
                      className="px-2.5 py-1 bg-white border border-emerald-300 rounded-lg text-emerald-800 font-bold hover:bg-emerald-100 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      title="Verify live access to this Google Spreadsheet"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Test Connection</span>
                    </button>
                    <button
                      type="button"
                      onClick={syncSheetToLocal}
                      disabled={isSyncing}
                      className="px-2.5 py-1 bg-white border border-emerald-300 rounded-lg text-emerald-800 font-bold hover:bg-emerald-100 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>Sync Attendance</span>
                    </button>
                    <button
                      type="button"
                      onClick={disconnectGoogleSpreadsheet}
                      className="px-2.5 py-1 bg-white border border-rose-200 rounded-lg text-rose-700 font-bold hover:bg-rose-50 flex items-center gap-1 cursor-pointer"
                      title="Unlink this Spreadsheet ID to connect a different sheet"
                    >
                      <Unlink className="w-3 h-3" />
                      <span>Unlink</span>
                    </button>
                  </div>
                </div>

                {/* Exact 3-Sheet Google Sheet Sync Center */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
                    <div>
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        <span>Google Sheet Exact Schema Sync Center</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Updates Google Sheet into the 3 standardized formats for Workers, Daily Attendance, and Worklog.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => updateAllToGoogleSheet()}
                      disabled={isSyncing || isUpdatingLabour}
                      className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      title="Update all 3 sheets (Workers + Attendance + Worklog) at once"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>Update All 3 Sheets Now</span>
                    </button>
                  </div>

                  {/* Format 1: Workers */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        1. Workers Sheet (`{settings.workerSheetName || 'Workers'}`)
                      </span>
                      <button
                        type="button"
                        onClick={() => updateLabourToGoogleSheet()}
                        disabled={isUpdatingLabour}
                        className="px-3 py-1 bg-[#1b7a54] hover:bg-[#16654a] text-white font-bold rounded-lg text-[11px] transition cursor-pointer disabled:opacity-50"
                      >
                        {isUpdatingLabour ? 'Updating...' : 'Update Workers'}
                      </button>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg font-mono text-[11px] text-slate-700 overflow-x-auto border border-slate-200">
                      <div className="font-bold text-slate-900">S.No | Worker Name | Category | Status</div>
                      <div className="text-slate-500 text-[10px] mt-0.5">e.g. 1 | Mr. BAGAVATHI MURUGANANTHAM | Mason | Active</div>
                    </div>
                  </div>

                  {/* Format 2: Attendance */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        2. Attendance Sheet (`{settings.attendanceSheetName || 'Attendance'}`)
                      </span>
                      <button
                        type="button"
                        onClick={() => updateAttendanceToGoogleSheet()}
                        disabled={isSyncing}
                        className="px-3 py-1 bg-[#1b7a54] hover:bg-[#16654a] text-white font-bold rounded-lg text-[11px] transition cursor-pointer disabled:opacity-50"
                      >
                        Update Attendance
                      </button>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg font-mono text-[11px] text-slate-700 overflow-x-auto border border-slate-200">
                      <div className="font-bold text-slate-900">Date | S.No | Worker Name | Category | Attendance | Locked | Saved Time</div>
                      <div className="text-slate-500 text-[10px] mt-0.5">e.g. 2026-10-18 | 21 | Mr. KUMAR P | Carpentry | Absent | TRUE | 10/24/2026</div>
                    </div>
                  </div>

                  {/* Format 3: Worklog */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        3. Worklog Sheet (`{settings.worklogSheetName || 'Worklog'}`)
                      </span>
                      <button
                        type="button"
                        onClick={() => updateWorklogToGoogleSheet()}
                        disabled={isSyncing}
                        className="px-3 py-1 bg-[#1b7a54] hover:bg-[#16654a] text-white font-bold rounded-lg text-[11px] transition cursor-pointer disabled:opacity-50"
                      >
                        Update Worklog
                      </button>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg font-mono text-[11px] text-slate-700 overflow-x-auto border border-slate-200">
                      <div className="font-bold text-slate-900">Date | S.No | Worker Name | Category | FN Work | AN Work | Saved Time</div>
                      <div className="text-slate-500 text-[10px] mt-0.5">e.g. 2026-10-18 | 21 | Mr. KUMAR P | Carpentry | Door repair | Platform woodwork | 10/24/2026</div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Option to create a new sheet in Drive */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-bold text-slate-800">Don't have a spreadsheet yet?</span>
                <p className="text-slate-500">
                  Create a new dedicated Google Sheet in your Drive pre-loaded with Attendance, Worklog, and 34 Worker rows.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCreateNewSheet}
                disabled={isSyncing}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-semibold border border-slate-300 shrink-0 cursor-pointer disabled:opacity-50"
              >
                + Create New Spreadsheet
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Institutional Branding & Rules */}
      <form onSubmit={handleSaveGeneral} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Building2 className="w-5 h-5 text-amber-600" />
          <h3 className="font-bold text-sm text-slate-900">Department & Institution Profile</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Institution Name</label>
            <input
              type="text"
              value={institutionName}
              onChange={(e) => setInstitutionName(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl font-bold uppercase"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Department Name</label>
            <input
              type="text"
              value={departmentName}
              onChange={(e) => setDepartmentName(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl font-bold uppercase"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Default Working Hours</label>
            <input
              type="text"
              value={defaultWorkingHours}
              onChange={(e) => setDefaultWorkingHours(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl"
            />
          </div>
        </div>

        {/* 3. Wage Calculation Rules */}
        <div className="pt-4 border-t border-slate-100">
          <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600 mb-3">
            Wage Multiplier Rules (Fraction of Daily Base Wage)
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Full Day Present</label>
              <input
                type="number"
                step="0.1"
                value={fullDayMult}
                onChange={(e) => setFullDayMult(Number(e.target.value))}
                className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold"
              />
              <span className="text-[10px] text-slate-400">1.0 = 100% pay</span>
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Half Day Present</label>
              <input
                type="number"
                step="0.1"
                value={halfDayMult}
                onChange={(e) => setHalfDayMult(Number(e.target.value))}
                className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold"
              />
              <span className="text-[10px] text-slate-400">0.5 = 50% pay</span>
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Permission Pay</label>
              <input
                type="number"
                step="0.1"
                value={permissionMult}
                onChange={(e) => setPermissionMult(Number(e.target.value))}
                className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold"
              />
              <span className="text-[10px] text-slate-400">0.5 = half pay</span>
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Paid Holiday Pay</label>
              <input
                type="number"
                step="0.1"
                value={holidayMult}
                onChange={(e) => setHolidayMult(Number(e.target.value))}
                className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold"
              />
              <span className="text-[10px] text-slate-400">1.0 = 100% pay</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/30 flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>Save Settings</span>
          </button>
        </div>
      </form>

      {/* 4. Danger Zone & Master Reset */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
        <div>
          <h4 className="font-bold text-xs text-slate-900">Reset Initial Master Roster</h4>
          <p className="text-xs text-slate-500">
            Restore the initial 34 workers, campus hostels, and work categories from the civil department master archive.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Reset local application state back to default BIT civil master?')) {
              resetToSeedData();
            }
          }}
          className="px-3.5 py-2 border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-semibold rounded-xl"
        >
          Reset Master Data
        </button>
      </div>
    </div>
  );
};
