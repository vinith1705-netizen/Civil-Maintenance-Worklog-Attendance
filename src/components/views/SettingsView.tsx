import React, { useState } from 'react';
import {
  Settings,
  FileSpreadsheet,
  Save,
  RotateCcw,
  Plus,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Database,
  Building2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const SettingsView: React.FC = () => {
  const {
    workers,
    settings,
    updateSettings,
    connectGoogleSpreadsheet,
    createGoogleSpreadsheet,
    syncSheetToLocal,
    resetToSeedData,
    currentUser,
    handleGoogleLogin,
    accessToken,
    isSyncing,
    isUpdatingLabour,
    updateLabourToGoogleSheet,
    importLabourFromGoogleSheet,
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
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-900">Google Spreadsheet Integration</h3>
          </div>
          {settings.spreadsheetId ? (
            <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-bold border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" /> Connected & Active
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full font-bold border border-amber-200">
              <AlertCircle className="w-3.5 h-3.5" /> Not Connected
            </span>
          )}
        </div>

        {!currentUser ? (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="font-bold text-slate-900 text-sm">Google Workspace Sign-In Required</div>
              <p className="mt-0.5">
                Sign in with Google to sync directly to Google Sheets and Firestore.
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
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-xs shadow-xs transition cursor-pointer"
              >
                Sign in with Google
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Existing Google Spreadsheet URL or ID
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={sheetInput}
                  onChange={(e) => setSheetInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit..."
                  className="flex-1 p-2.5 border border-slate-300 rounded-xl text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={handleConnectSheet}
                  disabled={isSyncing}
                  className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {isSyncing ? 'Inspecting...' : 'Connect Sheet'}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                The application inspects headers dynamically and appends attendance & worklogs without overwriting existing data.
              </p>
            </div>

            {settings.spreadsheetId && (
              <>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-slate-600 font-medium">Linked ID: </span>
                    <span className="font-mono font-bold text-slate-900">{settings.spreadsheetId}</span>
                  </div>
                  <div className="flex items-center gap-2">
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
                      onClick={syncSheetToLocal}
                      disabled={isSyncing}
                      className="px-2.5 py-1 bg-white border border-emerald-300 rounded-lg text-emerald-800 font-bold hover:bg-emerald-100 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>Sync Attendance</span>
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
