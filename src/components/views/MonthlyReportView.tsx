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
  Layers,
  AlertCircle,
  CheckCircle2,
  FileText,
  MapPin,
  Building,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getTodayDateString } from '../../data/seedData';

export const MonthlyReportView: React.FC = () => {
  const { attendance, workers, categories, locations, complaints, showToast } = useApp();

  const currentYear = new Date().getFullYear();
  const currentMonthNum = new Date().getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthNum);

  const monthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  // Filter records for this month
  const monthRecords = useMemo(
    () => attendance.filter((a) => a.date.startsWith(monthStr)),
    [attendance, monthStr]
  );

  // Filter complaints for this month
  const monthComplaints = useMemo(
    () => complaints.filter((c) => c.reportedDate && c.reportedDate.startsWith(monthStr)),
    [complaints, monthStr]
  );

  // Key Metrics
  const totalAttendanceRoll = monthRecords.length;
  const presentRecords = monthRecords.filter((a) => a.attendanceFN === 'Present' || a.attendanceAN === 'Present');
  const totalWorkingDays = new Set(monthRecords.map((a) => a.date)).size;
  const totalWagesMonth = monthRecords.reduce((sum, r) => sum + (r.wage || 0), 0);
  const uniqueWorkersCount = new Set(monthRecords.map((a) => a.staffId)).size;

  // Work Categories & Complaint Count Monthly Breakdown
  const categoryComplaintBreakdown = useMemo(() => {
    return categories.map((cat) => {
      const catComplaints = monthComplaints.filter(
        (c) => c.category.toLowerCase() === cat.name.toLowerCase()
      );
      const total = catComplaints.length;
      const pending = catComplaints.filter((c) => c.status === 'Pending').length;
      const inProgress = catComplaints.filter((c) => c.status === 'In Progress').length;
      const resolved = catComplaints.filter((c) => c.status === 'Resolved').length;
      const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 100;
      
      const assignedLabours = workers.filter((w) => {
        const wCat = (w.category || '').toLowerCase();
        const wDesig = (w.designation || '').toLowerCase();
        const target = cat.name.toLowerCase();
        return wCat.includes(target) || wDesig.includes(target) || target.includes(wCat) || target.includes(wDesig);
      }).length;

      return {
        category: cat,
        total,
        pending,
        inProgress,
        resolved,
        resolutionRate,
        assignedLabours,
      };
    });
  }, [categories, monthComplaints, workers]);

  const totalMonthComplaints = categoryComplaintBreakdown.reduce((sum, c) => sum + c.total, 0);
  const totalMonthResolved = categoryComplaintBreakdown.reduce((sum, c) => sum + c.resolved, 0);
  const totalMonthPending = categoryComplaintBreakdown.reduce((sum, c) => sum + c.pending, 0);

  // Export Work Categories & Complaint Count CSV
  const handleExportCategoryComplaintsCSV = () => {
    const monthLabel = `${monthNames[selectedMonth - 1]} ${selectedYear}`;
    const lines: string[] = [];

    lines.push(`"BANNARI AMMAN INSTITUTE OF TECHNOLOGY - DEPARTMENT OF CIVIL MAINTENANCE"`);
    lines.push(`"WORK CATEGORIES & COMPLAINT COUNT MONTHLY REPORT - ${monthLabel.toUpperCase()}"`);
    lines.push(`"Generated On: ${getTodayDateString()}","Permitted Categories: Mason Work, Carpentry Work, Welding Work"`);
    lines.push('');

    lines.push('"--- WORK CATEGORIES & COMPLAINT COUNT BREAKDOWN ---"');
    lines.push('"S.No","Work Category","Total Complaints","Pending","In Progress","Resolved","Resolution Rate (%)","Assigned Workers"');
    categoryComplaintBreakdown.forEach((item, idx) => {
      lines.push(
        [
          idx + 1,
          `"${item.category.name}"`,
          item.total,
          item.pending,
          item.inProgress,
          item.resolved,
          `"${item.resolutionRate}%"`,
          item.assignedLabours,
        ].join(',')
      );
    });
    lines.push(
      [
        '"TOTAL"',
        '"ALL 3 CIVIL TRADES"',
        totalMonthComplaints,
        totalMonthPending,
        categoryComplaintBreakdown.reduce((s, c) => s + c.inProgress, 0),
        totalMonthResolved,
        `"${totalMonthComplaints > 0 ? Math.round((totalMonthResolved / totalMonthComplaints) * 100) : 100}%"`,
        workers.length,
      ].join(',')
    );
    lines.push('');

    lines.push('"--- DETAILED COMPLAINT TICKETS REGISTER ---"');
    lines.push('"Ticket ID","Work Category","Location","Complaint Description","Priority","Status","Reported Date","Resolved Date","Assigned Specialist"');
    if (monthComplaints.length === 0) {
      lines.push('"No complaints logged for this month."');
    } else {
      monthComplaints.forEach((c) => {
        lines.push(
          [
            `"${c.id}"`,
            `"${c.category}"`,
            `"${c.location}"`,
            `"${(c.description || '').replace(/"/g, '""')}"`,
            `"${c.priority}"`,
            `"${c.status}"`,
            `"${c.reportedDate}"`,
            `"${c.resolvedDate || '-'}"`,
            `"${c.assignedWorker || 'Unassigned'}"`,
          ].join(',')
        );
      });
    }

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + lines.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BIT_Civil_Work_Categories_Complaint_Monthly_Report_${monthStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', `Exported Work Categories & Complaint Count Report for ${monthLabel}.`);
  };

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

  // Active tab inside monthly report: 'worklogs' | 'wages' | 'categories' | 'sites'
  const [activeTabMode, setActiveTabMode] = useState<'worklogs' | 'wages' | 'categories' | 'sites'>('worklogs');

  // 1. Comprehensive Work Monthly Report CSV (All daily tasks, sites, workers, and attendance for the month)
  const handleExportWorkMonthlyReportCSV = () => {
    const monthLabel = `${monthNames[selectedMonth - 1]} ${selectedYear}`;
    const lines: string[] = [];

    // Institutional Header
    lines.push(`"BANNARI AMMAN INSTITUTE OF TECHNOLOGY - SATHYAMANGALAM - 638401"`);
    lines.push(`"DEPARTMENT OF CIVIL MAINTENANCE - MONTHLY WORK REPORT"`);
    lines.push(`"AUDITED PERIOD: ${monthLabel.toUpperCase()}","Generated On: ${getTodayDateString()}"`);
    lines.push(`"Total Working Days: ${totalWorkingDays}","Total Man-Days Present: ${presentRecords.length}","Total Wages Disbursed: ₹${totalWagesMonth}"`);
    lines.push('');

    // Executive Summary
    lines.push('"--- MONTHLY WORK OVERVIEW & MANPOWER METRICS ---"');
    lines.push(`"Report Month","${monthLabel}"`);
    lines.push(`"Total Working Days Logged",${totalWorkingDays}`);
    lines.push(`"Total Man-Days Present",${presentRecords.length}`);
    lines.push(`"Total Attendance Roll Entries",${totalAttendanceRoll}`);
    lines.push(`"Total Monthly Wages Disbursed (₹)",${totalWagesMonth}`);
    lines.push(`"Total Official Workers in Roster",${workers.length}`);
    lines.push(`"Permitted Categories","Mason Work, Carpentry Work, Welding Work"`);
    lines.push('');

    // Trade Category Summary
    lines.push('"--- TRADE CATEGORY EXPENDITURE & TASK SUMMARY ---"');
    lines.push('"Category / Trade","Tasks Logged","Cumulative Wages (₹)","% of Monthly Budget"');
    categoryTotals.forEach(([catName, data]) => {
      const pct = totalWagesMonth > 0 ? Math.round((data.wages / totalWagesMonth) * 100) : 0;
      lines.push([`"${catName}"`, data.count, data.wages, `"${pct}%"`].join(','));
    });
    lines.push('');

    // Detailed Daily Worklogs & Attendance Table
    lines.push('"--- DETAILED DAILY WORKLOG & ATTENDANCE REGISTER ---"');
    lines.push('"Date","S.No","Staff ID","Worker Name","Designation","Category","FN Campus Site","FN Work Details & Tasks","FN Status","AN Campus Site","AN Work Details & Tasks","AN Status","Daily Wage (₹)","Approval Status"');

    const sortedRecords = [...monthRecords].sort(
      (a, b) => a.date.localeCompare(b.date) || a.staffId.localeCompare(b.staffId)
    );

    if (sortedRecords.length === 0) {
      lines.push('"No daily work records found for this month."');
    } else {
      sortedRecords.forEach((r, idx) => {
        lines.push(
          [
            `"${r.date}"`,
            idx + 1,
            `"${r.staffId}"`,
            `"${r.workerName}"`,
            `"${r.designation}"`,
            `"${r.workCategory || 'Mason Work'}"`,
            `"${r.workPlaceFN || '-'}"`,
            `"${(r.workDetailsFN || '').replace(/"/g, '""')}"`,
            `"${r.attendanceFN}"`,
            `"${r.workPlaceAN || '-'}"`,
            `"${(r.workDetailsAN || '').replace(/"/g, '""')}"`,
            `"${r.attendanceAN}"`,
            r.wage || 0,
            `"${r.status || 'Approved'}"`,
          ].join(',')
        );
      });
    }

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + lines.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BIT_Civil_Work_Monthly_Report_${monthStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', `Complete Work Monthly Report downloaded for ${monthLabel}.`, 'Work Monthly Report Exported');
  };

  // 2. Export Worker Wages Ledger CSV
  const handleExportCSV = () => {
    const monthLabel = `${monthNames[selectedMonth - 1]} ${selectedYear}`;
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

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BIT_Civil_Monthly_Wage_Roll_${monthStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', `Worker Wage Roll exported for ${monthLabel}.`);
  };

  const maxWage = Math.max(...categoryTotals.map((c) => c[1].wages), 1000);

  // Sorted records for the monthly worklogs view
  const sortedMonthRecords = useMemo(() => {
    return [...monthRecords].sort(
      (a, b) => b.date.localeCompare(a.date) || a.staffId.localeCompare(b.staffId)
    );
  }, [monthRecords]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* Top Header with Month/Year Selector */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 no-print">
        <div>
          <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
            Monthly Roll Consolidation
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-1">Monthly Worklog & Wage Ledger</h2>
          <p className="text-xs text-slate-500">
            Consolidated manpower allocation, cumulative wages, and site distributions for audited periods.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => {
                if (selectedMonth === 1) {
                  setSelectedMonth(12);
                  setSelectedYear((y) => y - 1);
                } else {
                  setSelectedMonth((m) => m - 1);
                }
              }}
              className="px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg text-xs font-bold transition cursor-pointer"
              title="Previous Month"
            >
              &larr; Prev
            </button>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-2.5 py-1 text-xs font-bold rounded-lg border-0 bg-transparent text-slate-800 cursor-pointer focus:ring-0"
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
              className="px-2 py-1 text-xs font-mono font-bold rounded-lg border-0 bg-transparent text-slate-800 cursor-pointer focus:ring-0"
            >
              {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                if (selectedMonth === 12) {
                  setSelectedMonth(1);
                  setSelectedYear((y) => y + 1);
                } else {
                  setSelectedMonth((m) => m + 1);
                }
              }}
              className="px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg text-xs font-bold transition cursor-pointer"
              title="Next Month"
            >
              Next &rarr;
            </button>
          </div>

          <button
            onClick={() => window.print()}
            className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* DEDICATED WORK MONTHLY REPORT DOWNLOAD OPTIONS TOOLBAR */}
      <div className="bg-gradient-to-br from-amber-500/10 via-emerald-500/5 to-slate-100 p-5 rounded-2xl border border-amber-200/90 shadow-sm no-print">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-black uppercase tracking-wider">
                Work Monthly Report Download Options
              </span>
              <span className="text-xs text-slate-600 font-mono font-bold">
                Period: {monthNames[selectedMonth - 1]} {selectedYear}
              </span>
            </div>
            <h3 className="text-base font-black text-slate-900 mt-1">
              Export Monthly Work Reports & Ledgers
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Select any download format below to export verified daily tasks, wage rolls, or category audits.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Primary Download: Full Work Monthly Report */}
            <button
              onClick={handleExportWorkMonthlyReportCSV}
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/30 flex items-center gap-2 cursor-pointer transition"
              title="Download full daily worklogs & tasks for the month (CSV/Excel)"
            >
              <Download className="w-4 h-4" />
              <span>Download Work Monthly Report (CSV)</span>
            </button>

            {/* Wage Roll CSV */}
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md shadow-slate-900/30 flex items-center gap-1.5 cursor-pointer transition"
              title="Download worker-wise attendance days & wage roll"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Wages Roll CSV</span>
            </button>

            {/* Category & Complaints CSV */}
            <button
              onClick={handleExportCategoryComplaintsCSV}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md shadow-emerald-700/30 flex items-center gap-1.5 cursor-pointer transition"
              title="Download trade categories & complaint resolution report"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Category Complaints CSV</span>
            </button>

            {/* Print / PDF */}
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Print / PDF</span>
            </button>
          </div>
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

      {/* VIEW MODE TABS NAVIGATION */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 no-print">
        <button
          onClick={() => setActiveTabMode('worklogs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTabMode === 'worklogs'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Daily Work Tasks Log ({monthRecords.length})</span>
        </button>

        <button
          onClick={() => setActiveTabMode('wages')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTabMode === 'wages'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>Worker Wages Ledger ({workerTotals.length})</span>
        </button>

        <button
          onClick={() => setActiveTabMode('categories')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTabMode === 'categories'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Work Categories & Complaints (3 Trades)</span>
        </button>

        <button
          onClick={() => setActiveTabMode('sites')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTabMode === 'sites'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>Campus Sites Deployed ({locationTotals.length})</span>
        </button>
      </div>

      {/* TAB 1: DAILY WORK TASKS LOG FOR THE MONTH */}
      {activeTabMode === 'worklogs' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50">
            <div>
              <h4 className="font-black text-sm text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-600" />
                <span>Daily Work Tasks & Site Log ({monthNames[selectedMonth - 1]} {selectedYear})</span>
              </h4>
              <p className="text-xs text-slate-500">
                Detailed record of tasks performed, site allocations, and wages for each day of the month.
              </p>
            </div>

            <button
              onClick={handleExportWorkMonthlyReportCSV}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Work Monthly Report (CSV)</span>
            </button>
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-700 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Staff ID</th>
                  <th className="py-2.5 px-3">Worker Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">FN Campus Site</th>
                  <th className="py-2.5 px-3">FN Work Details</th>
                  <th className="py-2.5 px-3">AN Campus Site</th>
                  <th className="py-2.5 px-3">AN Work Details</th>
                  <th className="py-2.5 px-3 text-center">Attendance</th>
                  <th className="py-2.5 px-3 text-right">Wage (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedMonthRecords.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      No daily work records found for {monthNames[selectedMonth - 1]} {selectedYear}.
                    </td>
                  </tr>
                ) : (
                  sortedMonthRecords.map((r, i) => (
                    <tr key={r.id || `${r.date}_${r.staffId}_${i}`} className="hover:bg-slate-50/80 transition">
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-700 font-bold whitespace-nowrap">
                        {r.date}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-800">{r.staffId}</td>
                      <td className="py-2 px-3 font-medium text-slate-900 whitespace-nowrap">{r.workerName}</td>
                      <td className="py-2 px-3 text-slate-600">{r.workCategory || 'Mason Work'}</td>
                      <td className="py-2 px-3 text-slate-700 whitespace-nowrap">{r.workPlaceFN || '-'}</td>
                      <td className="py-2 px-3 text-slate-600 max-w-xs truncate" title={r.workDetailsFN}>
                        {r.workDetailsFN || '-'}
                      </td>
                      <td className="py-2 px-3 text-slate-700 whitespace-nowrap">{r.workPlaceAN || '-'}</td>
                      <td className="py-2 px-3 text-slate-600 max-w-xs truncate" title={r.workDetailsAN}>
                        {r.workDetailsAN || '-'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.attendanceFN === 'Present' && r.attendanceAN === 'Present'
                              ? 'bg-emerald-100 text-emerald-800'
                              : r.attendanceFN === 'Present' || r.attendanceAN === 'Present'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {r.attendanceFN === 'Present' && r.attendanceAN === 'Present'
                            ? 'Full'
                            : r.attendanceFN === 'Present' || r.attendanceAN === 'Present'
                            ? 'Half'
                            : 'Absent'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        ₹{r.wage || 0}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: WORKER-WISE WAGES ROLL */}
      {activeTabMode === 'wages' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50">
            <div>
              <h4 className="font-black text-sm text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span>Worker-Wise Attendance & Monthly Wage Roll ({workerTotals.length} Workers)</span>
              </h4>
              <p className="text-xs text-slate-500">
                Summary of days present, absences, and total wages earned for the month.
              </p>
            </div>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Wages Roll CSV</span>
            </button>
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-700 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Staff ID</th>
                  <th className="py-2.5 px-3">Worker Name</th>
                  <th className="py-2.5 px-3">Trade</th>
                  <th className="py-2.5 px-3 text-center">Present Days</th>
                  <th className="py-2.5 px-3 text-center">Absent Days</th>
                  <th className="py-2.5 px-3 text-center">Leave Days</th>
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
                    <td className="py-2 px-3 text-center font-medium text-slate-500">{w.leaveDays}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                      ₹{w.totalWages.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: WORK CATEGORIES & COMPLAINT COUNT MONTHLY SUMMARY */}
      {activeTabMode === 'categories' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
                    3 Civil Trades
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    {monthNames[selectedMonth - 1]} {selectedYear}
                  </span>
                </div>
                <h3 className="font-bold text-base text-slate-900 mt-1 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-600" />
                  <span>Work Categories & Complaint Count Summary</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Complaints received, resolution rate, and manpower capacity across Mason, Carpentry, and Welding.
                </p>
              </div>

              <button
                onClick={handleExportCategoryComplaintsCSV}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition cursor-pointer self-start sm:self-auto"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Category Report (CSV)</span>
              </button>
            </div>

            {/* Categories Breakdown Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">S.No</th>
                    <th className="py-2.5 px-3">Work Category</th>
                    <th className="py-2.5 px-3 text-center">Total Complaints</th>
                    <th className="py-2.5 px-3 text-center">Pending</th>
                    <th className="py-2.5 px-3 text-center">In Progress</th>
                    <th className="py-2.5 px-3 text-center">Resolved</th>
                    <th className="py-2.5 px-3">Resolution %</th>
                    <th className="py-2.5 px-3 text-center">Assigned Labours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categoryComplaintBreakdown.map((item, idx) => (
                    <tr key={item.category.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-500">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: item.category.color }}
                          />
                          <span>{item.category.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-black text-slate-900">
                        {item.total}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-rose-700">
                        {item.pending}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-amber-700">
                        {item.inProgress}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-emerald-700">
                        {item.resolved}
                      </td>
                      <td className="py-2.5 px-3 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                            <div
                              className="h-2 rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.max(item.resolutionRate, item.total === 0 ? 100 : 5)}%`,
                                backgroundColor: item.category.color,
                              }}
                            />
                          </div>
                          <span className="font-mono text-[10px] font-bold text-slate-700 shrink-0">
                            {item.resolutionRate}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-700">
                        {item.assignedLabours}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-black text-slate-900 border-t-2 border-slate-200">
                    <td className="py-2.5 px-3 font-mono">TOTAL</td>
                    <td className="py-2.5 px-3 uppercase text-[11px]">All 3 Trades</td>
                    <td className="py-2.5 px-3 text-center font-mono">{totalMonthComplaints}</td>
                    <td className="py-2.5 px-3 text-center font-mono text-rose-700">{totalMonthPending}</td>
                    <td className="py-2.5 px-3 text-center font-mono text-amber-700">
                      {categoryComplaintBreakdown.reduce((s, c) => s + c.inProgress, 0)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-emerald-700">{totalMonthResolved}</td>
                    <td className="py-2.5 px-3 font-mono text-[#1b7a54]">
                      {totalMonthComplaints > 0 ? Math.round((totalMonthResolved / totalMonthComplaints) * 100) : 100}%
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">{workers.length}</td>
                  </tr>
                </tbody>
              </table>
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
        </div>
      )}

      {/* TAB 4: CAMPUS SITES DEPLOYED */}
      {activeTabMode === 'sites' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-600" />
                <span>Campus Sites Deployed in {monthNames[selectedMonth - 1]} {selectedYear}</span>
              </h3>
              <p className="text-xs text-slate-500">
                Manpower task distribution and cumulative wages by campus hostel, department, and site.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
              {locationTotals.length} Active Sites
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {locationTotals.map(([loc, data], i) => (
              <div key={i} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-sm text-slate-900">{loc}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-800 font-mono">
                    {data.count} logs
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-200/60 flex justify-between text-xs text-slate-600">
                  <span>Wages Disbursed:</span>
                  <span className="font-mono font-bold text-slate-900">₹{data.wages.toLocaleString('en-IN')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OFFICIAL INSTITUTIONAL PRINT FOOTER (Visible on print) */}
      <div className="hidden print:block space-y-4 pt-8 border-t-2 border-slate-900 text-slate-900">
        <div className="text-center space-y-1">
          <h2 className="text-base font-black uppercase">BANNARI AMMAN INSTITUTE OF TECHNOLOGY</h2>
          <p className="text-xs uppercase font-bold">DEPARTMENT OF CIVIL MAINTENANCE • SATHYAMANGALAM</p>
          <h3 className="text-xs font-bold underline mt-1">
            MONTHLY WORK REPORT & WAGE AUDIT STATEMENT - {monthNames[selectedMonth - 1].toUpperCase()} {selectedYear}
          </h3>
        </div>
        <div className="flex justify-between items-center text-xs pt-12">
          <div className="text-center w-40 border-t border-slate-900 pt-1 font-bold">
            Prepared by<br />(Site Supervisor)
          </div>
          <div className="text-center w-40 border-t border-slate-900 pt-1 font-bold">
            Verified by<br />(Assistant Engineer - Civil)
          </div>
          <div className="text-center w-40 border-t border-slate-900 pt-1 font-bold">
            Approved by<br />(Executive Engineer)
          </div>
        </div>
      </div>
    </div>
  );
};
