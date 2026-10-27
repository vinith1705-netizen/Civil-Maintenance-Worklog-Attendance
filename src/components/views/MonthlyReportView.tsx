import React, { useState, useMemo } from 'react';
import {
  CalendarRange,
  DollarSign,
  Users,
  Briefcase,
  Printer,
  Download,
  BarChart3,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const MonthlyReportView: React.FC = () => {
  const { attendance, workers, categories, locations, showToast } = useApp();

  const currentYear = new Date().getFullYear();
  const currentMonthNum = new Date().getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthNum);

  const monthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  // Filter records for this month
  const monthRecords = useMemo(
    () => attendance.filter((a) => a.date.startsWith(monthStr)),
    [attendance, monthStr]
  );

  // Key Metrics
  const totalAttendanceRoll = monthRecords.length;
  const presentRecords = monthRecords.filter((a) => a.attendanceFN === 'Present' || a.attendanceAN === 'Present');
  const totalWorkingDays = new Set(monthRecords.map((a) => a.date)).size;
  const totalWagesMonth = monthRecords.reduce((sum, r) => sum + (r.wage || 0), 0);
  const uniqueWorkersCount = new Set(monthRecords.map((a) => a.staffId)).size;

  // Category Totals
  const categoryTotals = useMemo(() => {
    const map: Record<string, { count: number; wages: number }> = {};
    monthRecords.forEach((r) => {
      const cat = r.workCategory || 'Other';
      if (!map[cat]) map[cat] = { count: 0, wages: 0 };
      map[cat].count += 1;
      map[cat].wages += r.wage || 0;
    });
    return Object.entries(map).sort((a, b) => b[1].wages - a[1].wages);
  }, [monthRecords]);

  // Location Totals
  const locationTotals = useMemo(() => {
    const map: Record<string, { count: number; wages: number }> = {};
    monthRecords.forEach((r) => {
      const loc = r.workPlaceFN || r.workPlaceAN || 'Campus';
      if (!map[loc]) map[loc] = { count: 0, wages: 0 };
      map[loc].count += 1;
      map[loc].wages += r.wage || 0;
    });
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count);
  }, [monthRecords]);

  // Worker-wise Totals
  const workerTotals = useMemo(() => {
    const map: Record<
      string,
      {
        staffId: string;
        name: string;
        designation: string;
        presentDays: number;
        absentDays: number;
        leaveDays: number;
        totalWages: number;
      }
    > = {};

    workers.forEach((w) => {
      map[w.staffId] = {
        staffId: w.staffId,
        name: w.name,
        designation: w.designation,
        presentDays: 0,
        absentDays: 0,
        leaveDays: 0,
        totalWages: 0,
      };
    });

    monthRecords.forEach((r) => {
      if (!map[r.staffId]) {
        map[r.staffId] = {
          staffId: r.staffId,
          name: r.workerName,
          designation: r.designation,
          presentDays: 0,
          absentDays: 0,
          leaveDays: 0,
          totalWages: 0,
        };
      }
      const isPresent = r.attendanceFN === 'Present' || r.attendanceAN === 'Present';
      const isAbsent = r.attendanceFN === 'Absent' && r.attendanceAN === 'Absent';
      const isLeave = r.attendanceFN === 'Leave' || r.attendanceAN === 'Leave';

      if (isPresent) map[r.staffId].presentDays += 1;
      if (isAbsent) map[r.staffId].absentDays += 1;
      if (isLeave) map[r.staffId].leaveDays += 1;
      map[r.staffId].totalWages += r.wage || 0;
    });

    return Object.values(map)
      .filter((w) => w.presentDays > 0 || w.totalWages > 0 || w.absentDays > 0)
      .sort((a, b) => b.totalWages - a.totalWages);
  }, [workers, monthRecords]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Staff ID', 'Worker Name', 'Designation', 'Present Days', 'Absent Days', 'Leave Days', 'Total Wages (₹)'];
    const rows = workerTotals.map((w) => [
      `"${w.staffId}"`,
      `"${w.name}"`,
      `"${w.designation}"`,
      w.presentDays,
      w.absentDays,
      w.leaveDays,
      w.totalWages,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BIT_Civil_Monthly_Report_${monthStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', 'Monthly Report exported to CSV.');
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const maxWage = Math.max(...categoryTotals.map((c) => c[1].wages), 1000);

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* Top Header with Month/Year Selector */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 no-print">
        <div>
          <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-bold uppercase tracking-wider">
            Monthly Roll Consolidation
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-1">Monthly Worklog & Wage Ledger</h2>
          <p className="text-xs text-slate-500">
            Consolidated manpower allocation, cumulative wages, and site distributions for audited periods.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white"
            >
              {monthNames.map((name, i) => (
                <option key={i + 1} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white font-mono"
            >
              {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => window.print()}
            className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/30 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Top Banner Stats */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
              Department of Civil Maintenance
            </span>
            <h3 className="text-xl md:text-2xl font-black mt-0.5">
              {monthNames[selectedMonth - 1]} {selectedYear} Statement
            </h3>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Monthly Wages</span>
            <div className="text-2xl font-black text-amber-400 font-mono">
              ₹{totalWagesMonth.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 text-center">
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Workers</span>
            <div className="text-xl font-extrabold text-white mt-0.5">{uniqueWorkersCount}</div>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Working Days</span>
            <div className="text-xl font-extrabold text-white mt-0.5">{totalWorkingDays} days</div>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Man-Days Present</span>
            <div className="text-xl font-extrabold text-emerald-400 mt-0.5">{presentRecords.length}</div>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Roll Entries</span>
            <div className="text-xl font-extrabold text-white mt-0.5">{totalAttendanceRoll}</div>
          </div>
        </div>
      </div>

      {/* Visual Chart: Category Expenditure Bar Chart */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-600" />
            <h3 className="font-bold text-sm text-slate-900">Trade Category Expenditure Breakdown</h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">Month: {monthStr}</span>
        </div>

        {categoryTotals.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">No records logged for this month.</div>
        ) : (
          <div className="space-y-3">
            {categoryTotals.map(([catName, data]) => {
              const pct = Math.round((data.wages / maxWage) * 100);
              return (
                <div key={catName} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-800">{catName} ({data.count} tasks)</span>
                    <span className="font-mono font-bold text-slate-900">₹{data.wages.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-amber-600 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(pct, 5)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Grid: Location Totals & Worker-Wise Wage Table */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Location Totals */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
            Campus Sites Deployed
          </h3>
          <div className="space-y-2">
            {locationTotals.map(([loc, data], i) => (
              <div key={i} className="flex justify-between items-center text-xs p-2 rounded-lg bg-slate-50">
                <span className="font-semibold text-slate-800">{loc}</span>
                <div className="text-right">
                  <span className="font-bold text-slate-900 block">{data.count} logs</span>
                  <span className="text-[10px] text-slate-500 font-mono">₹{data.wages}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Worker-Wise Monthly Roll & Wages */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">Worker-Wise Attendance & Monthly Wage Pay</h3>
            <span className="text-xs text-slate-500 font-mono">{workerTotals.length} Workers</span>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px] sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Staff ID</th>
                  <th className="py-2.5 px-3">Worker Name</th>
                  <th className="py-2.5 px-3">Trade</th>
                  <th className="py-2.5 px-3 text-center">Present</th>
                  <th className="py-2.5 px-3 text-center">Absent</th>
                  <th className="py-2.5 px-3 text-right">Monthly Wages</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workerTotals.map((w) => (
                  <tr key={w.staffId} className="hover:bg-slate-50/80">
                    <td className="py-2 px-3 font-mono font-bold text-slate-800">{w.staffId}</td>
                    <td className="py-2 px-3 font-medium text-slate-900">{w.name}</td>
                    <td className="py-2 px-3 text-slate-600">{w.designation}</td>
                    <td className="py-2 px-3 text-center font-bold text-emerald-700">{w.presentDays}</td>
                    <td className="py-2 px-3 text-center font-bold text-rose-600">{w.absentDays}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                      ₹{w.totalWages.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
