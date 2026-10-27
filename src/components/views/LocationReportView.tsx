import React, { useState, useMemo } from 'react';
import {
  MapPin,
  Users,
  Hammer,
  Wrench,
  Paintbrush,
  Flame,
  Layers,
  Truck,
  Briefcase,
  Printer,
  ChevronRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const LocationReportView: React.FC = () => {
  const { locations, attendance } = useApp();

  const [selectedLocation, setSelectedLocation] = useState<string>(locations[0]?.name || 'Ruby Hostel');

  // Filter records for selected location
  const locationRecords = useMemo(() => {
    return attendance
      .filter((a) => a.workPlaceFN === selectedLocation || a.workPlaceAN === selectedLocation)
      .sort((a, b) => (b.date > a.date ? 1 : -1));
  }, [attendance, selectedLocation]);

  // Unique workers deployed
  const uniqueWorkers = useMemo(() => {
    const workerMap = new Map<string, { staffId: string; name: string; designation: string }>();
    locationRecords.forEach((r) => {
      if (!workerMap.has(r.staffId)) {
        workerMap.set(r.staffId, {
          staffId: r.staffId,
          name: r.workerName,
          designation: r.designation,
        });
      }
    });
    return Array.from(workerMap.values());
  }, [locationRecords]);

  // Trade breakdowns
  const getTradeCount = (keyword: string) => {
    return locationRecords.filter((r) => {
      const matchCat = r.workCategory?.toLowerCase().includes(keyword.toLowerCase());
      const matchDes = r.designation?.toLowerCase().includes(keyword.toLowerCase());
      const matchFN = r.workDetailsFN?.toLowerCase().includes(keyword.toLowerCase());
      const matchAN = r.workDetailsAN?.toLowerCase().includes(keyword.toLowerCase());
      return matchCat || matchDes || matchFN || matchAN;
    }).length;
  };

  const masonCount = getTradeCount('mason');
  const carpenterCount = getTradeCount('carpent');
  const paintingCount = getTradeCount('paint') + getTradeCount('polish');
  const weldingCount = getTradeCount('weld');
  const scaffoldingCount = getTradeCount('scaffold');
  const shiftingCount = getTradeCount('shifting') + getTradeCount('material');
  const otherCount = Math.max(
    0,
    locationRecords.length - (masonCount + carpenterCount + paintingCount + weldingCount + scaffoldingCount + shiftingCount)
  );

  const totalExpenditure = locationRecords.reduce((sum, r) => sum + (r.wage || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Location Selector */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
            Site Progress Analytics
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-1">Location-Wise Work & Deployment Report</h2>
          <p className="text-xs text-slate-500">
            Track labour deployment, trade counts, and full activity logs per hostel, academic block, or campus facility.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex-1 md:w-64">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Campus Site</label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.name}>
                  {loc.name} ({loc.category})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => window.print()}
            className="self-end px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Location Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white rounded-2xl p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-600 flex items-center justify-center font-bold text-lg shadow-md">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black">{selectedLocation}</h3>
                <span className="text-[10px] uppercase font-bold bg-white/10 px-2 py-0.5 rounded text-amber-300">
                  {locations.find((l) => l.name === selectedLocation)?.category || 'Facility'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Total Maintenance Man-Days: <strong className="text-white">{locationRecords.length}</strong>
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase text-slate-400 font-semibold">Total Labour Expenditure</span>
            <div className="text-2xl font-black text-amber-400 font-mono">
              ₹{totalExpenditure.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* 8 Trade Stat Blocks */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 pt-5 text-center">
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Workers</span>
            <div className="text-lg font-bold text-white mt-0.5">{uniqueWorkers.length}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20">
            <span className="text-[10px] text-orange-300 uppercase font-semibold block">Mason Work</span>
            <div className="text-lg font-bold text-orange-400 mt-0.5">{masonCount}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-lime-500/10 border border-lime-500/20">
            <span className="text-[10px] text-lime-300 uppercase font-semibold block">Carpenter</span>
            <div className="text-lg font-bold text-lime-400 mt-0.5">{carpenterCount}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
            <span className="text-[10px] text-cyan-300 uppercase font-semibold block">Painting</span>
            <div className="text-lg font-bold text-cyan-400 mt-0.5">{paintingCount}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
            <span className="text-[10px] text-red-300 uppercase font-semibold block">Welding</span>
            <div className="text-lg font-bold text-red-400 mt-0.5">{weldingCount}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <span className="text-[10px] text-purple-300 uppercase font-semibold block">Scaffolding</span>
            <div className="text-lg font-bold text-purple-400 mt-0.5">{scaffoldingCount}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <span className="text-[10px] text-yellow-300 uppercase font-semibold block">Shifting</span>
            <div className="text-lg font-bold text-yellow-400 mt-0.5">{shiftingCount}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-500/10 border border-slate-500/20">
            <span className="text-[10px] text-slate-300 uppercase font-semibold block">Other Works</span>
            <div className="text-lg font-bold text-slate-300 mt-0.5">{otherCount}</div>
          </div>
        </div>
      </div>

      {/* Complete Work Descriptions List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">
            Complete Civil Maintenance Descriptions for {selectedLocation}
          </h3>
          <span className="text-xs text-slate-500 font-mono">{locationRecords.length} records</span>
        </div>

        {locationRecords.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No maintenance records currently recorded for {selectedLocation}.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {locationRecords.map((rec) => (
              <div key={rec.id} className="p-4 hover:bg-slate-50/80 transition space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-800">{rec.date}</span>
                    <span className="text-xs font-semibold text-slate-900">• {rec.workerName}</span>
                    <span className="font-mono text-[10px] bg-slate-100 px-1.5 rounded">{rec.staffId}</span>
                    <span className="text-[11px] text-slate-500">({rec.designation})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                      {rec.workCategory}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-900">₹{rec.wage}</span>
                  </div>
                </div>

                <div className="text-xs text-slate-700 leading-relaxed font-normal bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                  <div className="mb-1">
                    <strong className="text-slate-900 font-semibold">Forenoon (FN):</strong> {rec.workDetailsFN}
                  </div>
                  {rec.workDetailsAN && (
                    <div>
                      <strong className="text-slate-900 font-semibold">Afternoon (AN):</strong> {rec.workDetailsAN}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
