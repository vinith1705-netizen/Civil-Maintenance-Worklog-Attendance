import React, { useState, useMemo } from 'react';
import {
  UserCheck,
  Calendar,
  DollarSign,
  MapPin,
  Clock,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Briefcase,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const WorkerReportView: React.FC = () => {
  const { workers, attendance, worklogs } = useApp();

  const [selectedStaffId, setSelectedStaffId] = useState<string>(workers[0]?.staffId || '');

  const currentWorker = useMemo(
    () => workers.find((w) => w.staffId === selectedStaffId) || workers[0],
    [workers, selectedStaffId]
  );

  // Worker's attendance history
  const workerAttendance = useMemo(() => {
    if (!currentWorker) return [];
    return attendance
      .filter((a) => a.staffId === currentWorker.staffId)
      .sort((a, b) => (b.date > a.date ? 1 : -1));
  }, [attendance, currentWorker]);

  // Aggregate stats
  const totalDays = workerAttendance.length;
  const presentDays = workerAttendance.filter(
    (a) => a.attendanceFN === 'Present' || a.attendanceAN === 'Present'
  ).length;
  const absentDays = workerAttendance.filter(
    (a) => a.attendanceFN === 'Absent' && a.attendanceAN === 'Absent'
  ).length;
  const leaveDays = workerAttendance.filter(
    (a) => a.attendanceFN === 'Leave' || a.attendanceAN === 'Leave'
  ).length;
  const permissionDays = workerAttendance.filter(
    (a) => a.attendanceFN === 'Permission' || a.attendanceAN === 'Permission'
  ).length;
  const totalWagesEarned = workerAttendance.reduce((sum, a) => sum + (a.wage || 0), 0);

  // Locations visited
  const locationsWorked = useMemo(() => {
    const locSet = new Set<string>();
    workerAttendance.forEach((a) => {
      if (a.workPlaceFN) locSet.add(a.workPlaceFN);
      if (a.workPlaceAN) locSet.add(a.workPlaceAN);
    });
    return Array.from(locSet);
  }, [workerAttendance]);

  // Categories worked
  const categoriesWorked = useMemo(() => {
    const catSet = new Set<string>();
    workerAttendance.forEach((a) => {
      if (a.workCategory) catSet.add(a.workCategory);
    });
    return Array.from(catSet);
  }, [workerAttendance]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Selector & Actions */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
            Worker Analytics
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-1">Worker-Wise Attendance & Wage Ledger</h2>
          <p className="text-xs text-slate-500">
            Individual labour attendance history, earnings, site placements, and trade task records.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex-1 md:w-72">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Worker</label>
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white"
            >
              {workers.map((w) => (
                <option key={w.id} value={w.staffId}>
                  {w.name} ({w.staffId} - {w.designation})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => window.print()}
            className="self-end px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Ledger</span>
          </button>
        </div>
      </div>

      {currentWorker && (
        <>
          {/* Worker Profile Card */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-black tracking-tight">{currentWorker.name}</h3>
                  <span className="font-mono text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                    {currentWorker.staffId}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                      currentWorker.status === 'Active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {currentWorker.status}
                  </span>
                </div>
                <div className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-3">
                  <span>Trade: <strong className="text-white">{currentWorker.designation}</strong></span>
                  <span>•</span>
                  <span>Category: <strong className="text-white">{currentWorker.category}</strong></span>
                  <span>•</span>
                  <span>Daily Base Rate: <strong className="text-amber-400 font-mono">₹{currentWorker.perDayWage}</strong></span>
                  <span>•</span>
                  <span>Joining Date: <strong className="text-white font-mono">{currentWorker.joiningDate}</strong></span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase text-slate-400 font-semibold">Total Cumulative Earnings</span>
                <div className="text-2xl font-black text-amber-400 font-mono">
                  ₹{totalWagesEarned.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-5 text-center">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Logged Days</span>
                <div className="text-xl font-extrabold text-white mt-0.5">{totalDays}</div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-[10px] text-emerald-300 uppercase font-semibold">Present Days</span>
                <div className="text-xl font-extrabold text-emerald-400 mt-0.5">{presentDays}</div>
              </div>
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <span className="text-[10px] text-rose-300 uppercase font-semibold">Absent Days</span>
                <div className="text-xl font-extrabold text-rose-400 mt-0.5">{absentDays}</div>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <span className="text-[10px] text-amber-300 uppercase font-semibold">Leave Days</span>
                <div className="text-xl font-extrabold text-amber-400 mt-0.5">{leaveDays}</div>
              </div>
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <span className="text-[10px] text-purple-300 uppercase font-semibold">Permission</span>
                <div className="text-xl font-extrabold text-purple-400 mt-0.5">{permissionDays}</div>
              </div>
            </div>
          </div>

          {/* Scope Badges */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block mb-2">
                Work Locations Visited ({locationsWorked.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {locationsWorked.map((loc, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold">
                    {loc}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block mb-2">
                Trade Categories Executed ({categoriesWorked.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {categoriesWorked.map((cat, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-xs font-semibold">
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Chronological Work History Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">
                Chronological Attendance & Worklog History
              </h3>
              <span className="text-xs text-slate-500 font-mono">{workerAttendance.length} records</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="py-3 px-3.5">Date</th>
                    <th className="py-3 px-3.5">Record ID</th>
                    <th className="py-3 px-3.5">Work Place (FN / AN)</th>
                    <th className="py-3 px-3.5">Work Details</th>
                    <th className="py-3 px-3.5">FN Status</th>
                    <th className="py-3 px-3.5">AN Status</th>
                    <th className="py-3 px-3.5 text-right">Wage Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {workerAttendance.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No work records found for this worker yet.
                      </td>
                    </tr>
                  ) : (
                    workerAttendance.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3.5 font-mono font-bold text-slate-800 whitespace-nowrap">
                          {rec.date}
                        </td>
                        <td className="py-3 px-3.5 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                          {rec.id}
                        </td>
                        <td className="py-3 px-3.5 font-semibold text-slate-900">
                          {rec.workPlaceFN}
                          {rec.workPlaceAN && rec.workPlaceAN !== rec.workPlaceFN && (
                            <span className="text-slate-500 font-normal"> / {rec.workPlaceAN}</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-slate-700 max-w-md">
                          <div className="leading-snug">
                            <span>{rec.workDetailsFN}</span>
                            {rec.workDetailsAN && rec.workDetailsAN !== rec.workDetailsFN && (
                              <span className="text-slate-500 block text-[11px] mt-0.5">
                                AN: {rec.workDetailsAN}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              rec.attendanceFN === 'Present'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {rec.attendanceFN}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              rec.attendanceAN === 'Present'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {rec.attendanceAN}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                          ₹{rec.wage}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
