import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getTodayDateString } from '../../data/seedData';
import { WorkerRecord, WorklogRecord } from '../../types';
import { improveWorkDescription } from '../../services/gemini';
import { appendWorklogToSheet, appendAttendanceToSheet, batchUpdateWorklogToSheet } from '../../services/googleSheets';

interface WorkerWorklogState {
  worker: WorkerRecord;
  fnWork: string;
  anWork: string;
  autoSaved: boolean;
  isSaving: boolean;
  isImprovingFN: boolean;
  isImprovingAN: boolean;
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

  // Sync date with AppContext
  useEffect(() => {
    setWorkflowDate(date);
  }, [date, setWorkflowDate]);

  // Load existing records for the selected date
  useEffect(() => {
    const existingWorklogs = worklogs.filter((w) => w.date === date);
    const existingAttendance = attendance.filter((a) => a.date === date);

    const logMap = new Map<string, WorklogRecord>();
    existingWorklogs.forEach((w) => logMap.set(w.staffId.toLowerCase(), w));

    const attMap = new Map<string, any>();
    existingAttendance.forEach((a) => attMap.set(a.staffId.toLowerCase(), a));

    const initialMap: Record<string, WorkerWorklogState> = {};

    workers.forEach((worker) => {
      const staffKey = worker.staffId.toLowerCase();
      const existingLog = logMap.get(staffKey);
      const existingAtt = attMap.get(staffKey);

      let fn = '';
      let an = '';

      if (existingAtt) {
        fn = existingAtt.workDetailsFN || '';
        an = existingAtt.workDetailsAN || '';
      } else if (existingLog) {
        fn = existingLog.workDetails || '';
      }

      // User instruction: "General civil maintenance and upkeep only Emtpy box"
      // Strip any auto-filled boilerplate so the box starts completely empty
      if (
        fn.toLowerCase().includes('general civil maintenance') ||
        fn === 'Daily civil maintenance work' ||
        fn === 'General civil maintenance' ||
        fn === 'General civil maintenance FN'
      ) {
        fn = '';
      }
      if (
        an.toLowerCase().includes('general civil maintenance') ||
        an === 'Daily civil maintenance work' ||
        an === 'General civil maintenance' ||
        an === 'General civil maintenance AN'
      ) {
        an = '';
      }

      initialMap[worker.staffId] = {
        worker,
        fnWork: fn,
        anWork: an,
        autoSaved: Boolean(fn || an),
        isSaving: false,
        isImprovingFN: false,
        isImprovingAN: false,
      };
    });

    setEntries(initialMap);
  }, [date, workers, worklogs, attendance]);

