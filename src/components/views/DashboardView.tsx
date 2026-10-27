import React, { useState, useMemo } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  DollarSign,
  MapPin,
  Hammer,
  Wrench,
  Paintbrush,
  Flame,
  Layers,
  Briefcase,
  Calendar,
  ChevronRight,
  TrendingUp,
  Activity,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getTodayDateString } from '../../data/seedData';
import { AttendanceRecord, WorklogRecord } from '../../types';

export const DashboardView: React.FC = () => {
  const { workers, attendance, worklogs, locations, categories, complaints, setActiveTab, setAiAssistantOpen } = useApp();
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());

  // Filter records for selected date
  const todayAttendance = useMemo(
    () => attendance.filter((a) => a.date === selectedDate),
    [attendance, selectedDate]
  );

  const todayWorklogs = useMemo(
    () => worklogs.filter((w) => w.date === selectedDate),
    [worklogs, selectedDate]
  );

  // Compute key metrics
  const totalWorkersCount = workers.length;
  const activeWorkersCount = workers.filter((w) => w.status === 'Active').length;

  const presentCount = todayAttendance.filter(
    (a) => a.attendanceFN === 'Present' || a.attendanceAN === 'Present'
  ).length;

  const fullDayPresentCount = todayAttendance.filter(
    (a) => a.attendanceFN === 'Present' && a.attendanceAN === 'Present'
  ).length;

  const halfDayPresentCount = todayAttendance.filter(
    (a) =>
      (a.attendanceFN === 'Present' && a.attendanceAN !== 'Present') ||
      (a.attendanceFN !== 'Present' && a.attendanceAN === 'Present')
  ).length;

  const absentCount = todayAttendance.filter(
    (a) => a.attendanceFN === 'Absent' && a.attendanceAN === 'Absent'
  ).length;

  const totalWagesToday = todayAttendance.reduce((sum, a) => sum + (a.wage || 0), 0);

  // Unique active locations today
  const activeLocationsToday = useMemo(() => {
    const locSet = new Set<string>();
    todayAttendance.forEach((a) => {
      if (a.workPlaceFN) locSet.add(a.workPlaceFN);
      if (a.workPlaceAN) locSet.add(a.workPlaceAN);
    });
    return Array.from(locSet).filter(Boolean);
  }, [todayAttendance]);

  // Category counts today
  const getCategoryCount = (categoryName: string) => {
    return todayAttendance.filter((a) => {
      const matchCat = a.workCategory?.toLowerCase().includes(categoryName.toLowerCase());
      const matchDesig = a.designation?.toLowerCase().includes(categoryName.toLowerCase());
      const matchFN = a.workDetailsFN?.toLowerCase().includes(categoryName.toLowerCase());
      const matchAN = a.workDetailsAN?.toLowerCase().includes(categoryName.toLowerCase());
      return matchCat || matchDesig || matchFN || matchAN;
    }).length;
  };

  const getCategoryComplaintCount = (keyword: string) => {
    const matchedCategory = categories.find((c) =>
      c.name.toLowerCase().includes(keyword.toLowerCase())
    );
    const fromList = complaints.filter((comp) =>
      comp.category.toLowerCase().includes(keyword.toLowerCase())
    ).length;
    return Math.max(matchedCategory?.complaintCount || 0, fromList);
  };

  const masonCount = getCategoryCount('mason');
  const carpenterCount = getCategoryCount('carpent');
  const painterCount = getCategoryCount('paint') + getCategoryCount('polish');
  const weldingCount = getCategoryCount('weld');
  const scaffoldingCount = getCategoryCount('scaffold');
  const otherCount = Math.max(
    0,
    presentCount - (masonCount + carpenterCount + painterCount + weldingCount + scaffoldingCount)
  );

  // Location wise summary
  const locationBreakdown = useMemo(() => {
    const counts: Record<string, { count: number; workers: Set<string>; wage: number }> = {};
    todayAttendance.forEach((a) => {
      const loc = a.workPlaceFN || a.workPlaceAN || 'Campus';
      if (!counts[loc]) {
        counts[loc] = { count: 0, workers: new Set(), wage: 0 };
      }
      counts[loc].count += 1;
      counts[loc].workers.add(a.workerName);
      counts[loc].wage += a.wage || 0;
    });

    return Object.entries(counts)
      .map(([name, data]) => ({
        location: name,
        workerCount: data.workers.size,
        totalWage: data.wage,
      }))
      .sort((a, b) => b.workerCount - a.workerCount);
  }, [todayAttendance]);

  // Monthly summary calculations (current month)
  const currentMonth = selectedDate.substring(0, 7); // YYYY-MM
  const monthAttendance = useMemo(
    () => attendance.filter((a) => a.date.startsWith(currentMonth)),
    [attendance, currentMonth]
  );
  const monthlyTotalWages = monthAttendance.reduce((sum, a) => sum + (a.wage || 0), 0);
  const monthlyTotalManDays = monthAttendance.filter(
    (a) => a.attendanceFN === 'Present' || a.attendanceAN === 'Present'
  ).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Date Filter */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 rounded-2xl p-5 md:p-6 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400 mb-1">
            <Activity className="w-4 h-4" /> Live Maintenance Operations Dashboard
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">
            Department of Civil Maintenance
          </h2>
          <p className="text-xs md:text-sm text-slate-300 mt-1 max-w-xl">
            Real-time daily labour roll-call, work locations, skill deployment, and expenditure for Bannari Amman Institute of Technology.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-xl text-xs">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span className="text-slate-300 font-medium">Log Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={() => setActiveTab('attendance_entry')}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition shadow-md shadow-amber-600/30 flex items-center gap-1.5"
          >
            <span>+ Enter Attendance</span>
          </button>
        </div>
      </div>

      {/* 12 Dashboard Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* 1. Total Workers */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold uppercase">Total Workers</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{totalWorkersCount}</div>
          <div className="text-[10px] text-slate-500 mt-1">{activeWorkersCount} active in roll</div>
        </div>

        {/* 2. Present Today */}
        <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 shadow-xs bg-emerald-50/20">
          <div className="flex items-center justify-between text-emerald-700 mb-2">
            <span className="text-[11px] font-semibold uppercase">Present Today</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-700">{presentCount}</div>
          <div className="text-[10px] text-emerald-600 mt-1">
            {fullDayPresentCount} Full | {halfDayPresentCount} Half Day
          </div>
        </div>

        {/* 3. Absent Today */}
        <div className="bg-white p-3.5 rounded-2xl border border-rose-200 shadow-xs bg-rose-50/20">
          <div className="flex items-center justify-between text-rose-700 mb-2">
            <span className="text-[11px] font-semibold uppercase">Absent Today</span>
            <UserX className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-extrabold text-rose-700">{absentCount}</div>
          <div className="text-[10px] text-rose-500 mt-1">On leave / permission</div>
        </div>

        {/* 4. Total Labour */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold uppercase">Total Labour</span>
            <Briefcase className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {todayAttendance.length}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Recorded entries</div>
        </div>

        {/* 5. Total Wages Today */}
        <div className="bg-white p-3.5 rounded-2xl border border-amber-200 shadow-xs bg-amber-50/20">
          <div className="flex items-center justify-between text-amber-800 mb-2">
            <span className="text-[11px] font-semibold uppercase">Wages Today</span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold text-amber-800">
            ₹{totalWagesToday.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-amber-600 mt-1">Daily civil payroll</div>
        </div>

        {/* 6. Total Work Locations */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold uppercase">Work Sites</span>
            <MapPin className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {activeLocationsToday.length}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Active hostels & sheds</div>
        </div>

        {/* 7. Mason Work */}
        <div
          onClick={() => setActiveTab('categories')}
          className="bg-white p-3.5 rounded-2xl border border-orange-200 shadow-xs cursor-pointer hover:bg-orange-50/30 transition group"
        >
          <div className="flex items-center justify-between text-orange-700 mb-1">
            <span className="text-[11px] font-bold uppercase">Mason Work</span>
            <Hammer className="w-4 h-4 text-orange-600 group-hover:scale-110 transition" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-extrabold text-orange-800">{masonCount}</div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-100 text-orange-800">
              {getCategoryComplaintCount('mason')} Complaints
            </span>
          </div>
          <div className="text-[10px] text-orange-600 mt-1 flex items-center justify-between">
            <span>Plaster & brickwork</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>

        {/* 8. Carpenter Work */}
        <div
          onClick={() => setActiveTab('categories')}
          className="bg-white p-3.5 rounded-2xl border border-lime-200 shadow-xs bg-lime-50/20 cursor-pointer hover:bg-lime-50/50 transition group"
        >
          <div className="flex items-center justify-between text-lime-800 mb-1">
            <span className="text-[11px] font-bold uppercase">Carpenter</span>
            <Wrench className="w-4 h-4 text-lime-600 group-hover:scale-110 transition" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-extrabold text-lime-800">{carpenterCount}</div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-lime-100 text-lime-800">
              {getCategoryComplaintCount('carpent')} Complaints
            </span>
          </div>
          <div className="text-[10px] text-lime-600 mt-1 flex items-center justify-between">
            <span>Doors & furniture</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>

        {/* 9. Painter Work */}
        <div
          onClick={() => setActiveTab('categories')}
          className="bg-white p-3.5 rounded-2xl border border-cyan-200 shadow-xs bg-cyan-50/20 cursor-pointer hover:bg-cyan-50/50 transition group"
        >
          <div className="flex items-center justify-between text-cyan-800 mb-1">
            <span className="text-[11px] font-bold uppercase">Painter / Polish</span>
            <Paintbrush className="w-4 h-4 text-cyan-600 group-hover:scale-110 transition" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-extrabold text-cyan-800">{painterCount}</div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-100 text-cyan-800">
              {getCategoryComplaintCount('paint')} Complaints
            </span>
          </div>
          <div className="text-[10px] text-cyan-600 mt-1 flex items-center justify-between">
            <span>Touchups & coats</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>

        {/* 10. Welding Work */}
        <div
          onClick={() => setActiveTab('categories')}
          className="bg-white p-3.5 rounded-2xl border border-red-200 shadow-xs bg-red-50/20 cursor-pointer hover:bg-red-50/50 transition group"
        >
          <div className="flex items-center justify-between text-red-800 mb-1">
            <span className="text-[11px] font-bold uppercase">Welding</span>
            <Flame className="w-4 h-4 text-red-600 group-hover:scale-110 transition" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-extrabold text-red-800">{weldingCount}</div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-800">
              {getCategoryComplaintCount('weld')} Complaints
            </span>
          </div>
          <div className="text-[10px] text-red-600 mt-1 flex items-center justify-between">
            <span>Grill & trench works</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>

        {/* 11. Scaffolding Work */}
        <div
          onClick={() => setActiveTab('categories')}
          className="bg-white p-3.5 rounded-2xl border border-purple-200 shadow-xs bg-purple-50/20 cursor-pointer hover:bg-purple-50/50 transition group"
        >
          <div className="flex items-center justify-between text-purple-800 mb-1">
            <span className="text-[11px] font-bold uppercase">Scaffolding</span>
            <Layers className="w-4 h-4 text-purple-600 group-hover:scale-110 transition" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-extrabold text-purple-800">{scaffoldingCount}</div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800">
              {getCategoryComplaintCount('scaffold')} Complaints
            </span>
          </div>
          <div className="text-[10px] text-purple-600 mt-1 flex items-center justify-between">
            <span>Staging & platforms</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>

        {/* 12. Other Works */}
        <div
          onClick={() => setActiveTab('categories')}
          className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs cursor-pointer hover:bg-slate-50 transition group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase">Other Trades</span>
            <Briefcase className="w-4 h-4 text-slate-600 group-hover:scale-110 transition" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-extrabold text-slate-800">{otherCount}</div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
              {getCategoryComplaintCount('plumb') + getCategoryComplaintCount('civil')} Complaints
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Plumbing & upkeep</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* Main Grid: Today's Attendance Table & Location/Monthly summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Today's Attendance & Worklog Records */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Attendance Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm md:text-base">
                  Today's Attendance Roll ({selectedDate})
                </h3>
                <p className="text-xs text-slate-500">
                  {todayAttendance.length} records entered for this date
                </p>
              </div>
              <button
                onClick={() => setActiveTab('attendance_entry')}
                className="text-xs font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1"
              >
                <span>Add Record</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {todayAttendance.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No attendance records entered for {selectedDate}.
                <div className="mt-3">
                  <button
                    onClick={() => setActiveTab('attendance_entry')}
                    className="px-4 py-2 bg-amber-600 text-white rounded-xl font-semibold text-xs"
                  >
                    Enter Today's Attendance
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Staff ID</th>
                      <th className="py-2.5 px-3">Worker Name</th>
                      <th className="py-2.5 px-3">Designation</th>
                      <th className="py-2.5 px-3">Location (FN / AN)</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Wage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {todayAttendance.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-700">
                          {rec.staffId}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {rec.workerName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{rec.designation}</td>
                        <td className="py-2.5 px-3 text-slate-700">
                          <span className="font-medium text-slate-900">{rec.workPlaceFN}</span>
                          {rec.workPlaceAN && rec.workPlaceAN !== rec.workPlaceFN && (
                            <span className="text-slate-500"> / {rec.workPlaceAN}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              rec.attendanceFN === 'Present' && rec.attendanceAN === 'Present'
                                ? 'bg-emerald-100 text-emerald-800'
                                : rec.attendanceFN === 'Present' || rec.attendanceAN === 'Present'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {rec.attendanceFN === rec.attendanceAN
                              ? rec.attendanceFN
                              : `FN: ${rec.attendanceFN} | AN: ${rec.attendanceAN}`}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-900 font-mono">
                          ₹{rec.wage}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Today's Worklog Feed */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm md:text-base">
                  Today's Civil Worklog Details
                </h3>
                <p className="text-xs text-slate-500">
                  Full site activity logs without text truncation
                </p>
              </div>
              <button
                onClick={() => setActiveTab('worklog_entry')}
                className="text-xs font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1"
              >
                <span>Add Worklog</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {todayWorklogs.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                No dedicated worklog records yet for this date.
              </div>
            ) : (
              <div className="space-y-3">
                {todayWorklogs.map((wl) => (
                  <div
                    key={wl.id}
                    className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">{wl.workerName}</span>
                        <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded">
                          {wl.staffId}
                        </span>
                        <span className="text-[10px] text-slate-500">• {wl.designation}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {wl.workLocation}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed font-normal">
                      {wl.workDetails}
                    </p>
                    {wl.remarks && (
                      <div className="text-[10px] text-slate-400 mt-1 italic">
                        Note: {wl.remarks}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Location summary, Category summary & Monthly Payroll preview */}
        <div className="space-y-6">
          {/* Location-wise Manpower Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 text-sm">Site-wise Deployment</h3>
              <button
                onClick={() => setActiveTab('location_report')}
                className="text-[11px] font-semibold text-amber-700 hover:underline"
              >
                View all
              </button>
            </div>
            {locationBreakdown.length === 0 ? (
              <div className="text-xs text-slate-400 py-4 text-center">
                No location deployments recorded today.
              </div>
            ) : (
              <div className="space-y-2.5">
                {locationBreakdown.slice(0, 5).map((loc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="text-xs font-semibold text-slate-800">{loc.location}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-900">
                        {loc.workerCount} workers
                      </div>
                      <div className="text-[10px] text-slate-500">₹{loc.totalWage}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Monthly Payroll & Man-days preview */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-5 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                  Monthly Roll Summary
                </span>
                <h4 className="text-sm font-bold text-white mt-0.5">Month of {currentMonth}</h4>
              </div>
              <button
                onClick={() => setActiveTab('monthly_report')}
                className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
              >
                <span>Report</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="text-[10px] text-slate-400 font-medium">Total Wages (Month)</div>
                <div className="text-lg font-extrabold text-amber-400 mt-0.5">
                  ₹{monthlyTotalWages.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="text-[10px] text-slate-400 font-medium">Man-Days Worked</div>
                <div className="text-lg font-extrabold text-white mt-0.5">
                  {monthlyTotalManDays}
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-300 bg-white/5 p-3 rounded-xl border border-white/10 flex items-center justify-between">
              <span>Department Records:</span>
              <span className="font-semibold text-white">{monthAttendance.length} entries</span>
            </div>
          </div>

          {/* AI Helper Callout */}
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <div className="font-bold text-amber-900">Need specific civil analytics?</div>
                <p className="text-amber-800/90 mt-1 leading-snug">
                  Ask our AI Assistant questions like "Show all mason work at Ruby Hostel" or "Get today's manpower breakdown".
                </p>
                <button
                  onClick={() => setAiAssistantOpen(true)}
                  className="mt-2 font-bold text-amber-900 underline hover:text-amber-950 inline-flex items-center gap-1"
                >
                  Launch Civil AI Assistant &rarr;
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
