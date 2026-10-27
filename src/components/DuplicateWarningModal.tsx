import React from 'react';
import { AlertTriangle, Eye, Edit3, X } from 'lucide-react';
import { AttendanceRecord } from '../types';

interface DuplicateWarningModalProps {
  isOpen: boolean;
  duplicateRecord: AttendanceRecord | null;
  onViewExisting: (record: AttendanceRecord) => void;
  onEditExisting: (record: AttendanceRecord) => void;
  onCancel: () => void;
}

export const DuplicateWarningModal: React.FC<DuplicateWarningModalProps> = ({
  isOpen,
  duplicateRecord,
  onViewExisting,
  onEditExisting,
  onCancel,
}) => {
  if (!isOpen || !duplicateRecord) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-amber-300 max-w-lg w-full p-6 animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Duplicate Attendance Detected</h3>
            <p className="text-xs text-amber-700 font-medium">Attendance already exists for this worker and date.</p>
          </div>
        </div>

        <div className="bg-amber-50/70 rounded-xl p-4 border border-amber-200 mb-5 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-600 font-medium">Record ID:</span>
            <span className="font-mono font-semibold text-slate-900">{duplicateRecord.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600 font-medium">Date:</span>
            <span className="font-semibold text-slate-900">{duplicateRecord.date}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600 font-medium">Worker Name:</span>
            <span className="font-bold text-slate-900">{duplicateRecord.workerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600 font-medium">Staff ID:</span>
            <span className="font-mono text-slate-800">{duplicateRecord.staffId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600 font-medium">FN Attendance / Location:</span>
            <span className="text-slate-800">
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium mr-1">
                {duplicateRecord.attendanceFN}
              </span>
              {duplicateRecord.workPlaceFN}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600 font-medium">AN Attendance / Location:</span>
            <span className="text-slate-800">
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium mr-1">
                {duplicateRecord.attendanceAN}
              </span>
              {duplicateRecord.workPlaceAN}
            </span>
          </div>
          <div className="flex justify-between pt-1 border-t border-amber-200">
            <span className="text-slate-600 font-medium">Recorded Wage:</span>
            <span className="font-bold text-emerald-700">₹{duplicateRecord.wage}</span>
          </div>
        </div>

        <p className="text-xs text-slate-500 mb-6">
          To prevent inaccurate labour billing and double wage payouts, duplicate records are strictly blocked.
          Please select an option below:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-medium text-xs hover:bg-slate-100 transition"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onViewExisting(duplicateRecord)}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition"
          >
            <Eye className="w-3.5 h-3.5 text-slate-600" />
            View Existing
          </button>
          <button
            type="button"
            onClick={() => onEditExisting(duplicateRecord)}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-md shadow-amber-600/20 transition"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit Existing
          </button>
        </div>
      </div>
    </div>
  );
};
