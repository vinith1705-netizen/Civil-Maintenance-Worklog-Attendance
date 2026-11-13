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
  ChevronLeft,
  CalendarDays,
  CalendarRange,
  Layers,
  ListFilter,
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
  ExternalLink,
  Download,
  LayoutGrid,
  Table as TableIcon,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getTodayDateString } from '../../data/seedData';
import { WorkerRecord, WorklogRecord, AttendanceRecord } from '../../types';
import { improveWorkDescription } from '../../services/gemini';
import { batchUpdateWorklogToSheet, isGoogleAuthError, extractFNAfternoonWork } from '../../services/googleSheets';

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
    googleAuthExpired,
    reconnectGoogleAndSync,
    handleGoogleLogin,
    isLoggingIn,
    workflowDate,
    setWorkflowDate,
    setActiveTab,
    showToast,
  } = useApp();

  const [date, setDate] = useState<string>(workflowDate || getTodayDateString());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterDesignation, setFilterDesignation] = useState<string>('All');
  const [filterAttendance, setFilterAttendance] = useState<'Present' | 'All' | 'Pending'>('Present');
  const [viewMode, setViewMode] = useState<'cards' | 'sheet'>('cards');
  const [isBulkSyncing, setIsBulkSyncing] = useState<boolean>(false);

  // Date Filter Scope: 'daily' (single day entry) vs 'monthly' (monthly date entry filter)
  const [timeFilterMode, setTimeFilterMode] = useState<'daily' | 'monthly'>('daily');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = workflowDate || getTodayDateString();
    return d.slice(0, 7); // e.g. "2026-11"
  });
  const [monthlyDateFilter, setMonthlyDateFilter] = useState<string>('ALL'); // 'ALL' or specific YYYY-MM-DD

  // Maintain local state for each worker's FN and AN work in daily view
  const [entries, setEntries] = useState<Record<string, WorkerWorklogState>>({});

  // Maintain local edit state for monthly table rows by worklog id
  interface MonthlyRowEditState {
    fnWork: string;
    anWork: string;
    isSaving: boolean;
    autoSaved: boolean;
    lastSavedAt?: string;
    isImprovingFN?: boolean;
    isImprovingAN?: boolean;
  }
  const [monthlyRowEdits, setMonthlyRowEdits] = useState<Record<string, MonthlyRowEditState>>({});
  const monthlyEditsRef = useRef<Record<string, MonthlyRowEditState>>({});
  useEffect(() => {
    monthlyEditsRef.current = monthlyRowEdits;
  }, [monthlyRowEdits]);
  const monthlySaveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

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

        // Priority 2: Check Worklog record
        if ((!fn || !an) && existingLog) {
          if (existingLog.workDetailsFN && !fn) fn = existingLog.workDetailsFN;
          if (existingLog.workDetailsAN && !an) an = existingLog.workDetailsAN;
        }

        // Clean & extract pure FN and AN without cross-pollination or "FN:" / "AN:" prefixes
        const extracted = extractFNAfternoonWork(fn, an, existingLog?.workDetails);
        fn = extracted.fnWork;
        an = extracted.anWork;

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

      const { fnWork: fn, anWork: an } = extractFNAfternoonWork(fnText, anText);

      const combinedDetails = fn && an && fn !== an ? `FN: ${fn} | AN: ${an}` : fn || an || '';
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
            workLocation: '',
            workDetails: combinedDetails,
            session: fn && an ? 'Full Day' : fn ? 'Forenoon' : 'Afternoon',
            status: 'Completed',
            remarks: `Logged for ${date}`,
            workDetailsFN: fn,
            workDetailsAN: an,
          },
          worklogId,
          Boolean(settings.spreadsheetId && accessToken), // Fully auto-save to Google Sheet in exact format
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
          showToast(
            'success',
            settings.spreadsheetId && accessToken
              ? `Saved & auto-synced worklog for ${worker.name} to Google Sheet!`
              : `Saved worklog for ${worker.name}`
          );
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

  // Save / Sync all entries to Google Sheets (Only Present Labours)
  const handleSyncAllToGoogleSheets = async () => {
    if (!settings.spreadsheetId || !accessToken) {
      showToast('warning', 'Please connect your Google Sheet in Settings to sync.');
      return;
    }

    setIsBulkSyncing(true);

    try {
      const recordsToSync: any[] = [];
      for (const worker of workers) {
        const existingAtt = attendance.find((a) => a.date === date && a.staffId === worker.staffId);
        const isPresent = existingAtt && (existingAtt.attendanceFN === 'Present' || existingAtt.attendanceAN === 'Present');
        const entry = entries[worker.staffId];
        const fn = entry?.fnWork || '';
        const an = entry?.anWork || '';

        // Exclude absent workers from the Worklog tab (Only present workers get daily worklog entries)
        if (!isPresent) continue;

        const { fnWork: fnPure, anWork: anPure } = extractFNAfternoonWork(fn, an);

        recordsToSync.push({
          id: existingAtt?.id || `CMWL-${date.replace(/-/g, '')}-${worker.staffId}`,
          date,
          staffId: worker.staffId,
          workerName: worker.name,
          designation: worker.designation,
          workCategory: worker.category || 'Civil Maintenance',
          workDetailsFN: fnPure,
          workDetailsAN: anPure,
          attendanceFN: existingAtt?.attendanceFN || 'Present',
          attendanceAN: existingAtt?.attendanceAN || 'Present',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      if (recordsToSync.length === 0) {
        showToast('warning', `No labours marked 'Present' found for ${date}. Complete Step 1 Attendance roll call first.`);
        return;
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
      if (isGoogleAuthError(err)) {
        showToast(
          'error',
          'Google session expired (valid for 1 hour). Click "Reconnect Google" at the top to renew credentials and save to Sheet.',
          'Session Expired'
        );
      } else {
        showToast('error', `Sync failed: ${err.message}`);
      }
    } finally {
      setIsBulkSyncing(false);
    }
  };

  // Download / Export Daily Worklog matching exact Google Sheet format
  const handleExportDailyWorklogCSV = () => {
    const headers = ['Date', 'S.No', 'Worker Name', 'Category', 'FN Work', 'AN Work', 'Saved Time'];
    const sNoMap = new Map<string, number>();
    workers.forEach((w, idx) => sNoMap.set(w.staffId.toLowerCase(), idx + 1));
    const nowStr = new Date().toLocaleDateString('en-US');

    const rows = filteredWorkers.map((w, idx) => {
      const entry = entries[w.staffId];
      const sNo = sNoMap.get(w.staffId.toLowerCase()) || idx + 1;
      const { fnWork, anWork } = extractFNAfternoonWork(entry?.fnWork, entry?.anWork);
      return [
        date,
        sNo,
        `"${w.name}"`,
        `"${w.category || w.designation || 'Civil Maintenance'}"`,
        `"${fnWork.replace(/"/g, '""')}"`,
        `"${anWork.replace(/"/g, '""')}"`,
        `"${nowStr}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BIT_Civil_Worklog_Daily_${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', `Exported daily worklog for ${rows.length} labours.`);
  };

  // Day & Month navigation handlers
  const handlePrevDay = () => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    const prev = d.toISOString().slice(0, 10);
    setDate(prev);
    setWorkflowDate(prev);
  };

  const handleNextDay = () => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    const next = d.toISOString().slice(0, 10);
    setDate(next);
    setWorkflowDate(next);
  };

  const handleToday = () => {
    const today = getTodayDateString();
    setDate(today);
    setWorkflowDate(today);
    setSelectedMonth(today.slice(0, 7));
  };

  const handlePrevMonth = () => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    let y = parseInt(yearStr, 10);
    let m = parseInt(monthStr, 10) - 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    const next = `${y}-${String(m).padStart(2, '0')}`;
    setSelectedMonth(next);
    setMonthlyDateFilter('ALL');
  };

  const handleNextMonth = () => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    let y = parseInt(yearStr, 10);
    let m = parseInt(monthStr, 10) + 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    const next = `${y}-${String(m).padStart(2, '0')}`;
    setSelectedMonth(next);
    setMonthlyDateFilter('ALL');
  };

  const handleCurrentMonth = () => {
    const current = getTodayDateString().slice(0, 7);
    setSelectedMonth(current);
    setMonthlyDateFilter('ALL');
  };

  const handleJumpToDaily = (targetDate: string) => {
    setDate(targetDate);
    setWorkflowDate(targetDate);
    setTimeFilterMode('daily');
    showToast('info', `Switched to Daily Entry for ${targetDate}`);
  };

  const formattedSelectedMonth = useMemo(() => {
    if (!selectedMonth) return '';
    const [y, m] = selectedMonth.split('-');
    const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  // All distinct dates in selected month that have worklogs or attendance
  const monthlyDatesWithData = useMemo(() => {
    const countsByDate = new Map<string, { worklogs: number; attendance: number }>();

    worklogs.forEach((w) => {
      if (w.date.startsWith(selectedMonth)) {
        const cur = countsByDate.get(w.date) || { worklogs: 0, attendance: 0 };
        cur.worklogs += 1;
        countsByDate.set(w.date, cur);
      }
    });

    attendance.forEach((a) => {
      if (a.date.startsWith(selectedMonth)) {
        const cur = countsByDate.get(a.date) || { worklogs: 0, attendance: 0 };
        cur.attendance += 1;
        countsByDate.set(a.date, cur);
      }
    });

    return Array.from(countsByDate.entries())
      .map(([d, counts]) => ({ date: d, ...counts }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [worklogs, attendance, selectedMonth]);

  // Monthly worklogs filtered by search, category, and date-in-month
  const monthlyWorklogs = useMemo(() => {
    let logs = worklogs.filter((w) => w.date.startsWith(selectedMonth));
    if (monthlyDateFilter !== 'ALL') {
      logs = logs.filter((w) => w.date === monthlyDateFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      logs = logs.filter(
        (w) =>
          w.workerName.toLowerCase().includes(q) ||
          w.staffId.toLowerCase().includes(q) ||
          w.designation.toLowerCase().includes(q) ||
          (w.workDetailsFN && w.workDetailsFN.toLowerCase().includes(q)) ||
          (w.workDetailsAN && w.workDetailsAN.toLowerCase().includes(q))
      );
    }
    if (filterDesignation !== 'All') {
      logs = logs.filter(
        (w) =>
          w.workCategory?.toLowerCase() === filterDesignation.toLowerCase() ||
          w.designation.toLowerCase().includes(filterDesignation.toLowerCase())
      );
    }

    const sNoMap = new Map<string, number>();
    workers.forEach((w, idx) => sNoMap.set(w.staffId.toLowerCase(), idx + 1));

    return logs.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      const sNoA = sNoMap.get(a.staffId.toLowerCase()) || 999;
      const sNoB = sNoMap.get(b.staffId.toLowerCase()) || 999;
      return sNoA - sNoB;
    });
  }, [worklogs, selectedMonth, monthlyDateFilter, searchQuery, filterDesignation, workers]);

  // Total unique logged rows in current monthly view
  const monthlyTotalLoggedCount = useMemo(() => {
    return monthlyWorklogs.filter((w) => {
      const edit = monthlyRowEdits[w.id];
      const fn = edit !== undefined ? edit.fnWork : w.workDetailsFN;
      const an = edit !== undefined ? edit.anWork : w.workDetailsAN;
      return Boolean((fn && fn.trim()) || (an && an.trim()));
    }).length;
  }, [monthlyWorklogs, monthlyRowEdits]);

  // Monthly inline editing handler with debounce auto-save to Google Sheet & Firestore
  const handleMonthlyRowChange = (log: WorklogRecord, field: 'fnWork' | 'anWork', val: string) => {
    const currentFN = monthlyEditsRef.current[log.id]?.fnWork ?? (log.workDetailsFN || '');
    const currentAN = monthlyEditsRef.current[log.id]?.anWork ?? (log.workDetailsAN || '');
    const nextFN = field === 'fnWork' ? val : currentFN;
    const nextAN = field === 'anWork' ? val : currentAN;

    setMonthlyRowEdits((prev) => ({
      ...prev,
      [log.id]: {
        ...prev[log.id],
        fnWork: nextFN,
        anWork: nextAN,
        isSaving: true,
        autoSaved: false,
      },
    }));

    if (monthlySaveTimeoutRef.current[log.id]) {
      clearTimeout(monthlySaveTimeoutRef.current[log.id]);
    }

    monthlySaveTimeoutRef.current[log.id] = setTimeout(async () => {
      const { fnWork: cleanFN, anWork: cleanAN } = extractFNAfternoonWork(nextFN, nextAN);
      try {
        await saveWorklogRecord(
          {
            date: log.date,
            staffId: log.staffId,
            workerName: log.workerName,
            designation: log.designation,
            workCategory: log.workCategory,
            workLocation: log.workLocation || '',
            workDetails: cleanFN && cleanAN && cleanFN !== cleanAN ? `FN: ${cleanFN} | AN: ${cleanAN}` : cleanFN || cleanAN || '',
            session: cleanFN && cleanAN ? 'Full Day' : cleanFN ? 'Forenoon' : 'Afternoon',
            status: 'Completed',
            remarks: log.remarks || `Logged for ${log.date}`,
            workDetailsFN: cleanFN,
            workDetailsAN: cleanAN,
          },
          log.id,
          Boolean(settings.spreadsheetId && accessToken),
          false
        );

        setMonthlyRowEdits((prev) => ({
          ...prev,
          [log.id]: {
            ...prev[log.id],
            isSaving: false,
            autoSaved: true,
            lastSavedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          },
        }));
      } catch (err: any) {
        console.error('Monthly row save error:', err);
        setMonthlyRowEdits((prev) => ({
          ...prev,
          [log.id]: {
            ...prev[log.id],
            isSaving: false,
          },
        }));
        showToast('error', `Failed to save monthly worklog: ${err?.message || 'Error'}`);
      }
    }, 600);
  };

  // AI Polish for a Monthly Row
  const handleImproveMonthlyRow = async (log: WorklogRecord, field: 'fnWork' | 'anWork') => {
    const currentFN = monthlyEditsRef.current[log.id]?.fnWork ?? (log.workDetailsFN || '');
    const currentAN = monthlyEditsRef.current[log.id]?.anWork ?? (log.workDetailsAN || '');
    const text = field === 'fnWork' ? currentFN : currentAN;
    if (!text.trim()) return;

    setMonthlyRowEdits((prev) => ({
      ...prev,
      [log.id]: {
        ...prev[log.id],
        fnWork: currentFN,
        anWork: currentAN,
        isSaving: false,
        autoSaved: false,
        [field === 'fnWork' ? 'isImprovingFN' : 'isImprovingAN']: true,
      },
    }));

    try {
      const improved = await improveWorkDescription(text, {
        workerName: log.workerName,
        designation: log.designation,
      });
      handleMonthlyRowChange(log, field, improved);
      showToast('success', `Refined ${field === 'fnWork' ? 'FN' : 'AN'} description for ${log.workerName}`);
    } catch {
      showToast('error', 'Could not refine description.');
    } finally {
      setMonthlyRowEdits((prev) => ({
        ...prev,
        [log.id]: {
          ...prev[log.id],
          [field === 'fnWork' ? 'isImprovingFN' : 'isImprovingAN']: false,
        },
      }));
    }
  };

  // Copy FN to AN in a Monthly Row
  const handleCopyFNtoANMonthly = (log: WorklogRecord) => {
    const currentFN = monthlyEditsRef.current[log.id]?.fnWork ?? (log.workDetailsFN || '');
    if (!currentFN) return;
    handleMonthlyRowChange(log, 'anWork', currentFN);
    showToast('info', `Copied FN work to AN for ${log.workerName} (${log.date})`);
  };

  // Download / Export Monthly Worklog CSV (Exact 7-column schema)
  const handleExportMonthlyWorklogCSV = () => {
    const headers = ['Date', 'S.No', 'Worker Name', 'Category', 'FN Work', 'AN Work', 'Saved Time'];
    const sNoMap = new Map<string, number>();
    workers.forEach((w, idx) => sNoMap.set(w.staffId.toLowerCase(), idx + 1));
    const nowStr = new Date().toLocaleDateString('en-US');

    const rows = monthlyWorklogs.map((log) => {
      const sNo = sNoMap.get(log.staffId.toLowerCase()) || '';
      const edit = monthlyEditsRef.current[log.id];
      const rawFN = edit !== undefined ? edit.fnWork : log.workDetailsFN;
      const rawAN = edit !== undefined ? edit.anWork : log.workDetailsAN;
      const { fnWork, anWork } = extractFNAfternoonWork(rawFN, rawAN, log.workDetails);
      return [
        log.date,
        sNo,
        `"${log.workerName}"`,
        `"${log.workCategory || log.designation || 'Civil Maintenance'}"`,
        `"${fnWork.replace(/"/g, '""')}"`,
        `"${anWork.replace(/"/g, '""')}"`,
        `"${nowStr}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BIT_Civil_Worklog_Monthly_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', `Exported monthly worklog (${rows.length} entries) for ${formattedSelectedMonth}.`);
  };

  // Bulk sync all monthly records to Google Sheets
  const handleSyncMonthlyToGoogleSheets = async () => {
    if (!settings.spreadsheetId || !accessToken) {
      showToast('warning', 'Please connect your Google Sheet in Settings to sync.');
      return;
    }
    setIsBulkSyncing(true);
    try {
      const recordsToSync = monthlyWorklogs.map((log) => {
        const edit = monthlyEditsRef.current[log.id];
        const rawFN = edit !== undefined ? edit.fnWork : log.workDetailsFN;
        const rawAN = edit !== undefined ? edit.anWork : log.workDetailsAN;
        const { fnWork, anWork } = extractFNAfternoonWork(rawFN, rawAN, log.workDetails);
        return {
          ...log,
          workDetailsFN: fnWork,
          workDetailsAN: anWork,
        };
      });

      if (recordsToSync.length === 0) {
        showToast('warning', `No worklog records to sync for ${formattedSelectedMonth}.`);
        return;
      }

      const res = await batchUpdateWorklogToSheet(
        settings.spreadsheetId,
        settings.worklogSheetName || 'Worklog',
        recordsToSync as any,
        workers,
        accessToken
      );

      showToast(
        'success',
        `Synced all ${res.count} monthly worklog entries for ${formattedSelectedMonth} to Google Sheet!`
      );
    } catch (err: any) {
      if (isGoogleAuthError(err)) {
        showToast('error', 'Google session expired. Reconnect Google at top.', 'Session Expired');
      } else {
        showToast('error', `Monthly sync failed: ${err.message}`);
      }
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
      // Exclude Inactive workers from worklog entry format
      if (w.status !== 'Active') return false;

      const matchSearch =
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.staffId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.designation.toLowerCase().includes(searchQuery.toLowerCase());

      const matchDesig =
        filterDesignation === 'All' ||
        w.category?.toLowerCase() === filterDesignation.toLowerCase() ||
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

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* VIEW MODE SWITCHER: Cards vs Google Sheet View */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cards View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('sheet')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'sheet'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Google Sheet {timeFilterMode === 'monthly' ? 'Monthly' : 'Daily'} View</span>
              </button>
            </div>

            {/* DATE SCOPE TOGGLE: Daily Entry vs Monthly Date Filter */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setTimeFilterMode('daily')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  timeFilterMode === 'daily'
                    ? 'bg-teal-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Log / View worklog for a single specific day"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Daily</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTimeFilterMode('monthly');
                  if (!selectedMonth) setSelectedMonth(date.slice(0, 7));
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  timeFilterMode === 'monthly'
                    ? 'bg-teal-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Monthly Date Entry Filter & Multi-Date Google Sheet View"
              >
                <CalendarRange className="w-3.5 h-3.5" />
                <span>Monthly Filter</span>
              </button>
            </div>

            {/* DATE OR MONTH CONTROLS */}
            {timeFilterMode === 'daily' ? (
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900">
                  <button
                    type="button"
                    onClick={handlePrevDay}
                    title="Previous Day"
                    className="p-1 rounded hover:bg-slate-200 text-slate-600 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <Calendar className="w-3.5 h-3.5 text-teal-700" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-transparent focus:outline-none cursor-pointer text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleNextDay}
                    title="Next Day"
                    className="p-1 rounded hover:bg-slate-200 text-slate-600 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleToday}
                  className="px-2 py-1 text-xs rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border border-slate-200 cursor-pointer"
                  title="Jump to Today"
                >
                  Today
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="flex items-center gap-1 bg-teal-50 px-2 py-1 rounded-xl border border-teal-200 text-xs font-bold text-teal-900">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    title="Previous Month"
                    className="p-1 rounded hover:bg-teal-100 text-teal-800 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <CalendarDays className="w-3.5 h-3.5 text-teal-700" />
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => {
                      setSelectedMonth(e.target.value);
                      setMonthlyDateFilter('ALL');
                    }}
                    className="bg-transparent focus:outline-none cursor-pointer text-xs font-bold text-teal-900"
                  />
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    title="Next Month"
                    className="p-1 rounded hover:bg-teal-100 text-teal-800 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleCurrentMonth}
                  className="px-2 py-1 text-xs rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold border border-teal-200 cursor-pointer"
                  title="Current Month"
                >
                  This Month
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FILTER & QUICK SYNC BAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search labour name, staff ID, task details..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white text-slate-900"
            />
          </div>

          <select
            value={filterDesignation}
            onChange={(e) => setFilterDesignation(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white font-medium text-slate-800 cursor-pointer"
          >
            <option value="All">All Categories ({workers.filter((w) => w.status === 'Active').length})</option>
            <option value="Mason Work">Mason Work</option>
            <option value="Carpentry Work">Carpentry Work</option>
            <option value="Welding Work">Welding Work</option>
          </select>

          {timeFilterMode === 'daily' ? (
            <select
              value={filterAttendance}
              onChange={(e) => setFilterAttendance(e.target.value as any)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white font-medium text-slate-800 cursor-pointer"
            >
              <option value="All">All Workers ({workers.filter((w) => w.status === 'Active').length})</option>
              <option value="Present">Present Only</option>
              <option value="Pending">Pending Log</option>
            </select>
          ) : (
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs">
              <Filter className="w-3.5 h-3.5 text-teal-700" />
              <span className="text-[11px] font-bold text-slate-500">Date Filter:</span>
              <select
                value={monthlyDateFilter}
                onChange={(e) => setMonthlyDateFilter(e.target.value)}
                className="bg-transparent font-bold text-teal-900 focus:outline-none cursor-pointer"
              >
                <option value="ALL">
                  All Dates in {formattedSelectedMonth} ({monthlyDatesWithData.reduce((acc, d) => acc + d.worklogs, 0)} logs)
                </option>
                {monthlyDatesWithData.map((d) => (
                  <option key={d.date} value={d.date}>
                    {d.date} ({d.worklogs} logs)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-500 font-medium mr-1">
            {timeFilterMode === 'daily' ? (
              <>
                <strong className="text-teal-800 font-bold">{totalLoggedCount}</strong> of{' '}
                <strong className="text-slate-900">{workers.filter((w) => w.status === 'Active').length}</strong> logged
              </>
            ) : (
              <>
                <strong className="text-teal-800 font-bold">{monthlyWorklogs.length}</strong> logs across{' '}
                <strong className="text-slate-900">{monthlyDatesWithData.length}</strong> active days
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Google Sheet Full Auto-Save Active</span>
          </div>
        </div>
      </div>

      {viewMode === 'sheet' ? (
        timeFilterMode === 'monthly' ? (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* GOOGLE SHEET MONTHLY WORKLOG BANNER */}
            <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 text-white rounded-2xl p-4 md:p-5 shadow-lg border border-emerald-700 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-300 shrink-0 border border-white/20">
                    <FileSpreadsheet className="w-6 h-6 text-emerald-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-[10px] font-bold uppercase tracking-wider font-mono">
                        Google Sheet • Tab: {settings.worklogSheetName || 'Worklog'}
                      </span>
                      <span className="text-xs text-emerald-200 font-medium">Monthly Work Log Entry & Audit</span>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold tracking-tight text-white mt-0.5">
                      Monthly Worklog Entries — {formattedSelectedMonth}
                    </h2>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {settings.spreadsheetUrl && (
                    <a
                      href={settings.spreadsheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 transition cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Open in Google Sheets</span>
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={handleExportMonthlyWorklogCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 transition cursor-pointer"
                    title="Download 7-column CSV for offline backup"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Export Monthly CSV ({monthlyWorklogs.length})</span>
                  </button>

                  {settings.spreadsheetId && accessToken && !googleAuthExpired ? (
                    <button
                      type="button"
                      onClick={handleSyncMonthlyToGoogleSheets}
                      disabled={isBulkSyncing}
                      className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 active:scale-95 text-emerald-950 text-xs font-black shadow-md shadow-emerald-500/30 transition cursor-pointer disabled:opacity-50"
                      title="Sync all monthly records to Google Sheet Worklog tab"
                    >
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-950 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-950"></span>
                      </span>
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-950" />
                      <span>{isBulkSyncing ? 'Auto-Saving...' : 'Sync Monthly to Google Sheet'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={googleAuthExpired ? reconnectGoogleAndSync : handleGoogleLogin}
                      disabled={isLoggingIn}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-xs font-black shadow-md shadow-emerald-500/30 transition cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>
                        {isLoggingIn
                          ? 'Connecting...'
                          : googleAuthExpired
                          ? 'Reconnect Google Sheet'
                          : 'Connect Google Sheet (Auto-Save)'}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-emerald-950/60 rounded-xl p-2.5 px-3 border border-emerald-800/80 flex flex-wrap items-center justify-between text-[11px] text-emerald-200 gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-emerald-400 font-bold">Exact Schema:</span>
                  <span className="font-mono text-white text-[11px]">
                    Date | S.No | Worker Name | Category | Forenoon Work (FN) | Afternoon Work (AN) | Saved Time
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-emerald-300 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Full Auto-Save Active</span>
                  </span>
                  <span>•</span>
                  <span>
                    Showing <strong className="text-white font-bold">{monthlyWorklogs.length}</strong> entries across{' '}
                    <strong className="text-white font-bold">{monthlyDatesWithData.length}</strong> active days
                  </span>
                </div>
              </div>
            </div>

            {/* MONTHLY DATE QUICK FILTER STRIP */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-2 overflow-x-auto text-xs">
              <div className="flex items-center gap-1.5 text-slate-500 font-bold text-[11px] shrink-0 mr-1">
                <Calendar className="w-3.5 h-3.5 text-teal-700" />
                <span>Date Filter:</span>
              </div>

              <button
                type="button"
                onClick={() => setMonthlyDateFilter('ALL')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                  monthlyDateFilter === 'ALL'
                    ? 'bg-teal-800 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                All Dates ({monthlyWorklogs.length})
              </button>

              {monthlyDatesWithData.map((d) => {
                const isSelected = monthlyDateFilter === d.date;
                const dateObj = new Date(d.date + 'T12:00:00');
                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                const formattedD = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                return (
                  <div key={d.date} className="flex items-center shrink-0">
                    <button
                      type="button"
                      onClick={() => setMonthlyDateFilter(d.date)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-l-xl text-xs font-semibold transition cursor-pointer border ${
                        isSelected
                          ? 'bg-teal-700 text-white border-teal-800 shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span className="font-mono">{formattedD}</span>
                      <span className="text-[10px] opacity-80 uppercase">({dayName})</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
                        }`}
                      >
                        {d.worklogs}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleJumpToDaily(d.date)}
                      title={`Jump to Daily Entry for ${d.date}`}
                      className={`px-2 py-1 rounded-r-xl border-y border-r text-[10px] font-bold transition cursor-pointer ${
                        isSelected
                          ? 'bg-teal-800 text-teal-100 border-teal-800 hover:bg-teal-900'
                          : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200 hover:text-slate-800'
                      }`}
                    >
                      Daily →
                    </button>
                  </div>
                );
              })}
            </div>

            {/* MONTHLY GOOGLE SHEET TABULAR VIEW */}
            {monthlyWorklogs.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">No monthly worklog records found</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {monthlyDateFilter !== 'ALL'
                    ? `No entries found for date ${monthlyDateFilter}. Clear the date filter or switch to Daily Entry to log work for this day.`
                    : `No worklogs have been logged yet for ${formattedSelectedMonth}. Use Step 1 Roll Call or switch to Daily Entry to start logging.`}
                </p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  {monthlyDateFilter !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setMonthlyDateFilter('ALL')}
                      className="px-3.5 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                    >
                      Show All Dates in {formattedSelectedMonth}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setDate(monthlyDateFilter !== 'ALL' ? monthlyDateFilter : getTodayDateString());
                      setTimeFilterMode('daily');
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                  >
                    Go to Daily Entry
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-emerald-50/90 border-b border-emerald-200 text-emerald-950 font-bold text-[11px] uppercase tracking-wider">
                        <th className="py-2.5 px-3 border-r border-emerald-200 whitespace-nowrap w-28">Date</th>
                        <th className="py-2.5 px-2 border-r border-emerald-200 text-center whitespace-nowrap w-12">S.No</th>
                        <th className="py-2.5 px-3 border-r border-emerald-200 whitespace-nowrap min-w-[200px]">Worker Name</th>
                        <th className="py-2.5 px-3 border-r border-emerald-200 whitespace-nowrap min-w-[130px]">Category</th>
                        <th className="py-2.5 px-3 border-r border-emerald-200 min-w-[300px]">
                          <div className="flex items-center justify-between gap-1">
                            <span>Forenoon Work (FN)</span>
                            <span className="text-[9px] font-mono font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-300">
                              8.00 AM - 12.30 PM
                            </span>
                          </div>
                        </th>
                        <th className="py-2.5 px-3 border-r border-emerald-200 min-w-[300px]">
                          <div className="flex items-center justify-between gap-1">
                            <span>Afternoon Work (AN)</span>
                            <span className="text-[9px] font-mono font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-300">
                              01.30 PM - 5.30 PM
                            </span>
                          </div>
                        </th>
                        <th className="py-2.5 px-3 border-r border-emerald-200 whitespace-nowrap w-28">Saved Time</th>
                        <th className="py-2.5 px-2 text-center whitespace-nowrap w-24">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {monthlyWorklogs.map((log, idx) => {
                        const edit = monthlyRowEdits[log.id];
                        const { fnWork: defaultFN, anWork: defaultAN } = extractFNAfternoonWork(
                          log.workDetailsFN,
                          log.workDetailsAN,
                          log.workDetails
                        );
                        const currentFN = edit !== undefined ? edit.fnWork : defaultFN;
                        const currentAN = edit !== undefined ? edit.anWork : defaultAN;
                        const isSaving = edit?.isSaving || false;
                        const isAutoSaved = edit?.autoSaved || Boolean(log.syncedToSheet);
                        const savedTimeStr = edit?.lastSavedAt || (log.createdAt ? new Date(log.createdAt).toLocaleDateString('en-US') : new Date().toLocaleDateString('en-US'));

                        const sNo = workers.findIndex((w) => w.staffId.toLowerCase() === log.staffId.toLowerCase()) + 1;
                        const dateObj = new Date(log.date + 'T12:00:00');
                        const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'short' });

                        const matchAtt = attendance.find(
                          (a) => a.date === log.date && a.staffId.toLowerCase() === log.staffId.toLowerCase()
                        );
                        const isRowAbsent =
                          (currentFN && currentFN.trim().toLowerCase() === 'absent') ||
                          (currentAN && currentAN.trim().toLowerCase() === 'absent') ||
                          (matchAtt && matchAtt.attendanceFN === 'Absent' && matchAtt.attendanceAN === 'Absent');

                        return (
                          <tr
                            key={`${log.id}-${idx}`}
                            className={`transition group ${
                              isRowAbsent
                                ? 'bg-rose-50/90 hover:bg-rose-100/90 border-rose-300'
                                : 'hover:bg-emerald-50/30'
                            }`}
                          >
                            <td className="py-2 px-3 border-r border-slate-200 font-mono text-[11px] whitespace-nowrap">
                              <div className="font-bold text-slate-800">{log.date}</div>
                              <span className="text-[10px] text-slate-500 font-sans uppercase font-medium">{dayOfWeek}</span>
                            </td>
                            <td className="py-2 px-2 border-r border-slate-200 text-center font-mono font-bold text-slate-800 text-[11px]">
                              {sNo || idx + 1}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-200">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900 leading-tight">{log.workerName}</span>
                                {isRowAbsent && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-rose-200 text-rose-900 border border-rose-300">
                                    ABSENT
                                  </span>
                                )}
                              </div>
                              <div className="font-mono text-[10px] text-slate-500">{log.staffId}</div>
                            </td>
                            <td className="py-2 px-3 border-r border-slate-200 font-medium text-slate-700 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 text-[11px]">
                                {log.workCategory || log.designation}
                              </span>
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-200">
                              <div className="relative">
                                <input
                                  type="text"
                                  value={currentFN}
                                  onChange={(e) => handleMonthlyRowChange(log, 'fnWork', e.target.value)}
                                  placeholder="Enter FN tasks (8.00 AM - 12.30 PM)..."
                                  className={`w-full text-xs px-2.5 py-1.5 rounded-lg border focus:outline-none focus:ring-1 ${
                                    currentFN.toLowerCase() === 'absent'
                                      ? 'border-rose-300 text-rose-900 font-bold bg-rose-50/50 focus:border-rose-500 focus:ring-rose-400'
                                      : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-500 bg-white'
                                  }`}
                                />
                                {currentFN && (
                                  <button
                                    type="button"
                                    onClick={() => handleImproveMonthlyRow(log, 'fnWork')}
                                    disabled={edit?.isImprovingFN}
                                    title="AI Refine description"
                                    className="absolute right-1.5 top-1.5 p-1 rounded hover:bg-slate-100 text-amber-600 disabled:opacity-50 cursor-pointer"
                                  >
                                    <Sparkles className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-200">
                              <div className="relative">
                                <input
                                  type="text"
                                  value={currentAN}
                                  onChange={(e) => handleMonthlyRowChange(log, 'anWork', e.target.value)}
                                  placeholder="Enter AN tasks (01.30 PM - 5.30 PM)..."
                                  className={`w-full text-xs px-2.5 py-1.5 rounded-lg border focus:outline-none focus:ring-1 ${
                                    currentAN.toLowerCase() === 'absent'
                                      ? 'border-rose-300 text-rose-900 font-bold bg-rose-50/50 focus:border-rose-500 focus:ring-rose-400'
                                      : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-500 bg-white'
                                  }`}
                                />
                                {currentAN && (
                                  <button
                                    type="button"
                                    onClick={() => handleImproveMonthlyRow(log, 'anWork')}
                                    disabled={edit?.isImprovingAN}
                                    title="AI Refine description"
                                    className="absolute right-1.5 top-1.5 p-1 rounded hover:bg-slate-100 text-amber-600 disabled:opacity-50 cursor-pointer"
                                  >
                                    <Sparkles className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-3 border-r border-slate-200 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                {isSaving ? (
                                  <span className="text-amber-600 font-sans text-[10px] font-bold flex items-center gap-1">
                                    <Clock className="w-3 h-3 animate-spin" /> Saving...
                                  </span>
                                ) : isAutoSaved ? (
                                  <span className="text-emerald-700 flex items-center gap-1 font-sans text-[10px] font-bold">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Auto-saved
                                  </span>
                                ) : (
                                  <span>{savedTimeStr}</span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleCopyFNtoANMonthly(log)}
                                  title="Copy FN to AN"
                                  disabled={!currentFN}
                                  className="p-1 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 disabled:opacity-20 transition cursor-pointer"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleJumpToDaily(log.date)}
                                  title={`Jump to Daily Entry for ${log.date}`}
                                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-800 transition cursor-pointer"
                                >
                                  Edit Day
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* GOOGLE SHEET WORKLOG BANNER */}
            <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white rounded-2xl p-4 md:p-5 shadow-lg border border-emerald-700 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-300 shrink-0 border border-white/20">
                    <FileSpreadsheet className="w-6 h-6 text-emerald-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-[10px] font-bold uppercase tracking-wider font-mono">
                        Google Sheet • Tab: {settings.worklogSheetName || 'Worklog'}
                      </span>
                      <span className="text-xs text-emerald-200 font-medium">Daily Muster Entry</span>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold tracking-tight text-white mt-0.5">
                      Daily Worklog Entries for {date}
                    </h2>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {settings.spreadsheetUrl && (
                    <a
                      href={settings.spreadsheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 transition cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Open in Google Sheets</span>
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={handleExportDailyWorklogCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 transition cursor-pointer"
                    title="Download matching 7-column CSV for offline backup"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Export CSV</span>
                  </button>

                  {settings.spreadsheetId && accessToken && !googleAuthExpired ? (
                    <button
                      type="button"
                      onClick={handleSyncAllToGoogleSheets}
                      disabled={isBulkSyncing}
                      className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 active:scale-95 text-emerald-950 text-xs font-black shadow-md shadow-emerald-500/30 transition cursor-pointer disabled:opacity-50"
                      title="Google Sheet Full Auto-Save is active. Click to immediately force-save all rows to Google Sheet in exact format."
                    >
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-950 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-950"></span>
                      </span>
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-950" />
                      <span>{isBulkSyncing ? 'Auto-Saving...' : 'Google Sheet Full Auto-Save Active'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={googleAuthExpired ? reconnectGoogleAndSync : handleGoogleLogin}
                      disabled={isLoggingIn}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-xs font-black shadow-md shadow-emerald-500/30 transition cursor-pointer"
                      title="Connect Google Sheet to enable full auto-save"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>
                        {isLoggingIn
                          ? 'Connecting...'
                          : googleAuthExpired
                          ? 'Reconnect Google Sheet'
                          : 'Connect Google Sheet (Auto-Save)'}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-emerald-950/60 rounded-xl p-2.5 px-3 border border-emerald-800/80 flex flex-wrap items-center justify-between text-[11px] text-emerald-200 gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-emerald-400 font-bold">Exact Schema:</span>
                  <span className="font-mono text-white text-[11px]">
                    Date | S.No | Worker Name | Category | Forenoon Work (FN) | Afternoon Work (AN) | Saved Time
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-emerald-300 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Full Auto-Save Active</span>
                  </span>
                  <span>•</span>
                  <span>
                    Showing <strong className="text-white font-bold">{filteredWorkers.length}</strong> labours
                  </span>
                </div>
              </div>
            </div>

            {/* GOOGLE SHEET TABULAR VIEW */}
            {filteredWorkers.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">No labours found matching your filter</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {filterAttendance === 'Present'
                    ? `No workers are marked 'Present' for ${date}. In Step 1 Attendance Roll Call, mark present labours to log their work.`
                    : 'Try clearing the search query or changing trade filter to see labours.'}
                </p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
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
                    type="button"
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
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-emerald-50/90 border-b border-emerald-200 text-emerald-950 font-bold text-[11px] uppercase tracking-wider">
                        <th className="py-2.5 px-3 border-r border-emerald-200 whitespace-nowrap w-24">Date</th>
                        <th className="py-2.5 px-2 border-r border-emerald-200 text-center whitespace-nowrap w-12">S.No</th>
                        <th className="py-2.5 px-3 border-r border-emerald-200 whitespace-nowrap min-w-[200px]">Worker Name</th>
                        <th className="py-2.5 px-3 border-r border-emerald-200 whitespace-nowrap min-w-[130px]">Category</th>
                        <th className="py-2.5 px-3 border-r border-emerald-200 min-w-[300px]">
                          <div className="flex items-center justify-between gap-1">
                            <span>Forenoon Work (FN)</span>
                            <span className="text-[9px] font-mono font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-300">
                              8.00 AM - 12.30 PM
                            </span>
                          </div>
                        </th>
                        <th className="py-2.5 px-3 border-r border-emerald-200 min-w-[300px]">
                          <div className="flex items-center justify-between gap-1">
                            <span>Afternoon Work (AN)</span>
                            <span className="text-[9px] font-mono font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-300">
                              01.30 PM - 5.30 PM
                            </span>
                          </div>
                        </th>
                        <th className="py-2.5 px-3 border-r border-emerald-200 whitespace-nowrap w-28">Saved Time</th>
                        <th className="py-2.5 px-2 text-center whitespace-nowrap w-16">Quick</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
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
                        const sNo = workers.findIndex((w) => w.staffId === worker.staffId) + 1;
                        const savedTimeStr = entry.lastSavedAt || new Date().toLocaleDateString('en-US');
                        const attInfo = getWorkerAttendanceInfo(worker.staffId);
                        const isRowAbsent =
                          attInfo.isAbsent ||
                          (entry.fnWork && entry.fnWork.trim().toLowerCase() === 'absent') ||
                          (entry.anWork && entry.anWork.trim().toLowerCase() === 'absent');

                        return (
                          <tr
                            key={`${worker.staffId || worker.id}-sheet-${idx}`}
                            className={`transition group ${
                              isRowAbsent
                                ? 'bg-rose-50/90 hover:bg-rose-100/90 border-rose-300'
                                : 'hover:bg-emerald-50/30'
                            }`}
                          >
                            <td className="py-2 px-3 border-r border-slate-200 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                              {date}
                            </td>
                            <td className="py-2 px-2 border-r border-slate-200 text-center font-mono font-bold text-slate-800 text-[11px]">
                              {sNo}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-200">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900 leading-tight">{worker.name}</span>
                                {isRowAbsent && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-rose-200 text-rose-900 border border-rose-300">
                                    ABSENT
                                  </span>
                                )}
                              </div>
                              <div className="font-mono text-[10px] text-slate-500">{worker.staffId}</div>
                            </td>
                            <td className="py-2 px-3 border-r border-slate-200 font-medium text-slate-700 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 text-[11px]">
                                {worker.category || worker.designation}
                              </span>
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-200">
                              <div className="relative">
                                <input
                                  type="text"
                                  value={entry.fnWork}
                                  onChange={(e) => handleInputChange(worker.staffId, 'fnWork', e.target.value)}
                                  placeholder="Enter FN tasks (8.00 AM - 12.30 PM)..."
                                  className={`w-full text-xs px-2.5 py-1.5 rounded-lg border focus:outline-none focus:ring-1 ${
                                    isRowAbsent || entry.fnWork.toLowerCase() === 'absent'
                                      ? 'border-rose-300 text-rose-900 font-bold bg-rose-50/50 focus:border-rose-500 focus:ring-rose-400'
                                      : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-500 bg-white'
                                  }`}
                                />
                                {entry.fnWork && (
                                  <button
                                    type="button"
                                    onClick={() => handleImprove(worker.staffId, 'fnWork')}
                                    disabled={entry.isImprovingFN}
                                    title="AI Refine description"
                                    className="absolute right-1.5 top-1.5 p-1 rounded hover:bg-slate-100 text-amber-600 disabled:opacity-50 cursor-pointer"
                                  >
                                    <Sparkles className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-200">
                              <div className="relative">
                                <input
                                  type="text"
                                  value={entry.anWork}
                                  onChange={(e) => handleInputChange(worker.staffId, 'anWork', e.target.value)}
                                  placeholder="Enter AN tasks (01.30 PM - 5.30 PM)..."
                                  className={`w-full text-xs px-2.5 py-1.5 rounded-lg border focus:outline-none focus:ring-1 ${
                                    isRowAbsent || entry.anWork.toLowerCase() === 'absent'
                                      ? 'border-rose-300 text-rose-900 font-bold bg-rose-50/50 focus:border-rose-500 focus:ring-rose-400'
                                      : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-500 bg-white'
                                  }`}
                                />
                                {entry.anWork && (
                                  <button
                                    type="button"
                                    onClick={() => handleImprove(worker.staffId, 'anWork')}
                                    disabled={entry.isImprovingAN}
                                    title="AI Refine description"
                                    className="absolute right-1.5 top-1.5 p-1 rounded hover:bg-slate-100 text-amber-600 disabled:opacity-50 cursor-pointer"
                                  >
                                    <Sparkles className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-3 border-r border-slate-200 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                              {savedTimeStr}
                            </td>
                            <td className="py-2 px-2 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleCopyFNtoAN(worker.staffId)}
                                title="Copy FN to AN"
                                disabled={!entry.fnWork}
                                className="p-1 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 disabled:opacity-20 transition cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )
      ) : (
        <>
          {/* MONTHLY CONTEXT BANNER WHEN CARDS VIEW IS ACTIVE */}
          {timeFilterMode === 'monthly' && (
            <div className="bg-gradient-to-r from-teal-900 to-slate-900 text-white rounded-2xl p-4 border border-teal-700/80 shadow-md space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-teal-300 shrink-0">
                    <CalendarRange className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-teal-500/20 text-teal-200 px-2 py-0.5 rounded-full border border-teal-400/30">
                        Monthly Date Filter
                      </span>
                      <span className="text-xs text-slate-300">Viewing Day: {date}</span>
                    </div>
                    <h4 className="text-sm font-bold text-white mt-0.5">
                      {formattedSelectedMonth} — {monthlyDatesWithData.length} Active Days Logged ({monthlyWorklogs.length} Total Logs)
                    </h4>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setViewMode('sheet')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-xs font-black shadow-xs transition cursor-pointer self-start sm:self-auto"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Open in Google Sheet Monthly Table</span>
                </button>
              </div>

              {/* Day selection chips within the month */}
              <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-0.5 text-xs">
                <span className="text-[11px] font-semibold text-teal-200 shrink-0">Select Day:</span>
                {monthlyDatesWithData.map((d) => {
                  const isCurrent = date === d.date;
                  const dateObj = new Date(d.date + 'T12:00:00');
                  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                  const formattedD = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                  return (
                    <button
                      key={d.date}
                      type="button"
                      onClick={() => {
                        setDate(d.date);
                        setWorkflowDate(d.date);
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer border ${
                        isCurrent
                          ? 'bg-emerald-400 text-emerald-950 border-emerald-300 shadow-xs'
                          : 'bg-white/10 hover:bg-white/20 text-white border-white/10'
                      }`}
                    >
                      <span>{formattedD}</span>
                      <span className="text-[10px] opacity-80 uppercase">({dayName})</span>
                      <span
                        className={`text-[9px] font-mono px-1 rounded-full ${
                          isCurrent ? 'bg-emerald-900 text-white' : 'bg-white/20 text-white'
                        }`}
                      >
                        {d.worklogs}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
          const isAbsent =
            attInfo.isAbsent ||
            (entry.fnWork && entry.fnWork.trim().toLowerCase() === 'absent') ||
            (entry.anWork && entry.anWork.trim().toLowerCase() === 'absent');

          return (
            <div
              key={`${worker.staffId || worker.id}-${idx}`}
              className={`rounded-2xl border-2 p-4 sm:p-5 transition duration-200 ${
                isAbsent
                  ? 'border-rose-300 bg-rose-50/70 shadow-xs ring-1 ring-rose-200/50'
                  : hasLoggedWork
                  ? 'border-teal-400 bg-teal-50/20 shadow-xs'
                  : 'border-slate-200/90 bg-white hover:border-teal-300 shadow-xs'
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
                        ? 'Auto-Saving...'
                        : entry.autoSaved
                        ? settings.spreadsheetId && accessToken
                          ? 'Auto-Saved to Sheet'
                          : 'Auto-Saved'
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

              {/* TWO SESSIONS INPUT ROW: FN WORK (8.00 AM - 12.30 PM) & AN WORK (01.30 PM - 5.30 PM) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                {/* 1. FN WORK BOX */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 flex-wrap gap-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm">☀️</span>
                      <span className="tracking-wide uppercase text-[11px] font-black text-slate-800">
                        FN WORK
                      </span>
                      <span className="text-[10px] font-mono font-bold text-teal-800 bg-teal-100/90 px-2 py-0.5 rounded-md border border-teal-200">
                        8.00 AM to 12.30 PM
                      </span>
                      {entry.fnWork && (
                        <span className="text-[10px] text-teal-700 font-mono font-normal">
                          ({entry.fnWork.length} chars)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() =>
                          handleInputChange(
                            worker.staffId,
                            'fnWork',
                            entry.fnWork ? `${entry.fnWork} [8.00 AM - 12.30 PM]` : '8.00 AM - 12.30 PM: '
                          )
                        }
                        className="text-[10px] text-teal-700 bg-teal-50 hover:bg-teal-100 font-semibold px-2 py-0.5 rounded-lg border border-teal-200 transition cursor-pointer"
                        title="Click to insert FN timing (8.00 AM to 12.30 PM)"
                      >
                        + 8.00 AM - 12.30 PM
                      </button>

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
                    placeholder="Enter FN tasks (8.00 AM to 12.30 PM)..."
                    className={`w-full px-3.5 py-2.5 rounded-xl border-2 text-xs sm:text-sm font-medium transition shadow-2xs ${
                      isAbsent || entry.fnWork.toLowerCase() === 'absent'
                        ? 'border-rose-300 bg-rose-50/50 text-rose-950 font-bold focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                        : 'border-teal-200/90 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 text-slate-900 bg-white placeholder:text-slate-400'
                    }`}
                  />
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span>Forenoon session (8.00 AM to 12.30 PM)</span>
                    <span className="font-mono">Press ↵ Enter for AN</span>
                  </div>
                </div>

                {/* 2. AN WORK BOX */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 flex-wrap gap-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm">🌙</span>
                      <span className="tracking-wide uppercase text-[11px] font-black text-slate-800">
                        AN WORK
                      </span>
                      <span className="text-[10px] font-mono font-bold text-teal-800 bg-teal-100/90 px-2 py-0.5 rounded-md border border-teal-200">
                        01.30 PM to 5.30 PM
                      </span>
                      {entry.anWork && (
                        <span className="text-[10px] text-teal-700 font-mono font-normal">
                          ({entry.anWork.length} chars)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() =>
                          handleInputChange(
                            worker.staffId,
                            'anWork',
                            entry.anWork ? `${entry.anWork} [01.30 PM - 5.30 PM]` : '01.30 PM - 5.30 PM: '
                          )
                        }
                        className="text-[10px] text-teal-700 bg-teal-50 hover:bg-teal-100 font-semibold px-2 py-0.5 rounded-lg border border-teal-200 transition cursor-pointer"
                        title="Click to insert AN timing (01.30 PM to 5.30 PM)"
                      >
                        + 01.30 PM - 5.30 PM
                      </button>

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
                    placeholder="Enter AN tasks (01.30 PM to 5.30 PM)..."
                    className={`w-full px-3.5 py-2.5 rounded-xl border-2 text-xs sm:text-sm font-medium transition shadow-2xs ${
                      isAbsent || entry.anWork.toLowerCase() === 'absent'
                        ? 'border-rose-300 bg-rose-50/50 text-rose-950 font-bold focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                        : 'border-teal-200/90 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 text-slate-900 bg-white placeholder:text-slate-400'
                    }`}
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
        </>
      )}

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
