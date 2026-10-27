import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Calendar,
  Search,
  Sparkles,
  Save,
  CheckCircle2,
  FileSpreadsheet,
  ArrowLeft,
  ChevronRight,
  Filter,
  Copy,
  RotateCcw,
  Check,
  AlertCircle,
  Clock,
  UserCheck,
  UserX,
  HelpCircle,
  Trash2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getTodayDateString } from '../../data/seedData';
import { WorkerRecord, WorklogRecord, AttendanceRecord } from '../../types';
import { improveWorkDescription } from '../../services/gemini';
import { batchUpdateWorklogToSheet } from '../../services/googleSheets';

interface WorkerWorklogState {
  worker: WorkerRecord;
  fnWork: string;
  anWork: string;
  autoSaved: boolean;
  isSaving: boolean;
  isImprovingFN: boolean;
  isImprovingAN: boolean;
  lastSavedAt?: string;
}

export const WorklogEntryView: React.FC = () => {
  const {
    workers,
    attendance,
    worklogs,
    saveWorklogRecord,
    settings,
    accessToken,
    workflowDate,
    setWorkflowDate,
    setActiveTab,
    showToast,
  } = useApp();

  const [date, setDate] = useState<string>(workflowDate || getTodayDateString());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterDesignation, setFilterDesignation] = useState<string>('All');
  const [filterAttendance, setFilterAttendance] = useState<'All' | 'Present' | 'Pending'>('All');
  const [isBulkSyncing, setIsBulkSyncing] = useState<boolean>(false);

  // Maintain local state for each worker's FN and AN work
  const [entries, setEntries] = useState<Record<string, WorkerWorklogState>>({});

  // Keep a ref to the latest entries state to prevent stale closures in debounce callbacks
  const entriesRef = useRef<Record<string, WorkerWorklogState>>({});
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  // Auto-save debounce timers by staffId
  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Sync date with AppContext
  useEffect(() => {
    setWorkflowDate(date);
  }, [date, setWorkflowDate]);

  // Strip only legacy hardcoded seed demo text, NEVER strip user-typed text
  const isLegacySeedPlaceholder = (text: string) => {
    const t = text.trim();
    return (
      t === 'Parapet wall brick plastering and water sump ledge masonry repair work.' ||
      t === 'Parapet wall brick plastering and water sump ledge masonry repair work' ||
      t === 'Second floor corridor tile joints grouting and skirting fixing'
    );
  };

  // Load existing records whenever the date or worker list changes
  useEffect(() => {
    const existingWorklogs = worklogs.filter((w) => w.date === date);
    const existingAttendance = attendance.filter((a) => a.date === date);

    const logMap = new Map<string, WorklogRecord>();
    existingWorklogs.forEach((w) => logMap.set(w.staffId.toLowerCase(), w));

    const attMap = new Map<string, AttendanceRecord>();
    existingAttendance.forEach((a) => attMap.set(a.staffId.toLowerCase(), a));

    setEntries((prev) => {
      const nextMap: Record<string, WorkerWorklogState> = {};

      workers.forEach((worker) => {
        const staffKey = worker.staffId.toLowerCase();
        const existingLog = logMap.get(staffKey);
        const existingAtt = attMap.get(staffKey);

        let fn = '';
        let an = '';

        // Priority 1: Check Attendance record for this day
        if (existingAtt) {
          if (existingAtt.workDetailsFN && existingAtt.workDetailsFN !== 'Absent') {
            fn = existingAtt.workDetailsFN;
          }
          if (existingAtt.workDetailsAN && existingAtt.workDetailsAN !== 'Absent') {
            an = existingAtt.workDetailsAN;
          }
        }

        // Priority 2: If details are still blank, check Worklog record
        if ((!fn || !an) && existingLog?.workDetails) {
          const details = existingLog.workDetails;
          if (details.includes('FN:') || details.includes('AN:')) {
            const fnMatch = details.match(/FN:\s*([^|]+)/i);
            const anMatch = details.match(/AN:\s*(.+)$/i);
            if (!fn && fnMatch) fn = fnMatch[1].trim();
            if (!an && anMatch) an = anMatch[1].trim();
          } else if (!fn) {
            fn = details;
          }
        }

        if (isLegacySeedPlaceholder(fn)) fn = '';
        if (isLegacySeedPlaceholder(an)) an = '';

        // Preserve any ongoing user editing or existing local state if present
        const currentLocal = prev[worker.staffId];
        const preservedFn = currentLocal?.isSaving || currentLocal?.fnWork ? currentLocal.fnWork : fn;
        const preservedAn = currentLocal?.isSaving || currentLocal?.anWork ? currentLocal.anWork : an;

        nextMap[worker.staffId] = {
          worker,
          fnWork: preservedFn,
          anWork: preservedAn,
          autoSaved: currentLocal ? currentLocal.autoSaved : Boolean(fn || an),
          isSaving: currentLocal ? currentLocal.isSaving : false,
          isImprovingFN: currentLocal ? currentLocal.isImprovingFN : false,
          isImprovingAN: currentLocal ? currentLocal.isImprovingAN : false,
          lastSavedAt: currentLocal?.lastSavedAt,
        };
      });

      return nextMap;
    });
  }, [date, workers]);

  // Core save routine for a worker's worklog
  const performSave = useCallback(
    async (staffId: string, fnText: string, anText: string, isManual = false) => {
      const worker = workers.find((w) => w.staffId === staffId);
      if (!worker) return;

      const fn = fnText.trim();
      const an = anText.trim();

      const combinedDetails = fn && an ? `FN: ${fn} | AN: ${an}` : fn || an || '';
      const cleanDate = date.replace(/-/g, '');
      const worklogId = `WL-${cleanDate}-${staffId.replace(/[^a-zA-Z0-9]/g, '')}`;

      try {
        await saveWorklogRecord(
          {
            date,
            staffId: worker.staffId,
            workerName: worker.name,
            designation: worker.designation,
            workCategory: worker.category || 'Civil Maintenance',
            workLocation: 'Campus Sites',
            workDetails: combinedDetails,
            session: fn && an ? 'Full Day' : fn ? 'Forenoon' : 'Afternoon',
            status: 'Completed',
            remarks: `Logged for ${date}`,
            workDetailsFN: fn,
            workDetailsAN: an,
          },
          worklogId,
          false, // do not sync to sheet on every keystroke
          isManual // show toast notification only when user manually clicked Save
        );

        setEntries((prev) => {
          if (!prev[staffId]) return prev;
          return {
            ...prev,
            [staffId]: {
              ...prev[staffId],
              autoSaved: true,
              isSaving: false,
              lastSavedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            },
          };
        });

        if (isManual) {
          showToast('success', `Saved worklog for ${worker.name}`);
        }
      } catch (err: any) {
        console.error('Failed to save worklog:', err);
        setEntries((prev) => {
          if (!prev[staffId]) return prev;
          return {
            ...prev,
            [staffId]: {
              ...prev[staffId],
              isSaving: false,
            },
          };
        });
        showToast('error', `Could not save worklog: ${err?.message || 'Unknown error'}`);
      }
    },
    [date, workers, saveWorklogRecord, showToast]
  );

  // Handle typing in FN or AN work inputs
  const handleInputChange = (staffId: string, field: 'fnWork' | 'anWork', value: string) => {
    // 1. Immediately update state so typed characters appear with zero delay
    setEntries((prev) => {
      const current = prev[staffId];
      if (!current) return prev;
      return {
        ...prev,
        [staffId]: {
          ...current,
          [field]: value,
          autoSaved: false,
          isSaving: true,
        },
      };
    });

    // 2. Clear any pending debounced timeout for this worker
    if (saveTimeoutRef.current[staffId]) {
      clearTimeout(saveTimeoutRef.current[staffId]);
    }

    // 3. Debounce save (600ms) reading freshest entriesRef
    saveTimeoutRef.current[staffId] = setTimeout(() => {
      const current = entriesRef.current[staffId];
      const fn = field === 'fnWork' ? value : current?.fnWork || '';
      const an = field === 'anWork' ? value : current?.anWork || '';
      performSave(staffId, fn, an, false);
    }, 600);
  };

  // Immediate manual save action
  const handleManualSave = (staffId: string) => {
    if (saveTimeoutRef.current[staffId]) {
      clearTimeout(saveTimeoutRef.current[staffId]);
    }
    const current = entriesRef.current[staffId];
    if (!current) return;
    performSave(staffId, current.fnWork, current.anWork, true);
  };

  // Quick action: Copy FN text to AN text
  const handleCopyFNtoAN = (staffId: string) => {
    const entry = entries[staffId];
    if (!entry || !entry.fnWork) return;
    handleInputChange(staffId, 'anWork', entry.fnWork);
    showToast('info', `Copied FN work to AN for ${entry.worker.name}`);
  };

  // Quick action: Clear both FN and AN for a worker
  const handleClearWorkerLog = (staffId: string) => {
    handleInputChange(staffId, 'fnWork', '');
    handleInputChange(staffId, 'anWork', '');
  };

  // Gemini AI Smart Polish for FN or AN
  const handleImprove = async (staffId: string, field: 'fnWork' | 'anWork') => {
    const entry = entries[staffId];
    if (!entry) return;
    const textToImprove = field === 'fnWork' ? entry.fnWork : entry.anWork;
    if (!textToImprove.trim()) return;

    setEntries((prev) => ({
      ...prev,
      [staffId]: {
        ...prev[staffId],
        [field === 'fnWork' ? 'isImprovingFN' : 'isImprovingAN']: true,
      },
    }));

    try {
      const improved = await improveWorkDescription(textToImprove, {
        workerName: entry.worker.name,
        designation: entry.worker.designation,
      });

      handleInputChange(staffId, field, improved);
      showToast('success', `Refined ${field === 'fnWork' ? 'FN' : 'AN'} description for ${entry.worker.name}`);
    } catch {
      showToast('error', 'Could not refine description.');
    } finally {
      setEntries((prev) => ({
        ...prev,
        [staffId]: {
          ...prev[staffId],
          [field === 'fnWork' ? 'isImprovingFN' : 'isImprovingAN']: false,
        },
      }));
    }
  };

  // Save / Sync all entries to Google Sheets
  const handleSyncAllToGoogleSheets = async () => {
    if (!settings.spreadsheetId || !accessToken) {
      showToast('warning', 'Please connect your Google Sheet in Settings to sync.');
      return;
    }

    setIsBulkSyncing(true);

    try {
      const recordsToSync: any[] = [];
      for (const worker of workers) {
        const entry = entries[worker.staffId];
        const fn = entry?.fnWork || '';
        const an = entry?.anWork || '';
        const existingAtt = attendance.find((a) => a.date === date && a.staffId === worker.staffId);

        recordsToSync.push({
          id: existingAtt?.id || `CMWL-${date.replace(/-/g, '')}-${worker.staffId}`,
          date,
          staffId: worker.staffId,
          workerName: worker.name,
          designation: worker.designation,
          workCategory: worker.category || 'Civil Maintenance',
          workDetailsFN: fn || '',
          workDetailsAN: an || '',
          attendanceFN: existingAtt?.attendanceFN || (fn ? 'Present' : 'Absent'),
          attendanceAN: existingAtt?.attendanceAN || (an ? 'Present' : 'Absent'),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      const res = await batchUpdateWorklogToSheet(
        settings.spreadsheetId,
        settings.worklogSheetName || 'Worklog',
        recordsToSync,
        workers,
        accessToken
      );

      showToast(
        'success',
        `Synced all ${res.count} worklog entries to Google Sheet "Worklog" tab in exact format (Date | S.No | Worker Name | Category | FN Work | AN Work | Saved Time)!`
      );
    } catch (err: any) {
      showToast('error', `Sync failed: ${err.message}`);
    } finally {
      setIsBulkSyncing(false);
    }
  };

  // Helper to determine attendance badge & status for a worker
  const getWorkerAttendanceInfo = (staffId: string) => {
    const att = attendance.find(
      (a) => a.date === date && a.staffId.toLowerCase() === staffId.toLowerCase()
    );

    if (!att) {
      return {
        label: 'Roll Call Pending',
        isMarked: false,
        isPresent: false,
        isAbsent: false,
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
        fnStatus: 'Unmarked',
        anStatus: 'Unmarked',
      };
    }

    const isPresent = att.attendanceFN === 'Present' || att.attendanceAN === 'Present';
    const isBothPresent = att.attendanceFN === 'Present' && att.attendanceAN === 'Present';
    const isAbsent = att.attendanceFN === 'Absent' && att.attendanceAN === 'Absent';

    if (isBothPresent) {
      return {
        label: 'Present (Full Day)',
        isMarked: true,
        isPresent: true,
        isAbsent: false,
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        fnStatus: att.attendanceFN,
        anStatus: att.attendanceAN,
      };
    }

    if (isPresent) {
      return {
        label: `Half Day (FN: ${att.attendanceFN}, AN: ${att.attendanceAN})`,
        isMarked: true,
        isPresent: true,
        isAbsent: false,
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
        fnStatus: att.attendanceFN,
        anStatus: att.attendanceAN,
      };
    }

    if (isAbsent) {
      return {
        label: 'Absent in Roll Call',
        isMarked: true,
        isPresent: false,
        isAbsent: true,
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
        fnStatus: att.attendanceFN,
        anStatus: att.attendanceAN,
      };
    }

    return {
      label: `${att.attendanceFN} / ${att.attendanceAN}`,
      isMarked: true,
      isPresent: false,
      isAbsent: false,
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      fnStatus: att.attendanceFN,
      anStatus: att.attendanceAN,
    };
  };

  // Filtered workers list
  const filteredWorkers = useMemo(() => {
    return workers.filter((w) => {
      const matchSearch =
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.staffId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.designation.toLowerCase().includes(searchQuery.toLowerCase());

      const matchDesig =
        filterDesignation === 'All' ||
        w.designation.toLowerCase().includes(filterDesignation.toLowerCase());

      if (filterAttendance === 'Present') {
        const att = attendance.find(
          (a) => a.date === date && a.staffId.toLowerCase() === w.staffId.toLowerCase()
        );
        const isPresent = att && (att.attendanceFN === 'Present' || att.attendanceAN === 'Present');
        if (!isPresent) return false;
      } else if (filterAttendance === 'Pending') {
        const entry = entries[w.staffId];
        if (entry && (entry.fnWork.trim() || entry.anWork.trim())) return false;
      }

      return matchSearch && matchDesig;
    });
  }, [workers, searchQuery, filterDesignation, filterAttendance, attendance, date, entries]);

  // Statistics
  const totalLoggedCount = useMemo(() => {
    return Object.values(entries).filter((e) => e.fnWork.trim() || e.anWork.trim()).length;
  }, [entries]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* 2-STEP WORKFLOW PROGRESS BREADCRUMB */}
      <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => {
                setWorkflowDate(date);
                setActiveTab('attendance_entry');
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>STEP 1: ALL LABOURS ATTENDANCE</span>
            </button>

            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />

            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-teal-700 text-white shadow-md shadow-teal-700/20 font-bold text-xs">
              <span className="w-5 h-5 rounded-full bg-white text-teal-800 flex items-center justify-center text-[11px] font-black">
                2
              </span>
              <span>STEP 2: LOG WORK ENTRY</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Work Log Date:</span>
            <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900">
              <Calendar className="w-3.5 h-3.5 text-teal-700" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent focus:outline-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* FILTER & QUICK SYNC BAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search labour name, staff ID (e.g. CM41001), trade..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white text-slate-900"
            />
          </div>

          <select
            value={filterDesignation}
            onChange={(e) => setFilterDesignation(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white font-medium text-slate-800"
          >
            <option value="All">All Trades ({workers.length})</option>
            <option value="Mason">Masons</option>
            <option value="Carpent">Carpenters</option>
            <option value="Welder">Welders</option>
            <option value="Helper">Helpers</option>
            <option value="Polish">Polishers</option>
          </select>

          <select
            value={filterAttendance}
            onChange={(e) => setFilterAttendance(e.target.value as any)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white font-medium text-slate-800"
          >
            <option value="All">All Workers ({workers.length})</option>
            <option value="Present">Present Only</option>
            <option value="Pending">Pending Log</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-500 font-medium mr-1">
            <strong className="text-teal-800 font-bold">{totalLoggedCount}</strong> of{' '}
            <strong className="text-slate-900">{workers.length}</strong> logged
          </div>

          {settings.spreadsheetId && accessToken && (
            <button
              onClick={handleSyncAllToGoogleSheets}
              disabled={isBulkSyncing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{isBulkSyncing ? 'Syncing...' : 'Sync to Sheet'}</span>
            </button>
          )}
        </div>
      </div>

      {/* FAST ENTRY BANNER */}
      <div className="bg-teal-50/90 border border-teal-200/90 rounded-2xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="bg-teal-800 text-white font-black px-2.5 py-1 rounded-xl text-[10px] tracking-wide uppercase shadow-xs">
            ⚡ Fast Entry
          </span>
          <span className="font-semibold text-teal-950">
            Work details start as empty boxes. Type civil task details and press{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-teal-300 font-mono font-bold text-slate-800">
              ↵ Enter
            </kbd>{' '}
            to jump directly to the next session & labour!
          </span>
        </div>
      </div>

      {/* EMPTY STATE IF NO LABOURS MATCH */}
      {filteredWorkers.length === 0 && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No labours found matching your filter</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {filterAttendance === 'Present'
              ? `No workers are marked 'Present' for ${date}. Complete Step 1 Attendance Roll Call or switch filter to 'All Workers' to log entries.`
              : 'Try clearing the search query or changing the trade filter to see labours.'}
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => {
                setFilterAttendance('All');
                setSearchQuery('');
                setFilterDesignation('All');
              }}
              className="px-3.5 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              Show All Workers ({workers.length})
            </button>
            <button
              onClick={() => {
                setWorkflowDate(date);
                setActiveTab('attendance_entry');
              }}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              Go to Step 1: Roll Call
            </button>
          </div>
        </div>
      )}

      {/* WORKER CARDS LIST */}
      <div className="space-y-4">
        {filteredWorkers.map((worker, idx) => {
          const entry = entries[worker.staffId] || {
            worker,
            fnWork: '',
            anWork: '',
            autoSaved: false,
            isSaving: false,
            isImprovingFN: false,
            isImprovingAN: false,
          };

          const attInfo = getWorkerAttendanceInfo(worker.staffId);
          const hasLoggedWork = Boolean(entry.fnWork.trim() || entry.anWork.trim());

          return (
            <div
              key={worker.id}
              className={`bg-white rounded-2xl border-2 p-4 sm:p-5 shadow-xs transition duration-200 ${
                hasLoggedWork
                  ? 'border-teal-400 bg-teal-50/20'
                  : 'border-slate-200/90 hover:border-teal-300'
              }`}
            >
              {/* TOP HEADER: Avatar + Number + Name + Designation + Attendance Badge + Save Status */}
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  {/* Worker Avatar with Hardhat */}
                  <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center shrink-0 border border-teal-200 shadow-xs">
                    <svg className="w-6 h-6" viewBox="0 0 36 36" fill="none">
                      <path
                        d="M10 16C10 11.5817 13.5817 8 18 8C22.4183 8 26 11.5817 26 16H10Z"
                        fill="#F59E0B"
                      />
                      <path d="M8 16H28V18H8V16Z" fill="#D97706" />
                      <path d="M16 8H20V12H16V8Z" fill="#FBBF24" />
                      <circle cx="18" cy="21" r="5" fill="#FED7AA" />
                      <circle cx="16" cy="21" r="0.8" fill="#451A03" />
                      <circle cx="20" cy="21" r="0.8" fill="#451A03" />
                      <path
                        d="M16.5 23.5C17 24.2 19 24.2 19.5 23.5"
                        stroke="#451A03"
                        strokeWidth="0.8"
                        strokeLinecap="round"
                      />
                      <path
                        d="M12 28C12 25.5 14.5 25 18 25C21.5 25 24 25.5 24 28V30H12V28Z"
                        fill="#0284C7"
                      />
                    </svg>
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight leading-tight">
                        {idx + 1}. {worker.name}
                      </h3>
                      <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {worker.staffId}
                      </span>
                      <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                        {worker.designation}
                      </span>
                    </div>

                    {/* Attendance roll call status */}
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${attInfo.badgeClass}`}
                      >
                        {attInfo.isPresent ? (
                          <UserCheck className="w-3 h-3 text-emerald-600" />
                        ) : attInfo.isAbsent ? (
                          <UserX className="w-3 h-3 text-rose-600" />
                        ) : (
                          <HelpCircle className="w-3 h-3 text-slate-400" />
                        )}
                        <span>{attInfo.label}</span>
                      </span>

                      {attInfo.isAbsent && (
                        <span className="text-[10px] text-rose-600 font-medium">
                          (Marked absent in roll call)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Save Status & Action Controls */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Status Indicator */}
                  <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        entry.isSaving
                          ? 'bg-amber-500 animate-ping'
                          : hasLoggedWork
                          ? 'bg-teal-600'
                          : 'bg-slate-300'
                      }`}
                    />
                    <span className="text-xs font-semibold text-slate-700">
                      {entry.isSaving
                        ? 'Saving...'
                        : entry.autoSaved
                        ? 'Auto Saved'
                        : hasLoggedWork
                        ? 'Draft'
                        : 'Empty'}
                    </span>
                  </div>

                  {/* Manual Save Button */}
                  <button
                    type="button"
                    onClick={() => handleManualSave(worker.staffId)}
                    disabled={entry.isSaving}
                    className="p-1.5 rounded-xl border border-teal-200 hover:bg-teal-50 text-teal-700 hover:text-teal-900 transition cursor-pointer"
                    title="Save worklog immediately"
                  >
                    <Save className="w-4 h-4" />
                  </button>

                  {/* Clear Button */}
                  {(entry.fnWork || entry.anWork) && (
                    <button
                      type="button"
                      onClick={() => handleClearWorkerLog(worker.staffId)}
                      className="p-1.5 rounded-xl border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                      title="Clear work text for this labour"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* TWO SESSIONS INPUT ROW: FN WORK (Sun) & AN WORK (Moon) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                {/* 1. FN WORK BOX */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">☀️</span>
                      <span className="tracking-wide uppercase text-[11px] font-black text-slate-800">
                        FN WORK
                      </span>
                      {entry.fnWork && (
                        <span className="text-[10px] text-teal-700 font-mono font-normal">
                          ({entry.fnWork.length} chars)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleInputChange(worker.staffId, 'fnWork', 'Civil maintenance work')
                        }
                        className="text-[10px] text-teal-700 bg-teal-50 hover:bg-teal-100 font-semibold px-2 py-0.5 rounded-lg border border-teal-200 transition cursor-pointer"
                        title="Click to fill quick task into this box"
                      >
                        + Maintenance
                      </button>

                      {entry.fnWork && (
                        <button
                          type="button"
                          onClick={() => handleCopyFNtoAN(worker.staffId)}
                          className="text-[10px] text-teal-700 hover:text-teal-900 font-bold px-1.5 py-0.5 rounded hover:bg-teal-50 flex items-center gap-0.5 transition cursor-pointer"
                          title="Copy FN description to AN"
                        >
                          <Copy className="w-2.5 h-2.5" />
                          <span>Copy to AN</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleImprove(worker.staffId, 'fnWork')}
                        disabled={entry.isImprovingFN || !entry.fnWork.trim()}
                        className="text-[10px] text-amber-700 hover:text-amber-900 font-bold px-1.5 py-0.5 rounded hover:bg-amber-50 flex items-center gap-0.5 disabled:opacity-30 transition cursor-pointer"
                        title="Improve grammar and civil terminology with AI"
                      >
                        <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                        <span>{entry.isImprovingFN ? 'Improving...' : 'AI Polish'}</span>
                      </button>
                    </div>
                  </div>

                  <input
                    id={`fn-work-${worker.staffId}`}
                    type="text"
                    value={entry.fnWork}
                    onChange={(e) => handleInputChange(worker.staffId, 'fnWork', e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const anInput = document.getElementById(`an-work-${worker.staffId}`);
                        if (anInput) anInput.focus();
                      }
                    }}
                    placeholder=""
                    className="w-full px-3.5 py-2.5 rounded-xl border-2 border-teal-200/90 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 text-xs sm:text-sm text-slate-900 font-medium placeholder:text-slate-400 bg-white transition shadow-2xs"
                  />
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span>Forenoon session description</span>
                    <span className="font-mono">Press ↵ Enter for AN</span>
                  </div>
                </div>

                {/* 2. AN WORK BOX */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">🌙</span>
                      <span className="tracking-wide uppercase text-[11px] font-black text-slate-800">
                        AN WORK
                      </span>
                      {entry.anWork && (
                        <span className="text-[10px] text-teal-700 font-mono font-normal">
                          ({entry.anWork.length} chars)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleInputChange(worker.staffId, 'anWork', 'Civil maintenance work')
                        }
                        className="text-[10px] text-teal-700 bg-teal-50 hover:bg-teal-100 font-semibold px-2 py-0.5 rounded-lg border border-teal-200 transition cursor-pointer"
                        title="Click to fill quick task into this box"
                      >
                        + Maintenance
                      </button>

                      <button
                        type="button"
                        onClick={() => handleImprove(worker.staffId, 'anWork')}
                        disabled={entry.isImprovingAN || !entry.anWork.trim()}
                        className="text-[10px] text-amber-700 hover:text-amber-900 font-bold px-1.5 py-0.5 rounded hover:bg-amber-50 flex items-center gap-0.5 disabled:opacity-30 transition cursor-pointer"
                        title="Improve grammar and civil terminology with AI"
                      >
                        <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                        <span>{entry.isImprovingAN ? 'Improving...' : 'AI Polish'}</span>
                      </button>
                    </div>
                  </div>

                  <input
                    id={`an-work-${worker.staffId}`}
                    type="text"
                    value={entry.anWork}
                    onChange={(e) => handleInputChange(worker.staffId, 'anWork', e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const nextWorker = filteredWorkers[idx + 1];
                        if (nextWorker) {
                          const nextFn = document.getElementById(`fn-work-${nextWorker.staffId}`);
                          if (nextFn) {
                            nextFn.focus();
                            nextFn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }
                      }
                    }}
                    placeholder=""
                    className="w-full px-3.5 py-2.5 rounded-xl border-2 border-teal-200/90 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 text-xs sm:text-sm text-slate-900 font-medium placeholder:text-slate-400 bg-white transition shadow-2xs"
                  />
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span>Afternoon session description</span>
                    <span className="font-mono">Press ↵ Enter for Next Worker</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* FOOTER BAR */}
      <div className="sticky bottom-4 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 border border-slate-800">
        <div className="text-xs">
          <div className="flex items-center gap-2">
            <span className="text-teal-400 font-bold">Automatic Real-Time Storage</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-300">
              <strong className="text-white font-bold">{totalLoggedCount}</strong> of {workers.length} labours logged
            </span>
          </div>
          <p className="text-slate-400 text-[11px] mt-0.5">
            Every task entered in ☀️ FN WORK and 🌙 AN WORK is instantly auto-saved and synced with attendance & daily reports.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('daily_report')}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
          >
            View Daily Report
          </button>

          {settings.spreadsheetId && accessToken && (
            <button
              onClick={handleSyncAllToGoogleSheets}
              disabled={isBulkSyncing}
              className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md shadow-teal-600/30 flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{isBulkSyncing ? 'Writing to Sheet...' : 'Sync All to Google Sheet'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
