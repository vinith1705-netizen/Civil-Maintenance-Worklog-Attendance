import React, { useState, useMemo } from 'react';
import { Hammer, Printer, Download, Filter, Layers, Users, MapPin, Calendar } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AttendanceRecord } from '../../types';

export const MasonReportView: React.FC = () => {
  const { attendance, showToast } = useApp();

  const [groupBy, setGroupBy] = useState<'None' | 'Worker' | 'Location' | 'Date'>('None');
  const [filterLocation, setFilterLocation] = useState<string>('All');

  // Extract all records where Work Category = Mason Work or worker designation contains 'Mason'
  const masonRecords = useMemo(() => {
    return attendance
      .filter((a) => {
        const catMatch = a.workCategory?.toLowerCase().includes('mason');
        const desigMatch = a.designation?.toLowerCase().includes('mason');
        return catMatch || desigMatch;
      })
      .filter((a) => {
        if (filterLocation === 'All') return true;
        return a.workPlaceFN === filterLocation || a.workPlaceAN === filterLocation;
      })
      .sort((a, b) => (b.date > a.date ? 1 : -1));
  }, [attendance, filterLocation]);

  const totalMasonCount = masonRecords.length;
  const totalMasonWages = masonRecords.reduce((sum, r) => sum + (r.wage || 0), 0);

  // Unique locations in mason work
  const masonLocations = useMemo(() => {
    const set = new Set<string>();
    masonRecords.forEach((r) => {
      if (r.workPlaceFN) set.add(r.workPlaceFN);
      if (r.workPlaceAN) set.add(r.workPlaceAN);
    });
    return Array.from(set).sort();
  }, [masonRecords]);

  // Grouped records
  const groupedData = useMemo(() => {
    if (groupBy === 'None') return null;

    const map: Record<string, AttendanceRecord[]> = {};
    masonRecords.forEach((r) => {
      let key = '';
      if (groupBy === 'Worker') key = `${r.workerName} (${r.staffId})`;
      else if (groupBy === 'Location') key = r.workPlaceFN || r.workPlaceAN || 'Campus';
      else if (groupBy === 'Date') key = r.date;

      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return map;
  }, [masonRecords, groupBy]);

  const handleExportCSV = () => {
    const headers = ['Date', 'Worker', 'Staff ID', 'Designation', 'Location', 'Work Details FN', 'Work Details AN', 'Attendance', 'Wages'];
    const rows = masonRecords.map((r) => [
      r.date,
      `"${r.workerName}"`,
      `"${r.staffId}"`,
      `"${r.designation}"`,
      `"${r.workPlaceFN}"`,
      `"${(r.workDetailsFN || '').replace(/"/g, '""')}"`,
      `"${(r.workDetailsAN || '').replace(/"/g, '""')}"`,
      `"${r.attendanceFN}"`,
      r.wage,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BIT_Mason_Work_Summary_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', 'Mason Work Summary exported to CSV.');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-orange-950 via-amber-900 to-slate-900 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300 mb-1">
            <Hammer className="w-4 h-4" /> Core Structural Trade Analysis
          </div>
          <h2 className="text-xl md:text-2xl font-black tracking-tight">Mason Work Summary</h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Specialized auditing for brick masonry, plastering, tile-laying, concrete curbs, and mortar repairs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/10 text-center">
            <span className="text-[10px] text-amber-200 uppercase font-bold block">Total Mason Works</span>
            <div className="text-2xl font-black text-white">{totalMasonCount}</div>
          </div>
          <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/10 text-center">
            <span className="text-[10px] text-amber-200 uppercase font-bold block">Cumulative Wages</span>
            <div className="text-2xl font-black text-amber-300 font-mono">₹{totalMasonWages.toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>

      {/* Filter and Grouping Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600">Group By:</span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-medium"
            >
              <option value="None">None (Flat Table)</option>
              <option value="Worker">Group by Worker</option>
              <option value="Location">Group by Location</option>
              <option value="Date">Group by Date</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600">Location Filter:</span>
            <select
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-medium"
            >
              <option value="All">All Locations ({masonLocations.length})</option>
              {masonLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/30"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Render Table or Grouped Sections */}
      {groupBy === 'None' ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px]">
                <tr>
                  <th className="py-3 px-3.5">Date</th>
                  <th className="py-3 px-3.5">Worker</th>
                  <th className="py-3 px-3.5">Designation</th>
                  <th className="py-3 px-3.5">Location</th>
                  <th className="py-3 px-3.5 min-w-[280px]">Work Details</th>
                  <th className="py-3 px-3.5">Attendance</th>
                  <th className="py-3 px-3.5 text-right">Wages</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {masonRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-3.5 font-mono font-semibold text-slate-700 whitespace-nowrap">
                      {r.date}
                    </td>
                    <td className="py-2.5 px-3.5 font-bold text-slate-900 whitespace-nowrap">
                      {r.workerName}
                      <span className="block text-[10px] font-mono text-slate-400 font-normal">
                        {r.staffId}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-600 whitespace-nowrap">{r.designation}</td>
                    <td className="py-2.5 px-3.5 font-medium text-slate-800 whitespace-nowrap">
                      {r.workPlaceFN}
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-700 leading-snug">
                      <div className="mb-0.5">{r.workDetailsFN}</div>
                      {r.workDetailsAN && r.workDetailsAN !== r.workDetailsFN && (
                        <div className="text-[11px] text-slate-500">AN: {r.workDetailsAN}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {r.attendanceFN}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                      ₹{r.wage}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedData &&
            Object.entries(groupedData).map(([groupTitle, records]) => {
              const subtotalWage = records.reduce((s, rec) => s + (rec.wage || 0), 0);
              return (
                <div key={groupTitle} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                  <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                      <h3 className="font-bold text-sm text-slate-900">{groupTitle}</h3>
                      <span className="text-xs text-slate-500 font-medium">({records.length} tasks)</span>
                    </div>
                    <div className="text-xs font-mono font-bold text-slate-900">
                      Subtotal: ₹{subtotalWage}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <tbody className="divide-y divide-slate-100">
                        {records.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-4 font-mono font-semibold text-slate-700 w-28">
                              {r.date}
                            </td>
                            <td className="py-2.5 px-4 font-bold text-slate-900 w-48 truncate">
                              {r.workerName}
                            </td>
                            <td className="py-2.5 px-4 text-slate-600 w-36">{r.workPlaceFN}</td>
                            <td className="py-2.5 px-4 text-slate-700 leading-snug">{r.workDetailsFN}</td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700 w-20">
                              ₹{r.wage}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};
