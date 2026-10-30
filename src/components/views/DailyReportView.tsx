import React, { useState, useMemo } from 'react';
import {
  Printer,
  Calendar,
  FileText,
  Building2,
  CheckCircle2,
  Hammer,
  Wrench,
  Paintbrush,
  Flame,
  Layers,
  Briefcase,
  Download,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getTodayDateString } from '../../data/seedData';

export const DailyReportView: React.FC = () => {
  const { attendance, settings, workers } = useApp();
  const [reportDate, setReportDate] = useState<string>(getTodayDateString());

  // Filter records for selected date
  const dayRecords = useMemo(
    () => attendance.filter((a) => a.date === reportDate),
    [attendance, reportDate]
  );

  // 1. Attendance Summary Metrics
  const totalLabour = dayRecords.length;
  const presentFullDay = dayRecords.filter((a) => a.attendanceFN === 'Present' && a.attendanceAN === 'Present').length;
  const presentHalfDay = dayRecords.filter(
    (a) =>
      (a.attendanceFN === 'Present' && a.attendanceAN !== 'Present') ||
      (a.attendanceFN !== 'Present' && a.attendanceAN === 'Present')
  ).length;
  const absentCount = dayRecords.filter((a) => a.attendanceFN === 'Absent' && a.attendanceAN === 'Absent').length;
  const leaveCount = dayRecords.filter((a) => a.attendanceFN === 'Leave' || a.attendanceAN === 'Leave').length;
  const permissionCount = dayRecords.filter(
    (a) => a.attendanceFN === 'Permission' || a.attendanceAN === 'Permission'
  ).length;
  const totalWages = dayRecords.reduce((sum, r) => sum + (r.wage || 0), 0);

  // 3. Location-wise Work Summary
  const locationBreakdown = useMemo(() => {
    const map: Record<string, { workers: Set<string>; tasks: string[]; wage: number }> = {};
    dayRecords.forEach((r) => {
      const loc = r.workPlaceFN || r.workPlaceAN || 'Campus';
      if (!map[loc]) {
        map[loc] = { workers: new Set(), tasks: [], wage: 0 };
      }
      map[loc].workers.add(r.workerName);
      if (r.workDetailsFN) map[loc].tasks.push(`${r.workerName}: ${r.workDetailsFN}`);
      map[loc].wage += r.wage || 0;
    });
    return Object.entries(map).map(([loc, data]) => ({
      location: loc,
      workerCount: data.workers.size,
      tasks: data.tasks,
      wage: data.wage,
    }));
  }, [dayRecords]);

  // 4. Category-wise Work Summary
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { count: number; wage: number }> = {};
    dayRecords.forEach((r) => {
      const cat = r.workCategory || 'Other';
      if (!map[cat]) map[cat] = { count: 0, wage: 0 };
      map[cat].count += 1;
      map[cat].wage += r.wage || 0;
    });
    return Object.entries(map);
  }, [dayRecords]);

  // Trade categorization strictly aligned to the 3 permitted trade categories
  const masonRecords = dayRecords.filter((r) => {
    const cat = (r.workCategory || '').toLowerCase();
    const des = (r.designation || '').toLowerCase();
    if (cat.includes('carpent') || des.includes('carpent') || des.includes('polish')) return false;
    if (cat.includes('weld') || des.includes('weld')) return false;
    return true; // Masons, Tiles Masons, Helpers, and general civil masonry
  });

  const carpenterRecords = dayRecords.filter((r) => {
    const cat = (r.workCategory || '').toLowerCase();
    const des = (r.designation || '').toLowerCase();
    return cat.includes('carpent') || des.includes('carpent') || des.includes('polish');
  });

  const weldingRecords = dayRecords.filter((r) => {
    const cat = (r.workCategory || '').toLowerCase();
    const des = (r.designation || '').toLowerCase();
    return cat.includes('weld') || des.includes('weld');
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* Top Controller (Hidden in Print) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 no-print">
        <div>
          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
            Formal Daily Dispatch
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-1">Daily Worklog & Attendance Report</h2>
          <p className="text-xs text-slate-500">
            Generate the official 10-section civil maintenance report for college management and engineering review.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl text-xs">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="bg-transparent font-semibold text-slate-900 focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md shadow-slate-900/20 transition"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>

      {/* The Printable Report Page */}
      <div className="bg-white p-8 md:p-10 rounded-2xl border border-slate-200 shadow-lg print-page space-y-8 text-slate-900">
        {/* Header Banner */}
        <div className="border-b-2 border-slate-900 pb-5 text-center">
          <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight text-slate-900">
            {settings.institutionName}
          </h1>
          <h2 className="text-sm md:text-base font-bold uppercase tracking-wider text-amber-700 mt-0.5">
            {settings.departmentName}
          </h2>
          <div className="mt-2 text-xs md:text-sm font-extrabold uppercase tracking-widest bg-slate-900 text-white py-1 px-4 inline-block rounded">
            CIVIL MAINTENANCE – DAILY WORKLOG & ATTENDANCE REPORT
          </div>
          <div className="flex justify-between items-center text-xs font-semibold text-slate-600 mt-4 px-2">
            <span>
              Report Date: <strong className="text-slate-900 font-mono text-sm">{reportDate}</strong>
            </span>
            <span>
              Generated: <strong className="text-slate-900">{new Date().toLocaleString()}</strong>
            </span>
          </div>
        </div>

        {/* SECTION 1: ATTENDANCE SUMMARY */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-300 pb-1">
            <span className="w-5 h-5 rounded bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
              1
            </span>
            <h3 className="font-bold text-sm uppercase tracking-wide text-slate-900">
              Attendance Summary
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-center">
            <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Total Roll</span>
              <span className="text-lg font-black text-slate-900">{totalLabour}</span>
            </div>
            <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50">
              <span className="text-[10px] text-emerald-800 uppercase font-bold block">Full Day</span>
              <span className="text-lg font-black text-emerald-700">{presentFullDay}</span>
            </div>
            <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/50">
              <span className="text-[10px] text-amber-800 uppercase font-bold block">Half Day</span>
              <span className="text-lg font-black text-amber-700">{presentHalfDay}</span>
            </div>
            <div className="p-2.5 rounded-lg border border-rose-200 bg-rose-50/50">
              <span className="text-[10px] text-rose-800 uppercase font-bold block">Absent</span>
              <span className="text-lg font-black text-rose-700">{absentCount}</span>
            </div>
            <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/50">
              <span className="text-[10px] text-blue-800 uppercase font-bold block">Leave/Perm</span>
              <span className="text-lg font-black text-blue-700">{leaveCount + permissionCount}</span>
            </div>
            <div className="p-2.5 rounded-lg border border-slate-900 bg-slate-900 text-white">
              <span className="text-[10px] text-amber-300 uppercase font-bold block">Total Wages</span>
              <span className="text-base font-black text-white font-mono">₹{totalWages}</span>
            </div>
          </div>
        </section>

        {/* SECTION 2: WORKER-WISE ATTENDANCE */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-300 pb-1">
            <span className="w-5 h-5 rounded bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
              2
            </span>
            <h3 className="font-bold text-sm uppercase tracking-wide text-slate-900">
              Worker-wise Attendance Roll
            </h3>
          </div>

          <table className="w-full text-left text-xs border border-slate-200">
            <thead className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700 text-[10px] uppercase">
              <tr>
                <th className="py-2 px-3 border-r border-slate-200">S.No</th>
                <th className="py-2 px-3 border-r border-slate-200">Staff ID</th>
                <th className="py-2 px-3 border-r border-slate-200">Worker Name</th>
                <th className="py-2 px-3 border-r border-slate-200">Designation</th>
                <th className="py-2 px-3 border-r border-slate-200">FN Location & Status</th>
                <th className="py-2 px-3 border-r border-slate-200">AN Location & Status</th>
                <th className="py-2 px-3 text-right">Wage (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-normal">
              {dayRecords.map((r, i) => (
                <tr key={r.id}>
                  <td className="py-1.5 px-3 border-r border-slate-200 text-slate-500 font-mono">{i + 1}</td>
                  <td className="py-1.5 px-3 border-r border-slate-200 font-mono font-bold text-slate-800">
                    {r.staffId}
                  </td>
                  <td className="py-1.5 px-3 border-r border-slate-200 font-semibold">{r.workerName}</td>
                  <td className="py-1.5 px-3 border-r border-slate-200 text-slate-600">{r.designation}</td>
                  <td className="py-1.5 px-3 border-r border-slate-200">
                    <span className="font-semibold">{r.workPlaceFN}</span> ({r.attendanceFN})
                  </td>
                  <td className="py-1.5 px-3 border-r border-slate-200">
                    <span className="font-semibold">{r.workPlaceAN}</span> ({r.attendanceAN})
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono font-bold">{r.wage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* SECTION 3: LOCATION-WISE WORK */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-300 pb-1">
            <span className="w-5 h-5 rounded bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
              3
            </span>
            <h3 className="font-bold text-sm uppercase tracking-wide text-slate-900">
              Location-wise Work Distribution
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {locationBreakdown.map((loc, i) => (
              <div key={i} className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5 text-xs">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-amber-800">{loc.location}</span>
                  <span className="text-slate-600">{loc.workerCount} Workers | ₹{loc.wage}</span>
                </div>
                <div className="text-[11px] text-slate-600 space-y-0.5">
                  {loc.tasks.slice(0, 3).map((t, idx) => (
                    <div key={idx} className="truncate">• {t}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 4: CATEGORY-WISE WORK */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-300 pb-1">
            <span className="w-5 h-5 rounded bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
              4
            </span>
            <h3 className="font-bold text-sm uppercase tracking-wide text-slate-900">
              Category-wise Work Allocation
            </h3>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {categoryBreakdown.map(([cat, data], i) => (
              <div key={i} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-2">
                <span className="font-semibold text-slate-900">{cat}:</span>
                <span className="font-bold text-amber-700">{data.count} tasks</span>
                <span className="text-[10px] text-slate-500 font-mono">(₹{data.wage})</span>
              </div>
            ))}
          </div>
        </section>

        {/* SECTIONS 5 - 7: SPECIFIC TRADES BREAKDOWN (Mason, Carpentry, Welding) */}
        {[
          { num: 5, title: 'Mason Work', list: masonRecords },
          { num: 6, title: 'Carpentry Work', list: carpenterRecords },
          { num: 7, title: 'Welding Work', list: weldingRecords },
        ].map((sec) => (
          <section key={sec.num} className="space-y-2">
            <div className="flex items-center justify-between border-b border-slate-300 pb-1">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-slate-800 text-white text-xs font-bold flex items-center justify-center">
                  {sec.num}
                </span>
                <h3 className="font-bold text-xs uppercase tracking-wide text-slate-900">
                  {sec.title} ({sec.list.length} Records)
                </h3>
              </div>
            </div>

            {sec.list.length === 0 ? (
              <div className="text-slate-400 text-xs italic py-1">No activities logged under this trade today.</div>
            ) : (
              <table className="w-full text-left text-xs border border-slate-200">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[9px] font-bold">
                  <tr>
                    <th className="py-1.5 px-3 border-r border-slate-200">Worker</th>
                    <th className="py-1.5 px-3 border-r border-slate-200">Location</th>
                    <th className="py-1.5 px-3">Work Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sec.list.map((r, rIdx) => (
                    <tr key={`${r.id || r.staffId}-${sec.num}-${rIdx}`}>
                      <td className="py-1.5 px-3 border-r border-slate-200 font-semibold whitespace-nowrap">
                        {r.workerName} ({r.staffId})
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-200 whitespace-nowrap">{r.workPlaceFN}</td>
                      <td className="py-1.5 px-3 text-slate-700 leading-snug">
                        {r.workDetailsFN}
                        {r.workDetailsAN && r.workDetailsAN !== r.workDetailsFN && ` | ${r.workDetailsAN}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ))}

        {/* Verification Signatures Footer */}
        <div className="pt-8 border-t-2 border-slate-300 grid grid-cols-3 gap-6 text-center text-xs">
          <div>
            <div className="h-12" />
            <div className="border-t border-slate-400 font-bold text-slate-800 pt-1">Site Supervisor</div>
            <div className="text-[10px] text-slate-500">Civil Maintenance</div>
          </div>
          <div>
            <div className="h-12" />
            <div className="border-t border-slate-400 font-bold text-slate-800 pt-1">Maintenance Engineer</div>
            <div className="text-[10px] text-slate-500">Department of Civil Maintenance</div>
          </div>
          <div>
            <div className="h-12" />
            <div className="border-t border-slate-400 font-bold text-slate-800 pt-1">Estate Officer / Campus Engineer</div>
            <div className="text-[10px] text-slate-500">Bannari Amman Institute of Technology</div>
          </div>
        </div>
      </div>
    </div>
  );
};
