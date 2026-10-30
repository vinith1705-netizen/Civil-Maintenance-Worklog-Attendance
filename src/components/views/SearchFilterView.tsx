import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  Download,
  Calendar,
  X,
  RotateCcw,
  Printer,
  ChevronDown,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AttendanceRecord, AttendanceStatus } from '../../types';

export const SearchFilterView: React.FC = () => {
  const { attendance, workers, locations, categories, showToast } = useApp();

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [staffIdFilter, setStaffIdFilter] = useState('');
  const [workerNameFilter, setWorkerNameFilter] = useState('');
  const [designationFilter, setDesignationFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [attendanceFilter, setAttendanceFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Sorting
  const [sortField, setSortField] = useState<keyof AttendanceRecord>('date');
  const [sortAsc, setSortAsc] = useState(false);

  // Filter application
  const filteredRecords = useMemo(() => {
    return attendance.filter((rec) => {
      if (dateFrom && rec.date < dateFrom) return false;
      if (dateTo && rec.date > dateTo) return false;
      if (staffIdFilter && !rec.staffId.toLowerCase().includes(staffIdFilter.toLowerCase())) return false;
      if (workerNameFilter && !rec.workerName.toLowerCase().includes(workerNameFilter.toLowerCase())) return false;
      if (designationFilter !== 'All' && rec.designation !== designationFilter) return false;
      if (categoryFilter !== 'All' && rec.workCategory !== categoryFilter) return false;
      if (locationFilter !== 'All') {
        const matchesLoc = rec.workPlaceFN === locationFilter || rec.workPlaceAN === locationFilter;
        if (!matchesLoc) return false;
      }
      if (attendanceFilter !== 'All') {
        const matchesAtt = rec.attendanceFN === attendanceFilter || rec.attendanceAN === attendanceFilter;
        if (!matchesAtt) return false;
      }
      if (statusFilter !== 'All' && rec.status !== statusFilter) return false;
      return true;
    });
  }, [
    attendance,
    dateFrom,
    dateTo,
    staffIdFilter,
    workerNameFilter,
    designationFilter,
    categoryFilter,
    locationFilter,
    attendanceFilter,
    statusFilter,
  ]);

  // Sorted records
  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      const valA = a[sortField] || '';
      const valB = b[sortField] || '';
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredRecords, sortField, sortAsc]);

  const handleSort = (field: keyof AttendanceRecord) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleResetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setStaffIdFilter('');
    setWorkerNameFilter('');
    setDesignationFilter('All');
    setCategoryFilter('All');
    setLocationFilter('All');
    setAttendanceFilter('All');
    setStatusFilter('All');
  };

  // Distinct designations for filter dropdown
  const uniqueDesignations = useMemo(() => {
    const set = new Set(workers.map((w) => w.designation));
    return Array.from(set).sort();
  }, [workers]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Date',
      'Staff ID',
      'Worker',
      'Designation',
      'Work Place FN',
      'Work Place AN',
      'Work Category',
      'Work Details FN',
      'Work Details AN',
      'Attendance FN',
      'Attendance AN',
      'Wages',
    ];

    const rows = sortedRecords.map((r) => [
      r.date,
      `"${r.staffId}"`,
      `"${r.workerName}"`,
      `"${r.designation}"`,
      `"${r.workPlaceFN}"`,
      `"${r.workPlaceAN}"`,
      `"${r.workCategory}"`,
      `"${(r.workDetailsFN || '').replace(/"/g, '""')}"`,
      `"${(r.workDetailsAN || '').replace(/"/g, '""')}"`,
      r.attendanceFN,
      r.attendanceAN,
      r.wage,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BIT_Civil_Worklog_Search_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', `Exported ${sortedRecords.length} records.`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold uppercase tracking-wider">
            Query Engine
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-1">Multi-Filter Worklog & Attendance Search</h2>
          <p className="text-xs text-slate-500">
            Query across historical attendance dates, worker staff IDs, trade categories, locations, and wage brackets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print View</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/30"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Matrix */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wide">
            <Filter className="w-4 h-4 text-amber-600" />
            <span>Search Filters</span>
          </div>
          <button
            onClick={handleResetFilters}
            className="text-xs text-slate-500 hover:text-amber-600 flex items-center gap-1 font-medium"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
          {/* Date From */}
          <div>
            <label className="block font-semibold text-slate-600 mb-1">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-xl"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block font-semibold text-slate-600 mb-1">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-xl"
            />
          </div>

          {/* Staff ID */}
          <div>
            <label className="block font-semibold text-slate-600 mb-1">Staff ID</label>
            <input
              type="text"
              value={staffIdFilter}
              onChange={(e) => setStaffIdFilter(e.target.value)}
              placeholder="e.g. CM41001"
              className="w-full p-2 border border-slate-300 rounded-xl font-mono"
            />
          </div>

          {/* Worker Name */}
          <div>
            <label className="block font-semibold text-slate-600 mb-1">Worker Name</label>
            <input
              type="text"
              value={workerNameFilter}
              onChange={(e) => setWorkerNameFilter(e.target.value)}
              placeholder="e.g. Muruganantham"
              className="w-full p-2 border border-slate-300 rounded-xl"
            />
          </div>

          {/* Designation */}
          <div>
            <label className="block font-semibold text-slate-600 mb-1">Designation</label>
            <select
              value={designationFilter}
              onChange={(e) => setDesignationFilter(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-xl"
            >
              <option value="All">All Designations</option>
              {uniqueDesignations.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="block font-semibold text-slate-600 mb-1">Work Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-xl"
            >
              <option value="All">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="block font-semibold text-slate-600 mb-1">Work Location</label>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-xl"
            >
              <option value="All">All Locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.name}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          {/* Attendance */}
          <div>
            <label className="block font-semibold text-slate-600 mb-1">Attendance Status</label>
            <select
              value={attendanceFilter}
              onChange={(e) => setAttendanceFilter(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-xl"
            >
              <option value="All">All Statuses</option>
              <option value="Present">Present</option>
              <option value="Absent">Absent</option>
              <option value="Leave">Leave</option>
              <option value="Permission">Permission</option>
              <option value="Holiday">Holiday</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Count & Sort bar */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <div>
          Showing <span className="font-bold text-slate-900">{sortedRecords.length}</span> matching work records
        </div>
        <div>
          Sorted by <span className="font-semibold text-slate-800">{String(sortField)}</span> (
          {sortAsc ? 'Ascending' : 'Descending'})
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-bold text-[10px]">
              <tr>
                <th
                  onClick={() => handleSort('date')}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Date</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('staffId')}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Staff ID</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('workerName')}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Worker</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('designation')}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Designation</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('workPlaceFN')}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Work Place</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('workCategory')}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Work Category</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-3 min-w-[260px]">Work Details</th>
                <th className="py-3 px-3 whitespace-nowrap">Attendance</th>
                <th
                  onClick={() => handleSort('wage')}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-100 transition whitespace-nowrap"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Wages</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400 text-xs">
                    No records match the selected filters.
                  </td>
                </tr>
              ) : (
                sortedRecords.map((r, rIdx) => (
                  <tr key={`${r.id || r.staffId}-${r.date}-${rIdx}`} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-700 whitespace-nowrap">
                      {r.date}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {r.staffId}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-900 whitespace-nowrap">
                      {r.workerName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{r.designation}</td>
                    <td className="py-2.5 px-3 text-slate-800 whitespace-nowrap">
                      <span className="font-semibold text-slate-900">{r.workPlaceFN}</span>
                      {r.workPlaceAN && r.workPlaceAN !== r.workPlaceFN && (
                        <span className="text-slate-500"> / {r.workPlaceAN}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{r.workCategory}</td>
                    <td className="py-2.5 px-3 text-slate-700 max-w-sm">
                      <div className="leading-snug line-clamp-2" title={`FN: ${r.workDetailsFN} | AN: ${r.workDetailsAN}`}>
                        <span className="font-medium text-slate-900">FN:</span> {r.workDetailsFN}
                        {r.workDetailsAN && r.workDetailsAN !== r.workDetailsFN && (
                          <>
                            <span className="font-medium text-slate-900 ml-1.5">AN:</span> {r.workDetailsAN}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.attendanceFN === 'Present' && r.attendanceAN === 'Present'
                            ? 'bg-emerald-100 text-emerald-800'
                            : r.attendanceFN === 'Present' || r.attendanceAN === 'Present'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {r.attendanceFN === r.attendanceAN ? r.attendanceFN : `${r.attendanceFN}/${r.attendanceAN}`}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      ₹{r.wage}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