  // Auto-save debounce timer
  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Handle typing in FN or AN work inputs
  const handleInputChange = (staffId: string, field: 'fnWork' | 'anWork', value: string) => {
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

    // Clear previous timeout for this worker
    if (saveTimeoutRef.current[staffId]) {
      clearTimeout(saveTimeoutRef.current[staffId]);
    }

    // Debounce save (800ms)
    saveTimeoutRef.current[staffId] = setTimeout(async () => {
      const currentEntry = entries[staffId];
      const fn = field === 'fnWork' ? value : currentEntry?.fnWork || '';
      const an = field === 'anWork' ? value : currentEntry?.anWork || '';

      const worker = workers.find((w) => w.staffId === staffId);
      if (!worker) return;

      // Persist to Worklog Record
      const combinedDetails =
        fn && an ? `FN: ${fn} | AN: ${an}` : fn || an || 'General civil maintenance and upkeep';
      const cleanDate = date.replace(/-/g, '');
      const worklogId = `WL-${cleanDate}-${staffId.replace(/[^a-zA-Z0-9]/g, '')}`;

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
        },
        worklogId,
        false // saved locally first
      );

      // Mark as auto saved
      setEntries((prev) => {
        if (!prev[staffId]) return prev;
        return {
          ...prev,
          [staffId]: {
            ...prev[staffId],
            autoSaved: true,
            isSaving: false,
          },
        };
      });
    }, 700);
  };

  // Quick action: Copy FN text to AN text
  const handleCopyFNtoAN = (staffId: string) => {
    const entry = entries[staffId];
    if (!entry || !entry.fnWork) return;
    handleInputChange(staffId, 'anWork', entry.fnWork);
    showToast('info', `Copied FN work to AN for ${entry.worker.name}`);
  };

  // Gemini AI Smart Polish for FN
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
      showToast('success', `Improved ${field === 'fnWork' ? 'FN' : 'AN'} description for ${entry.worker.name}`);
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

  // Save / Sync all entries to Google Sheets in exact user format:
  // Date | S.No | Worker Name | Category | FN Work | AN Work | Saved Time
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
          workDetailsFN: fn || 'General civil maintenance and upkeep',
          workDetailsAN: an || 'General civil maintenance and upkeep',
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

  // Check attendance status for worker on this date
  const getAttendanceStatus = (staffId: string) => {
    const att = attendance.find((a) => a.date === date && a.staffId.toLowerCase() === staffId.toLowerCase());
    return att ? `${att.attendanceFN} / ${att.attendanceAN}` : 'Unmarked';
  };

  // Filtered workers list
  const filteredWorkers = useMemo(() => {
    return workers.filter((w) => {
      const matchSearch =
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.staffId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.designation.toLowerCase().includes(searchQuery.toLowerCase());

      const matchDesig = filterDesignation === 'All' || w.designation.toLowerCase().includes(filterDesignation.toLowerCase());

      if (filterAttendance === 'Present') {
        const att = attendance.find((a) => a.date === date && a.staffId.toLowerCase() === w.staffId.toLowerCase());
        const isPresent = att && (att.attendanceFN === 'Present' || att.attendanceAN === 'Present');
        if (!isPresent) return false;
      } else if (filterAttendance === 'Pending') {
        const entry = entries[w.staffId];
        if (entry && (entry.fnWork || entry.anWork)) return false;
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
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition"
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
              placeholder="Search labour name, staff ID, or trade..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          <select
            value={filterDesignation}
            onChange={(e) => setFilterDesignation(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white font-medium"
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
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white font-medium"
          >
            <option value="All">All Workers</option>
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
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{isBulkSyncing ? 'Syncing...' : 'Sync to Sheet'}</span>
            </button>
          )}
        </div>
      </div>

      {/* WORKLOG FAST ENTRY BANNER */}
      <div className="bg-teal-50/90 border border-teal-200/90 rounded-2xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="bg-teal-800 text-white font-black px-2.5 py-1 rounded-xl text-[10px] tracking-wide uppercase shadow-xs">
            ⚡ Fast Entry
          </span>
          <span className="font-semibold text-teal-950">
            Work details start as empty boxes. Type work details and press <kbd className="px-1.5 py-0.5 rounded bg-white border border-teal-300 font-mono font-bold text-slate-800">↵ Enter</kbd> to jump directly to the next session & labour!
          </span>
        </div>
        <div className="text-[11px] text-teal-800 font-medium">
          Placeholder: <span className="italic font-normal text-slate-600">"General civil maintenance and upkeep"</span>
        </div>
      </div>

      {/* CARDS LIST MATCHING USER'S EXACT FORMAT */}
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

          return (
            <div
              key={worker.id}
              className="bg-white rounded-2xl border-2 border-teal-200/90 hover:border-teal-400 p-4 sm:p-5 shadow-xs transition duration-200"
            >
              {/* TOP HEADER: Avatar + Number + Name + Designation + Auto Saved */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  {/* Worker Avatar with Hardhat & Collar */}
                  <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center shrink-0 border border-teal-200 shadow-xs">
                    <svg className="w-6 h-6" viewBox="0 0 36 36" fill="none">
                      {/* Hardhat */}
                      <path d="M10 16C10 11.5817 13.5817 8 18 8C22.4183 8 26 11.5817 26 16H10Z" fill="#F59E0B" />
                      <path d="M8 16H28V18H8V16Z" fill="#D97706" />
                      <path d="M16 8H20V12H16V8Z" fill="#FBBF24" />
                      {/* Face */}
                      <circle cx="18" cy="21" r="5" fill="#FED7AA" />
                      <circle cx="16" cy="21" r="0.8" fill="#451A03" />
                      <circle cx="20" cy="21" r="0.8" fill="#451A03" />
                      <path d="M16.5 23.5C17 24.2 19 24.2 19.5 23.5" stroke="#451A03" strokeWidth="0.8" strokeLinecap="round" />
                      {/* Shirt / Collar */}
                      <path d="M12 28C12 25.5 14.5 25 18 25C21.5 25 24 25.5 24 28V30H12V28Z" fill="#0284C7" />
                    </svg>
                  </div>

                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight leading-tight">
                      {idx + 1}. {worker.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {worker.designation}
                    </p>
                  </div>
                </div>

                {/* Auto Saved Status Badge */}
                <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      entry.isSaving ? 'bg-amber-500 animate-ping' : 'bg-teal-600'
                    }`}
                  />
                  <span className="text-xs font-semibold text-teal-700 tracking-tight">
                    {entry.isSaving ? 'Saving...' : 'Auto Saved'}
                  </span>
                </div>
              </div>

              {/* TWO SESSIONS INPUT ROW: FN WORK (Sun) & AN WORK (Moon) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                {/* 1. FN WORK BOX */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">☀️</span>
                      <span className="tracking-wide uppercase text-[11px] font-black text-slate-800">
                        FN WORK
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleInputChange(worker.staffId, 'fnWork', 'General civil maintenance and upkeep')
                        }
                        className="text-[10px] text-teal-700 bg-teal-50 hover:bg-teal-100 font-semibold px-2 py-0.5 rounded-lg border border-teal-200 transition"
                        title="Click to fill 'General civil maintenance and upkeep' into this empty box"
                      >
                        + Upkeep
                      </button>

                      {entry.fnWork && (
                        <button
                          type="button"
                          onClick={() => handleCopyFNtoAN(worker.staffId)}
                          className="text-[10px] text-teal-700 hover:text-teal-900 font-bold px-1.5 py-0.5 rounded hover:bg-teal-50 flex items-center gap-0.5 transition"
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
                        className="text-[10px] text-amber-700 hover:text-amber-900 font-bold px-1.5 py-0.5 rounded hover:bg-amber-50 flex items-center gap-0.5 disabled:opacity-30 transition"
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
                    placeholder="General civil maintenance and upkeep"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-teal-300/80 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 text-xs sm:text-sm text-slate-800 font-medium placeholder:text-slate-400 bg-white transition"
                  />
                  <div className="flex justify-end">
                    <span className="text-[10px] text-slate-400 font-mono">Press ↵ Enter for AN</span>
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
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleInputChange(worker.staffId, 'anWork', 'General civil maintenance and upkeep')
                        }
                        className="text-[10px] text-teal-700 bg-teal-50 hover:bg-teal-100 font-semibold px-2 py-0.5 rounded-lg border border-teal-200 transition"
                        title="Click to fill 'General civil maintenance and upkeep' into this empty box"
                      >
                        + Upkeep
                      </button>

                      <button
                        type="button"
                        onClick={() => handleImprove(worker.staffId, 'anWork')}
                        disabled={entry.isImprovingAN || !entry.anWork.trim()}
                        className="text-[10px] text-amber-700 hover:text-amber-900 font-bold px-1.5 py-0.5 rounded hover:bg-amber-50 flex items-center gap-0.5 disabled:opacity-30 transition"
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
                    placeholder="General civil maintenance and upkeep"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-teal-300/80 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 text-xs sm:text-sm text-slate-800 font-medium placeholder:text-slate-400 bg-white transition"
                  />
                  <div className="flex justify-end">
                    <span className="text-[10px] text-slate-400 font-mono">Press ↵ Enter for Next Worker</span>
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
          <span className="text-teal-400 font-bold">Automatic Real-Time Storage</span>
          <p className="text-slate-400 text-[11px] mt-0.5">
            Every task entered in ☀️ FN WORK and 🌙 AN WORK is instantly auto-saved and linked to daily reports.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('daily_report')}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            View Daily Report
          </button>

          {settings.spreadsheetId && accessToken && (
            <button
              onClick={handleSyncAllToGoogleSheets}
              disabled={isBulkSyncing}
              className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md shadow-teal-600/30 flex items-center gap-1.5 transition disabled:opacity-50"
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
