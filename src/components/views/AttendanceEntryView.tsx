import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  Search,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Save,
  X,
  Sparkles,
  Copy,
  DollarSign,
  MapPin,
  Clock,
  User,
  CheckCircle2,
  ArrowDown,
  ArrowUp,
  FastForward,
  FileSpreadsheet,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getTodayDateString } from '../../data/seedData';
import { AttendanceRecord, AttendanceStatus, WorkerRecord } from '../../types';
import { improveWorkDescription } from '../../services/gemini';

export type RowAttendanceStatus = AttendanceStatus | 'Unmarked';

interface LabourAttendanceRow {
  worker: WorkerRecord;
  status: RowAttendanceStatus;
  attendanceFN: AttendanceStatus | 'Unmarked';
  attendanceAN: AttendanceStatus | 'Unmarked';
  workPlaceFN: string;
  workPlaceAN: string;
  workDetailsFN: string;
  workDetailsAN: string;
  calculatedWage: number;
  wageOverride?: number | null;
  remarks?: string;
  existingRecordId?: string;
}

export const AttendanceEntryView: React.FC = () => {
  const {
    workers,
    locations,
    attendance,
    calculateWage,
    saveBatchAttendanceRecords,
    deleteAttendanceRecord,
    deleteAttendanceForWorker,
    clearAttendanceForDate,
    settings,
    accessToken,
    setActiveTab,
    workflowDate,
    setWorkflowDate,
    showToast,
    isUpdatingLabour,
    updateLabourToGoogleSheet,
    updateAttendanceToGoogleSheet,
  } = useApp();

  const [date, setDate] = useState<string>(workflowDate || getTodayDateString());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterTrade, setFilterTrade] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [autoAdvance, setAutoAdvance] = useState<boolean>(true);

  // Maintain local state for all workers
  const [labourRows, setLabourRows] = useState<LabourAttendanceRow[]>([]);

  // Attendance Editor Modal state
  const [editorOpen, setEditorOpen] = useState<boolean>(false);
  const [editingRow, setEditingRow] = useState<LabourAttendanceRow | null>(null);

  // Editor form fields
  const [edFNStatus, setEdFNStatus] = useState<AttendanceStatus>('Present');
  const [edANStatus, setEdANStatus] = useState<AttendanceStatus>('Present');
  const [edFNLocation, setEdFNLocation] = useState<string>('Ruby Hostel');
  const [edANLocation, setEdANLocation] = useState<string>('Ruby Hostel');
  const [edFNDetails, setEdFNDetails] = useState<string>('');
  const [edANDetails, setEdANDetails] = useState<string>('');
  const [edRemarks, setEdRemarks] = useState<string>('');
  const [edWageOverride, setEdWageOverride] = useState<string>('');
  const [edOverrideEnabled, setEdOverrideEnabled] = useState<boolean>(false);
  const [isImprovingFN, setIsImprovingFN] = useState<boolean>(false);
  const [isImprovingAN, setIsImprovingAN] = useState<boolean>(false);

  // Sync date with AppContext
  useEffect(() => {
    setWorkflowDate(date);

    const existingOnDate = attendance.filter((a) => a.date === date);
    const existingMap = new Map<string, AttendanceRecord>();
    existingOnDate.forEach((a) => existingMap.set(a.staffId.toLowerCase(), a));

    const rows: LabourAttendanceRow[] = workers.map((worker) => {
      const existing = existingMap.get(worker.staffId.toLowerCase());
      if (existing) {
        const isPresent = existing.attendanceFN === 'Present' || existing.attendanceAN === 'Present';
        const isAbsent = existing.attendanceFN === 'Absent' && existing.attendanceAN === 'Absent';
        const primaryStatus: RowAttendanceStatus = isPresent ? 'Present' : isAbsent ? 'Absent' : existing.attendanceFN;
        let fnDetails = existing.workDetailsFN || '';
        let anDetails = existing.workDetailsAN || '';
        const isLegacySample = (text: string) => {
          const t = text.trim();
          return (
            t === 'Parapet wall brick plastering and water sump ledge masonry repair work.' ||
            t === 'Parapet wall brick plastering and water sump ledge masonry repair work' ||
            t === 'Second floor corridor tile joints grouting and skirting fixing'
          );
        };
        if (isLegacySample(fnDetails)) fnDetails = '';
        if (isLegacySample(anDetails)) anDetails = '';

        return {
          worker,
          status: primaryStatus,
          attendanceFN: existing.attendanceFN,
          attendanceAN: existing.attendanceAN,
          workPlaceFN: existing.workPlaceFN || 'Ruby Hostel',
          workPlaceAN: existing.workPlaceAN || 'Ruby Hostel',
          workDetailsFN: fnDetails,
          workDetailsAN: anDetails,
          calculatedWage: existing.wage,
          wageOverride: existing.wageOverride,
          remarks: existing.remarks || '',
          existingRecordId: existing.id,
        };
      }

      // First / initial state: Both P and A start clean WHITE (Unmarked)
      // Work details start as empty box
      return {
        worker,
        status: 'Unmarked',
        attendanceFN: 'Unmarked',
        attendanceAN: 'Unmarked',
        workPlaceFN: 'Ruby Hostel',
        workPlaceAN: 'Ruby Hostel',
        workDetailsFN: '',
        workDetailsAN: '',
        calculatedWage: 0,
      };
    });

    setLabourRows(rows);
  }, [date, workers, attendance, calculateWage, setWorkflowDate]);

  // Filtered rows for search/trade
  const filteredRows = useMemo(() => {
    return labourRows.filter((r) => {
      const matchSearch =
        r.worker.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.worker.staffId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.worker.designation.toLowerCase().includes(searchQuery.toLowerCase());

      const matchTrade =
        filterTrade === 'All' ||
        r.worker.category?.toLowerCase() === filterTrade.toLowerCase() ||
        r.worker.designation.toLowerCase().includes(filterTrade.toLowerCase());

      const matchStatus = filterStatus === 'All' || r.status === filterStatus;

      return matchSearch && matchTrade && matchStatus;
    });
  }, [labourRows, searchQuery, filterTrade, filterStatus]);

  // Advance to next entry helper
  const advanceToNextWorker = useCallback(
    (currentStaffId: string) => {
      const currIdx = filteredRows.findIndex((r) => r.worker.staffId === currentStaffId);
      if (currIdx >= 0 && currIdx < filteredRows.length - 1) {
        const nextStaffId = filteredRows[currIdx + 1].worker.staffId;
        setSelectedStaffId(nextStaffId);
        setTimeout(() => {
          const nextEl = document.getElementById(`labour-card-${nextStaffId}`);
          if (nextEl) {
            nextEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 60);
        return nextStaffId;
      }
      return null;
    },
    [filteredRows]
  );

  // Jump to previous entry helper
  const jumpToPreviousWorker = useCallback(
    (currentStaffId: string) => {
      const currIdx = filteredRows.findIndex((r) => r.worker.staffId === currentStaffId);
      if (currIdx > 0) {
        const prevStaffId = filteredRows[currIdx - 1].worker.staffId;
        setSelectedStaffId(prevStaffId);
        setTimeout(() => {
          const prevEl = document.getElementById(`labour-card-${prevStaffId}`);
          if (prevEl) {
            prevEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 60);
        return prevStaffId;
      }
      return null;
    },
    [filteredRows]
  );

  // Set single worker status by clicking [ P ] or [ A ]
  // Clicking an active status again toggles it back to White (Unmarked)!
  const setWorkerStatus = async (staffId: string, requestedStatus: AttendanceStatus) => {
    setSelectedStaffId(staffId);

    const currentRow = labourRows.find((r) => r.worker.staffId === staffId);
    const isTogglingToWhite = currentRow?.status === requestedStatus;
    const newStatus: RowAttendanceStatus = isTogglingToWhite ? 'Unmarked' : requestedStatus;

    const updatedRows: LabourAttendanceRow[] = labourRows.map((row) => {
      if (row.worker.staffId === staffId) {
        if (isTogglingToWhite) {
          return {
            ...row,
            status: 'Unmarked',
            attendanceFN: 'Unmarked',
            attendanceAN: 'Unmarked',
            calculatedWage: 0,
            workDetailsFN: '',
            workDetailsAN: '',
          };
        }
        const fn = newStatus as AttendanceStatus;
        const an = newStatus as AttendanceStatus;
        const wage = calculateWage(row.worker.perDayWage, fn, an);
        return {
          ...row,
          status: newStatus,
          attendanceFN: fn,
          attendanceAN: an,
          calculatedWage: wage,
        };
      }
      return row;
    });

    setLabourRows(updatedRows);

    const targetRow = updatedRows.find((r) => r.worker.staffId === staffId);
    if (targetRow) {
      const cleanDate = date.replace(/-/g, '');
      const cleanStaff = targetRow.worker.staffId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const recId = targetRow.existingRecordId || `CMWL-${cleanDate}-${cleanStaff}-001`;

      if (isTogglingToWhite) {
        deleteAttendanceForWorker(date, targetRow.worker.staffId);
        showToast('info', `${targetRow.worker.name} reset to White (P & A).`);
      } else {
        const singleRecord: AttendanceRecord = {
          id: recId,
          date,
          staffId: targetRow.worker.staffId,
          eId: targetRow.worker.eId,
          workerName: targetRow.worker.name,
          designation: targetRow.worker.designation,
          workCategory: targetRow.worker.category || 'Civil Maintenance',
          workPlaceFN: targetRow.workPlaceFN,
          workDetailsFN:
            newStatus === 'Present'
              ? targetRow.workDetailsFN || ''
              : `${newStatus}`,
          attendanceFN: targetRow.attendanceFN === 'Unmarked' ? (newStatus as AttendanceStatus) : (targetRow.attendanceFN as AttendanceStatus),
          workPlaceAN: targetRow.workPlaceAN,
          workDetailsAN:
            newStatus === 'Present'
              ? targetRow.workDetailsAN || ''
              : `${newStatus}`,
          attendanceAN: targetRow.attendanceAN === 'Unmarked' ? (newStatus as AttendanceStatus) : (targetRow.attendanceAN as AttendanceStatus),
          calculatedWage: targetRow.calculatedWage,
          wage: targetRow.calculatedWage,
          status: 'Approved',
          remarks: `Quick roll-call: ${newStatus}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        try {
          await saveBatchAttendanceRecords([singleRecord], false);
        } catch (e) {
          console.warn('Auto-save attendance error:', e);
        }

        // Auto-advance to next entry!
        if (autoAdvance) {
          advanceToNextWorker(staffId);
        }
      }
    }
  };

  // Global Keyboard Fast Entry (P = Present, A = Absent, Down/Enter = Next, Up = Prev)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editorOpen) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      const activeStaffId = selectedStaffId || filteredRows[0]?.worker.staffId;
      if (!activeStaffId) return;

      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setWorkerStatus(activeStaffId, 'Present');
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        setWorkerStatus(activeStaffId, 'Absent');
      } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        advanceToNextWorker(activeStaffId);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        jumpToPreviousWorker(activeStaffId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editorOpen, selectedStaffId, filteredRows, advanceToNextWorker, jumpToPreviousWorker, setWorkerStatus]);

  // Open Attendance Editor Modal
  const handleOpenEditor = (row: LabourAttendanceRow) => {
    setEditingRow(row);
    setSelectedStaffId(row.worker.staffId);
    setEdFNStatus(row.attendanceFN === 'Unmarked' ? 'Present' : (row.attendanceFN as AttendanceStatus));
    setEdANStatus(row.attendanceAN === 'Unmarked' ? 'Present' : (row.attendanceAN as AttendanceStatus));
    setEdFNLocation(row.workPlaceFN || 'Ruby Hostel');
    setEdANLocation(row.workPlaceAN || 'Ruby Hostel');
    setEdFNDetails(row.workDetailsFN || '');
    setEdANDetails(row.workDetailsAN || '');
    setEdRemarks(row.remarks || '');
    if (row.wageOverride) {
      setEdOverrideEnabled(true);
      setEdWageOverride(String(row.wageOverride));
    } else {
      setEdOverrideEnabled(false);
      setEdWageOverride('');
    }
    setEditorOpen(true);
  };

  // Save Attendance Editor Form
  const handleSaveEditor = async (e: React.FormEvent, proceedToNext: boolean = false) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!editingRow) return;

    const isPresent = edFNStatus === 'Present' || edANStatus === 'Present';
    const primaryStatus = isPresent ? 'Present' : edFNStatus;
    const computedWage = calculateWage(editingRow.worker.perDayWage, edFNStatus, edANStatus);
    const finalWage = edOverrideEnabled && edWageOverride ? parseFloat(edWageOverride) || 0 : computedWage;

    // Update local state
    setLabourRows((prev) =>
      prev.map((r) => {
        if (r.worker.staffId === editingRow.worker.staffId) {
          return {
            ...r,
            status: primaryStatus,
            attendanceFN: edFNStatus,
            attendanceAN: edANStatus,
            workPlaceFN: edFNLocation,
            workPlaceAN: edANLocation,
            workDetailsFN: edFNDetails || '',
            workDetailsAN: edANDetails || '',
            calculatedWage: finalWage,
            wageOverride: edOverrideEnabled && edWageOverride ? parseFloat(edWageOverride) : null,
            remarks: edRemarks,
          };
        }
        return r;
      })
    );

    // Save to AppContext
    const cleanDate = date.replace(/-/g, '');
    const cleanStaff = editingRow.worker.staffId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const recId = editingRow.existingRecordId || `CMWL-${cleanDate}-${cleanStaff}-001`;

    const updatedRecord: AttendanceRecord = {
      id: recId,
      date,
      staffId: editingRow.worker.staffId,
      eId: editingRow.worker.eId,
      workerName: editingRow.worker.name,
      designation: editingRow.worker.designation,
      workCategory: editingRow.worker.category || 'Civil Maintenance',
      workPlaceFN: edFNLocation,
      workDetailsFN: edFNDetails || '',
      attendanceFN: edFNStatus,
      workPlaceAN: edANLocation,
      workDetailsAN: edANDetails || '',
      attendanceAN: edANStatus,
      calculatedWage: computedWage,
      wageOverride: edOverrideEnabled && edWageOverride ? parseFloat(edWageOverride) : null,
      wage: finalWage,
      status: 'Approved',
      remarks: edRemarks || `Edited via Attendance Editor`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveBatchAttendanceRecords([updatedRecord], false);
    showToast('success', `Saved attendance for ${editingRow.worker.name}`);

    // If "Save & Next Entry" was clicked, open next worker in editor!
    if (proceedToNext) {
      const currIdx = filteredRows.findIndex((r) => r.worker.staffId === editingRow.worker.staffId);
      if (currIdx >= 0 && currIdx < filteredRows.length - 1) {
        const nextRow = filteredRows[currIdx + 1];
        handleOpenEditor(nextRow);
        return;
      } else {
        setEditorOpen(false);
        showToast('info', 'Reached the last worker on the roster.');
      }
    } else {
      setEditorOpen(false);
    }
  };

  // AI Polish in Editor
  const handleImproveEditorText = async (sessionType: 'FN' | 'AN') => {
    if (!editingRow) return;
    const text = sessionType === 'FN' ? edFNDetails : edANDetails;
    if (!text.trim()) return;

    if (sessionType === 'FN') setIsImprovingFN(true);
    else setIsImprovingAN(true);

    try {
      const improved = await improveWorkDescription(text, {
        workerName: editingRow.worker.name,
        designation: editingRow.worker.designation,
        location: sessionType === 'FN' ? edFNLocation : edANLocation,
      });

      if (sessionType === 'FN') setEdFNDetails(improved);
      else setEdANDetails(improved);
      showToast('success', `Refined ${sessionType} work details with civil terminology.`);
    } catch {
      showToast('error', 'Could not refine text.');
    } finally {
      if (sessionType === 'FN') setIsImprovingFN(false);
      else setIsImprovingAN(false);
    }
  };

  // Bulk actions: Mark All P or Mark All A
  const handleBulkMark = async (statusToSet: AttendanceStatus) => {
    const updated = labourRows.map((row) => {
      if (row.worker.status !== 'Active') return row;
      const wage = calculateWage(row.worker.perDayWage, statusToSet, statusToSet);
      return {
        ...row,
        status: statusToSet,
        attendanceFN: statusToSet,
        attendanceAN: statusToSet,
        calculatedWage: wage,
      };
    });

    setLabourRows(updated);

    const records: AttendanceRecord[] = updated.map((r, idx) => {
      const cleanDate = date.replace(/-/g, '');
      const cleanStaff = r.worker.staffId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      return {
        id: r.existingRecordId || `CMWL-${cleanDate}-${cleanStaff}-${String(idx + 1).padStart(3, '0')}`,
        date,
        staffId: r.worker.staffId,
        eId: r.worker.eId,
        workerName: r.worker.name,
        designation: r.worker.designation,
        workCategory: r.worker.category || 'Civil Maintenance',
        workPlaceFN: r.workPlaceFN,
        workDetailsFN: statusToSet === 'Present' ? (r.workDetailsFN || '') : `${statusToSet}`,
        attendanceFN: r.attendanceFN as AttendanceStatus,
        workPlaceAN: r.workPlaceAN,
        workDetailsAN: statusToSet === 'Present' ? (r.workDetailsAN || '') : `${statusToSet}`,
        attendanceAN: r.attendanceAN as AttendanceStatus,
        calculatedWage: r.calculatedWage,
        wage: r.calculatedWage,
        status: 'Approved',
        remarks: `Bulk mark ${statusToSet}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    await saveBatchAttendanceRecords(records, false);
    showToast('info', `Marked all labours as ${statusToSet}.`);
  };

  // Reset all labours to initial white P and A buttons (Unmarked)
  const handleResetAllToWhite = async () => {
    // 1. Clear saved records for this date from AppContext (and localStorage)
    clearAttendanceForDate(date);

    // 2. Set all labour rows locally to clean white Unmarked buttons
    const updated: LabourAttendanceRow[] = workers.map((worker) => ({
      worker,
      status: 'Unmarked',
      attendanceFN: 'Unmarked',
      attendanceAN: 'Unmarked',
      workPlaceFN: 'Ruby Hostel',
      workPlaceAN: 'Ruby Hostel',
      workDetailsFN: '',
      workDetailsAN: '',
      calculatedWage: 0,
      existingRecordId: undefined,
    }));

    setLabourRows(updated);
    setSelectedStaffId('');
    showToast('success', 'Reset all labour cards to initial White [ P ] & [ A ] buttons (Unselected).');
  };

  // Navigate to Step 2 (Worklog Entry)
  const handleProceedToWorklog = async () => {
    // Crucial: Only workers explicitly marked Present are saved as Present.
    // Unmarked labours remain NOT selected and are recorded as Absent, so they do NOT get auto-selected as Present!
    const recordsToSave: AttendanceRecord[] = labourRows.map((r, idx) => {
      const cleanDate = date.replace(/-/g, '');
      const cleanStaff = r.worker.staffId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const isExplicitPresent = r.status === 'Present';
      const fnStatus: AttendanceStatus = isExplicitPresent
        ? (r.attendanceFN === 'Unmarked' ? 'Present' : r.attendanceFN)
        : (r.attendanceFN === 'Present' ? 'Present' : 'Absent');
      const anStatus: AttendanceStatus = isExplicitPresent
        ? (r.attendanceAN === 'Unmarked' ? 'Present' : r.attendanceAN)
        : (r.attendanceAN === 'Present' ? 'Present' : 'Absent');
      const finalStatus: AttendanceStatus = (fnStatus === 'Present' || anStatus === 'Present') ? 'Present' : 'Absent';
      const wage = finalStatus === 'Present'
        ? (r.calculatedWage > 0 ? r.calculatedWage : calculateWage(r.worker.perDayWage, fnStatus, anStatus))
        : 0;

      return {
        id: `CMWL-${cleanDate}-${cleanStaff}-${String(idx + 1).padStart(3, '0')}`,
        date,
        staffId: r.worker.staffId,
        eId: r.worker.eId,
        workerName: r.worker.name,
        designation: r.worker.designation,
        workCategory: r.worker.category || 'Civil Maintenance',
        workPlaceFN: r.workPlaceFN,
        workDetailsFN: finalStatus === 'Present' ? (r.workDetailsFN || '') : 'Absent',
        attendanceFN: fnStatus,
        workPlaceAN: r.workPlaceAN,
        workDetailsAN: finalStatus === 'Present' ? (r.workDetailsAN || '') : 'Absent',
        attendanceAN: anStatus,
        calculatedWage: wage,
        wage: wage,
        status: 'Approved',
        remarks: r.remarks || `Daily roll-call: ${finalStatus}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    await saveBatchAttendanceRecords(recordsToSave, true);
    setWorkflowDate(date);
    showToast('success', 'Attendance recorded. Proceeding to Step 2: Log Work Entry.');
    setActiveTab('worklog_entry');
  };

  // Metrics
  const unmarkedCount = labourRows.filter((r) => r.status === 'Unmarked').length;
  const presentCount = labourRows.filter((r) => r.status === 'Present').length;
  const absentCount = labourRows.filter((r) => r.status === 'Absent').length;
  const totalDayWages = labourRows.reduce((sum, r) => sum + r.calculatedWage, 0);

  // Current selected index
  const currentSelectedIndex = filteredRows.findIndex((r) => r.worker.staffId === selectedStaffId);

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* 2-STEP PROGRESS BREADCRUMB */}
      <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#1b7a54] text-white shadow-md shadow-emerald-900/20 font-bold text-xs">
              <span className="w-5 h-5 rounded-full bg-white text-[#1b7a54] flex items-center justify-center text-[11px] font-black">
                1
              </span>
              <span>STEP 1: ATTENDANCE & ATTENDANCE EDITOR</span>
            </div>

            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />

            <button
              onClick={handleProceedToWorklog}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer"
            >
              <span className="w-5 h-5 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center text-[11px] font-bold">
                2
              </span>
              <span>STEP 2: LOG WORK ENTRY</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Roll Call Date:</span>
            <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900">
              <Calendar className="w-3.5 h-3.5 text-[#1b7a54]" />
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

      {/* QUICK SUMMARY & BULK ACTIONS BAR (OPTIONAL - NOT DEFAULT SELECTION) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                Bulk Roll (Optional):
              </span>
              <button
                type="button"
                onClick={() => handleBulkMark('Present')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1b7a54] hover:bg-[#16654a] text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                title="Optional action: Click only if you want to mark all active labours Present. Labours are NOT pre-selected by default."
              >
                <span>Mark All P (Optional)</span>
              </button>
              <button
                type="button"
                onClick={() => handleBulkMark('Absent')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                <span>Mark All A (Absent)</span>
              </button>
              <button
                type="button"
                onClick={handleResetAllToWhite}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border-2 border-slate-300 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                title="Reset all labour entries to initial White P and White A buttons (Unselected)"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Reset to White (P & A)</span>
              </button>
            </div>
            <span className="text-[10px] text-slate-500 font-medium mt-1">
              * Mark All P is optional (not selected by default) — click individual [P] / [A] buttons to roll-call labours.
            </span>
          </div>

          {settings.spreadsheetId && (
            <div className="flex items-center gap-2 mt-1 sm:mt-0">
              <button
                type="button"
                onClick={() => updateLabourToGoogleSheet()}
                disabled={isUpdatingLabour}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
                title="Publish all labour records to Google Sheet 'Workers' tab (S.No | Worker Name | Category | Status)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>{isUpdatingLabour ? 'Updating Labours...' : 'Update Labours to Sheet'}</span>
              </button>

              <button
                type="button"
                onClick={() => updateAttendanceToGoogleSheet(date)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1b7a54] hover:bg-[#16654a] text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                title="Publish today's attendance to Google Sheet 'Attendance' tab (Date | S.No | Worker Name | Category | Attendance | Locked | Saved Time)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
                <span>Update Attendance to Sheet</span>
              </button>
            </div>
          )}
        </div>

        {/* Live Counters with Unselected Count */}
        <div className="flex items-center gap-3 sm:gap-4 text-xs font-semibold flex-wrap">
          <div className="text-slate-600">
            Total: <strong className="text-slate-900 font-bold">{workers.length}</strong>
          </div>
          <div className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
            Unselected: <strong className="font-bold text-slate-800">{unmarkedCount}</strong>
          </div>
          <div className="text-[#1b7a54]">
            Present: <strong className="font-bold">{presentCount}</strong>
          </div>
          <div className="text-[#dc2626]">
            Absent: <strong className="font-bold">{absentCount}</strong>
          </div>
          <div className="text-slate-900 font-mono">
            Wages: <strong className="font-bold">₹{totalDayWages.toLocaleString('en-IN')}</strong>
          </div>
        </div>
      </div>

      {/* SEARCH, FILTERS & NEXT ENTRY JUMPER */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[220px]">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search labour name, designation, or staff ID..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <select
            value={filterTrade}
            onChange={(e) => setFilterTrade(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white font-medium cursor-pointer"
          >
            <option value="All">All Categories ({workers.length})</option>
            <option value="Mason Work">Mason Work</option>
            <option value="Carpentry Work">Carpentry Work</option>
            <option value="Welding Work">Welding Work</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white font-medium cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="Present">Present Only</option>
            <option value="Absent">Absent Only</option>
            <option value="Unmarked">Unmarked Only</option>
          </select>
        </div>

        {/* Rapid Navigation Controls */}
        <div className="flex items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5 text-slate-600 font-medium cursor-pointer bg-white px-2.5 py-1.5 rounded-xl border border-slate-200">
            <input
              type="checkbox"
              checked={autoAdvance}
              onChange={(e) => setAutoAdvance(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-[11px]">Auto-Next Entry</span>
          </label>

          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => jumpToPreviousWorker(selectedStaffId)}
              disabled={currentSelectedIndex <= 0}
              className="px-2 py-1 text-slate-600 hover:text-slate-900 disabled:opacity-30 rounded-lg hover:bg-slate-100 transition"
              title="Previous Labour"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => advanceToNextWorker(selectedStaffId)}
              disabled={currentSelectedIndex >= filteredRows.length - 1}
              className="px-2.5 py-1 text-[#1b7a54] font-bold hover:bg-emerald-50 rounded-lg transition flex items-center gap-1"
              title="Next Labour"
            >
              <span>Next Entry</span>
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* FAST ENTRY HELPER BANNER */}
      <div className="bg-emerald-50/90 border border-emerald-200/90 rounded-2xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="bg-[#1b7a54] text-white font-black px-2.5 py-1 rounded-xl text-[10px] tracking-wide uppercase shadow-xs">
            ⚡ Fast Entry
          </span>
          <span className="font-semibold text-emerald-950">
            Click <strong className="text-[#1b7a54] font-black">[ P ]</strong> or <strong className="text-[#dc2626] font-black">[ A ]</strong> on each card or at the bottom bar. Auto-saves & auto-advances to next worker!
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-700 text-[11px] font-mono bg-white px-3 py-1 rounded-xl border border-emerald-200 shadow-2xs">
          <span className="font-sans font-medium text-slate-500">Keyboard:</span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 font-bold text-emerald-800">P</kbd>
          <span className="text-slate-600">Present</span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 font-bold text-rose-800">A</kbd>
          <span className="text-slate-600">Absent</span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 font-bold text-slate-800">↓ / Enter</kbd>
          <span className="text-slate-600">Next</span>
        </div>
      </div>

      {/* ATTENDANCE CARDS WITH PENCIL EDITOR MATCHING USER'S EXACT FORMAT */}
      <div className="space-y-3">
        {filteredRows.map((row, idx) => {
          const isSelected = selectedStaffId === row.worker.staffId;
          const isPresent = row.status === 'Present';
          const isAbsent = row.status === 'Absent';

          return (
            <div
              key={`${row.worker.staffId || row.worker.id}-${idx}`}
              id={`labour-card-${row.worker.staffId}`}
              onClick={() => setSelectedStaffId(row.worker.staffId)}
              className={`bg-white rounded-2xl p-3 sm:p-3.5 px-4 sm:px-5 shadow-xs transition duration-150 flex items-center justify-between gap-4 ${
                isSelected
                  ? 'border-2 border-[#16654a] shadow-sm ring-2 ring-emerald-500/10'
                  : 'border border-slate-200/90 hover:border-emerald-300'
              }`}
            >
              {/* LEFT: Circular Pencil Editor Button + Number. Name + Designation + Current: Status */}
              <div className="flex items-center gap-3.5 min-w-0">
                {/* CIRCULAR PENCIL BUTTON (Opens Attendance Editor) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenEditor(row);
                  }}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#e8f7f2] hover:bg-[#d4f0e6] flex items-center justify-center shrink-0 border border-[#bfe8da] transition shadow-xs group cursor-pointer"
                  title="Open Attendance Editor for this worker"
                >
                  <svg className="w-5 h-5 group-hover:scale-110 transition" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M16.5 3.5C17.3 2.7 18.7 2.7 19.5 3.5L20.5 4.5C21.3 5.3 21.3 6.7 20.5 7.5L8.5 19.5L3 21L4.5 15.5L16.5 3.5Z"
                      stroke="#0f172a"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="#FBBF24"
                    />
                    <path d="M15 5L19 9" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M3 21L4.5 15.5L8.5 19.5L3 21Z" fill="#1E293B" />
                    <path d="M3 21L5 20" stroke="#CBD5E1" strokeWidth="1.5" />
                  </svg>
                </button>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-[#0d2a23] text-sm sm:text-base tracking-tight truncate leading-tight">
                      {idx + 1}. {row.worker.name}
                    </h3>
                    {isSelected && (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-mono">
                        Active Entry
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 font-medium mt-0.5">
                    {row.worker.designation}
                  </div>
                  <div className="text-xs text-slate-600 font-medium mt-0.5">
                    Current:{' '}
                    <span
                      className={`font-bold ${
                        isPresent
                          ? 'text-[#1b7a54]'
                          : isAbsent
                          ? 'text-[#dc2626]'
                          : 'text-slate-400'
                      }`}
                    >
                      {isPresent ? 'Present' : isAbsent ? 'Absent' : 'Unmarked'}
                    </span>
                  </div>
                </div>
              </div>

              {/* RIGHT: [ P ] and [ A ] ACTION BUTTONS */}
              {/* Requirement: First white P and A, click to Green and Red */}
              <div className="flex items-center gap-2.5 shrink-0">
                {/* [ P ] BUTTON (First White -> Click turns Green & Auto-advances to Next Entry) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setWorkerStatus(row.worker.staffId, 'Present');
                  }}
                  className={`w-12 h-11 sm:w-14 sm:h-12 rounded-xl flex items-center justify-center font-black text-lg transition duration-150 cursor-pointer ${
                    isPresent
                      ? 'bg-[#1b7a54] text-white border-2 border-[#1b7a54] ring-2 ring-emerald-500/25 shadow-md'
                      : 'bg-white border-2 border-slate-300 text-slate-800 hover:border-slate-400 hover:bg-slate-50 shadow-2xs'
                  }`}
                  title="Mark Present (Turns Green & Auto-advances to Next Entry)"
                >
                  P
                </button>

                {/* [ A ] BUTTON (First White -> Click turns Red & Auto-advances to Next Entry) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setWorkerStatus(row.worker.staffId, 'Absent');
                  }}
                  className={`w-12 h-11 sm:w-14 sm:h-12 rounded-xl flex items-center justify-center font-black text-lg transition duration-150 cursor-pointer ${
                    isAbsent
                      ? 'bg-[#dc2626] text-white border-2 border-[#dc2626] ring-2 ring-rose-500/25 shadow-md'
                      : 'bg-white border-2 border-slate-300 text-slate-800 hover:border-slate-400 hover:bg-slate-50 shadow-2xs'
                  }`}
                  title="Mark Absent (Turns Red & Auto-advances to Next Entry)"
                >
                  A
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* STICKY BOTTOM ACTION BAR WITH P & A QUICK CONTROLS (First White, Click to Green & Red) */}
      {(() => {
        const activeWorker = selectedStaffId
          ? filteredRows.find((r) => r.worker.staffId === selectedStaffId)
          : null;
        const activeIsPresent = activeWorker?.status === 'Present';
        const activeIsAbsent = activeWorker?.status === 'Absent';
        const activeWorkerIndex = activeWorker
          ? filteredRows.findIndex((r) => r.worker.staffId === activeWorker.worker.staffId)
          : -1;

        return (
          <div className="sticky bottom-4 z-40 bg-[#0d2a23] text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl flex flex-col md:flex-row items-center justify-between gap-3 border border-emerald-950 backdrop-blur-md">
            {/* Left: Active Selected Labour Info */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-900/90 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-700/60 font-mono">
                    {activeWorker ? `Active #${activeWorkerIndex + 1}` : 'Roll-Call Ready'}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-white truncate">
                    {activeWorker ? activeWorker.worker.name : 'Select or click [P] / [A] on any labour card'}
                  </span>
                </div>
                <div className="text-[11px] text-emerald-300 font-medium truncate mt-0.5">
                  {activeWorker ? (
                    <>
                      {activeWorker.worker.designation} • Rate: ₹{activeWorker.worker.perDayWage}/day
                      <span className="ml-2 font-semibold">
                        Current:{' '}
                        <span
                          className={
                            activeIsPresent
                              ? 'text-emerald-400 font-black'
                              : activeIsAbsent
                              ? 'text-rose-400 font-black'
                              : 'text-white/80 font-medium'
                          }
                        >
                          {activeIsPresent ? 'Present' : activeIsAbsent ? 'Absent' : 'Unselected (White)'}
                        </span>
                      </span>
                    </>
                  ) : (
                    'Not selected by default • Click [P] for Present (Green) or [A] for Absent (Red)'
                  )}
                </div>
              </div>
            </div>

            {/* Center: Bottom P and A Buttons for Active Labour + Next Entry */}
            {activeWorker && (
              <div className="flex items-center gap-2 w-full md:w-auto justify-center bg-emerald-950/80 px-3 py-1.5 rounded-xl border border-emerald-800/60 shadow-inner">
                <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider mr-0.5">
                  Mark:
                </span>

                {/* Bottom [ P ] Button: First White, Click turns Green */}
                <button
                  type="button"
                  onClick={() => setWorkerStatus(activeWorker.worker.staffId, 'Present')}
                  className={`w-12 h-11 sm:w-13 sm:h-11 rounded-xl flex items-center justify-center font-black text-lg transition duration-150 cursor-pointer shadow-md ${
                    activeIsPresent
                      ? 'bg-[#1b7a54] text-white border-2 border-emerald-400 ring-2 ring-emerald-300/40'
                      : 'bg-white text-slate-800 border-2 border-slate-300 hover:bg-slate-100 hover:border-slate-400'
                  }`}
                  title="Mark Present (Turns Green & Advances to Next Entry)"
                >
                  P
                </button>

                {/* Bottom [ A ] Button: First White, Click turns Red */}
                <button
                  type="button"
                  onClick={() => setWorkerStatus(activeWorker.worker.staffId, 'Absent')}
                  className={`w-12 h-11 sm:w-13 sm:h-11 rounded-xl flex items-center justify-center font-black text-lg transition duration-150 cursor-pointer shadow-md ${
                    activeIsAbsent
                      ? 'bg-[#dc2626] text-white border-2 border-rose-400 ring-2 ring-rose-300/40'
                      : 'bg-white text-slate-800 border-2 border-slate-300 hover:bg-slate-100 hover:border-slate-400'
                  }`}
                  title="Mark Absent (Turns Red & Advances to Next Entry)"
                >
                  A
                </button>

                {/* Bottom Next Entry Button */}
                <button
                  type="button"
                  onClick={() => advanceToNextWorker(activeWorker.worker.staffId)}
                  disabled={currentSelectedIndex >= filteredRows.length - 1}
                  className="px-3 py-2 bg-emerald-800 hover:bg-emerald-700 disabled:opacity-30 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition ml-1 cursor-pointer"
                  title="Advance to Next Entry"
                >
                  <span>Next Entry</span>
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Right: Live Counters & Proceed to Worklog */}
            <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto">
              <div className="text-right hidden xl:block">
                <div className="text-xs font-semibold text-white">
                  <span className="text-emerald-400 font-bold">{presentCount}</span> Present •{' '}
                  <span className="text-rose-400 font-bold">{absentCount}</span> Absent
                </div>
                <div className="text-[11px] text-emerald-300 font-mono">
                  ₹{totalDayWages.toLocaleString('en-IN')} wages
                </div>
              </div>

              <button
                type="button"
                onClick={handleProceedToWorklog}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black shadow-lg shadow-emerald-950/40 transition flex items-center gap-2 cursor-pointer shrink-0 ml-auto md:ml-0"
              >
                <span>Next: Step 2 — Log Work Entry</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })()}

      {/* ATTENDANCE EDITOR MODAL WITH NEXT ENTRY BUTTON */}
      {editorOpen && editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-5 sm:p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Modal Header with Previous & Next Entry Buttons */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#e8f7f2] flex items-center justify-center border border-[#bfe8da] shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M16.5 3.5C17.3 2.7 18.7 2.7 19.5 3.5L20.5 4.5C21.3 5.3 21.3 6.7 20.5 7.5L8.5 19.5L3 21L4.5 15.5L16.5 3.5Z"
                      stroke="#0f172a"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="#FBBF24"
                    />
                    <path d="M15 5L19 9" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M3 21L4.5 15.5L8.5 19.5L3 21Z" fill="#1E293B" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    Attendance Editor — {editingRow.worker.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Staff ID: <span className="font-mono font-bold text-slate-700">{editingRow.worker.staffId}</span> •{' '}
                    Trade: <span className="text-[#16654a] font-semibold">{editingRow.worker.designation}</span> • Rate:{' '}
                    <span className="font-mono text-slate-700">₹{editingRow.worker.perDayWage}/day</span>
                  </p>
                </div>
              </div>

              {/* Header Navigation */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 border border-slate-200 rounded-xl p-0.5 bg-slate-50 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      const currIdx = filteredRows.findIndex((r) => r.worker.staffId === editingRow.worker.staffId);
                      if (currIdx > 0) handleOpenEditor(filteredRows[currIdx - 1]);
                    }}
                    disabled={filteredRows.findIndex((r) => r.worker.staffId === editingRow.worker.staffId) <= 0}
                    className="p-1 text-slate-600 hover:text-slate-900 disabled:opacity-30 rounded hover:bg-slate-200"
                    title="Previous Worker"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[10px] text-slate-500 font-mono px-1">
                    {filteredRows.findIndex((r) => r.worker.staffId === editingRow.worker.staffId) + 1}/
                    {filteredRows.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const currIdx = filteredRows.findIndex((r) => r.worker.staffId === editingRow.worker.staffId);
                      if (currIdx < filteredRows.length - 1) handleOpenEditor(filteredRows[currIdx + 1]);
                    }}
                    disabled={
                      filteredRows.findIndex((r) => r.worker.staffId === editingRow.worker.staffId) >=
                      filteredRows.length - 1
                    }
                    className="p-1 text-slate-600 hover:text-slate-900 disabled:opacity-30 rounded hover:bg-slate-200"
                    title="Next Worker"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={(e) => handleSaveEditor(e, false)} className="space-y-4 text-xs">
              {/* Forenoon (FN) & Afternoon (AN) Split */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* FN Box */}
                <div className="p-3.5 rounded-xl border border-teal-200/90 bg-[#f9fdfb] space-y-3">
                  <div className="flex items-center justify-between border-b border-teal-100 pb-2">
                    <span className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                      <span>☀️</span> FORENOON (FN) SESSION
                    </span>
                    <select
                      value={edFNStatus}
                      onChange={(e) => setEdFNStatus(e.target.value as AttendanceStatus)}
                      className={`text-xs font-bold px-2 py-1 rounded-lg border ${
                        edFNStatus === 'Present'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : edFNStatus === 'Absent'
                          ? 'bg-rose-50 text-rose-800 border-rose-300'
                          : 'bg-amber-50 text-amber-800 border-amber-300'
                      }`}
                    >
                      <option value="Present">Present</option>
                      <option value="Absent">Absent</option>
                      <option value="Leave">Leave</option>
                      <option value="Permission">Permission</option>
                      <option value="Holiday">Holiday</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Work Location – FN</label>
                    <select
                      value={edFNLocation}
                      onChange={(e) => setEdFNLocation(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                    >
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.name}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-700">Work Details – FN</label>
                      <button
                        type="button"
                        onClick={() => handleImproveEditorText('FN')}
                        disabled={isImprovingFN || !edFNDetails.trim()}
                        className="text-[10px] text-amber-700 font-bold hover:underline flex items-center gap-0.5 disabled:opacity-40"
                      >
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        <span>{isImprovingFN ? 'Improving...' : 'AI Polish'}</span>
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={edFNDetails}
                      onChange={(e) => setEdFNDetails(e.target.value)}
                      placeholder=""
                      className="w-full p-2 border border-slate-300 rounded-lg resize-none"
                    />
                  </div>
                </div>

                {/* AN Box */}
                <div className="p-3.5 rounded-xl border border-teal-200/90 bg-[#f9fdfb] space-y-3">
                  <div className="flex items-center justify-between border-b border-teal-100 pb-2">
                    <span className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                      <span>🌙</span> AFTERNOON (AN) SESSION
                    </span>
                    <select
                      value={edANStatus}
                      onChange={(e) => setEdANStatus(e.target.value as AttendanceStatus)}
                      className={`text-xs font-bold px-2 py-1 rounded-lg border ${
                        edANStatus === 'Present'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : edANStatus === 'Absent'
                          ? 'bg-rose-50 text-rose-800 border-rose-300'
                          : 'bg-amber-50 text-amber-800 border-amber-300'
                      }`}
                    >
                      <option value="Present">Present</option>
                      <option value="Absent">Absent</option>
                      <option value="Leave">Leave</option>
                      <option value="Permission">Permission</option>
                      <option value="Holiday">Holiday</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-700">Work Location – AN</label>
                      <button
                        type="button"
                        onClick={() => {
                          setEdANLocation(edFNLocation);
                          setEdANDetails(edFNDetails);
                          setEdANStatus(edFNStatus);
                          showToast('info', 'Copied FN to AN');
                        }}
                        className="text-[10px] text-teal-700 font-bold hover:underline flex items-center gap-0.5"
                      >
                        <Copy className="w-2.5 h-2.5" />
                        <span>Copy from FN</span>
                      </button>
                    </div>
                    <select
                      value={edANLocation}
                      onChange={(e) => setEdANLocation(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                    >
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.name}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-700">Work Details – AN</label>
                      <button
                        type="button"
                        onClick={() => handleImproveEditorText('AN')}
                        disabled={isImprovingAN || !edANDetails.trim()}
                        className="text-[10px] text-amber-700 font-bold hover:underline flex items-center gap-0.5 disabled:opacity-40"
                      >
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        <span>{isImprovingAN ? 'Improving...' : 'AI Polish'}</span>
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={edANDetails}
                      onChange={(e) => setEdANDetails(e.target.value)}
                      placeholder=""
                      className="w-full p-2 border border-slate-300 rounded-lg resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Wage Calculation & Override */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Calculated Wage</span>
                  <div className="text-base font-black text-slate-900 font-mono">
                    ₹{calculateWage(editingRow.worker.perDayWage, edFNStatus, edANStatus)}
                    <span className="text-[11px] font-normal text-slate-500 ml-1.5">
                      (Base: ₹{editingRow.worker.perDayWage}/day)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edWageOverrideCheck"
                    checked={edOverrideEnabled}
                    onChange={(e) => setEdOverrideEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                  />
                  <label htmlFor="edWageOverrideCheck" className="font-semibold text-slate-700">
                    Authorized Wage Override:
                  </label>
                  {edOverrideEnabled && (
                    <div className="relative w-24">
                      <span className="absolute left-2 top-1.5 text-slate-400">₹</span>
                      <input
                        type="number"
                        value={edWageOverride}
                        onChange={(e) => setEdWageOverride(e.target.value)}
                        placeholder="850"
                        className="w-full pl-5 pr-2 py-1 border border-slate-300 rounded-lg font-mono font-bold"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Supervisor Remarks</label>
                <input
                  type="text"
                  value={edRemarks}
                  onChange={(e) => setEdRemarks(e.target.value)}
                  placeholder="e.g. Approved half-day permission / Special site duty"
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>

              {/* Modal Action Buttons: Update and Update & Next Entry */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-semibold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold border border-slate-300 transition flex items-center gap-1.5"
                  >
                    <Save className="w-4 h-4 text-slate-600" />
                    <span>Update Only</span>
                  </button>

                  {/* PROMINENT ATTENDANCE NEXT ENTRY BUTTON */}
                  <button
                    type="button"
                    onClick={(e) => handleSaveEditor(e, true)}
                    className="px-5 py-2 bg-[#1b7a54] hover:bg-[#16654a] text-white rounded-xl font-black shadow-md shadow-emerald-900/20 transition flex items-center gap-2"
                  >
                    <span>Save & Next Entry</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
