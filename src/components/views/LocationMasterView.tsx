import React, { useState } from 'react';
import { MapPin, Plus, Search, Building, CheckCircle, Edit2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { LocationRecord } from '../../types';

export const LocationMasterView: React.FC = () => {
  const { locations, addLocation, updateLocation, attendance, showToast } = useApp();

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState<LocationRecord | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<LocationRecord['category']>('Hostel');
  const [inCharge, setInCharge] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');

  const openAdd = () => {
    setEditingLoc(null);
    setName('');
    setCategory('Hostel');
    setInCharge('');
    setStatus('Active');
    setModalOpen(true);
  };

  const openEdit = (loc: LocationRecord) => {
    setEditingLoc(loc);
    setName(loc.name);
    setCategory(loc.category);
    setInCharge(loc.inCharge || '');
    setStatus(loc.status);
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('error', 'Location Name is required.');
      return;
    }

    if (editingLoc) {
      updateLocation({
        ...editingLoc,
        name,
        category,
        inCharge,
        status,
      });
    } else {
      addLocation({
        name,
        category,
        inCharge,
        status,
      });
    }
    setModalOpen(false);
  };

  // Activity counts per location
  const getLocationActivityCount = (locName: string) => {
    return attendance.filter((a) => a.workPlaceFN === locName || a.workPlaceAN === locName).length;
  };

  const filteredLocations = locations.filter((l) => {
    const matchesSearch = l.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = filterCategory === 'All' || l.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold uppercase tracking-wider">
            Site Infrastructure
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-1">Campus Work Locations Master</h2>
          <p className="text-xs text-slate-500">
            Hostels, Academic departments, Research labs, residential quarters, and technical workshops across campus.
          </p>
        </div>

        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/30 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Location</span>
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search location by name (e.g. Ruby, Ganga, Quarters)..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium"
        >
          <option value="All">All Categories</option>
          <option value="Hostel">Hostel</option>
          <option value="Academic">Academic</option>
          <option value="Infrastructure">Infrastructure</option>
          <option value="Workshop">Workshop</option>
          <option value="Residential">Residential</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredLocations.map((loc) => {
          const actCount = getLocationActivityCount(loc.name);
          return (
            <div
              key={loc.id}
              className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:border-amber-400 hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                    {loc.category}
                  </span>
                  <button
                    onClick={() => openEdit(loc)}
                    className="p-1 text-slate-400 hover:text-amber-600 rounded"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <h3 className="font-bold text-sm text-slate-900 mb-1">{loc.name}</h3>
                <div className="text-[11px] text-slate-500">In-Charge: {loc.inCharge || 'Department Admin'}</div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">{actCount} recorded logs</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="Active Site" />
              </div>
            </div>
          );
        })}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 mb-3">
              {editingLoc ? 'Edit Campus Location' : 'Add New Campus Location'}
            </h3>
            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Location Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Amber Hostel"
                  required
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                >
                  <option value="Hostel">Hostel</option>
                  <option value="Academic">Academic</option>
                  <option value="Infrastructure">Infrastructure</option>
                  <option value="Workshop">Workshop</option>
                  <option value="Residential">Residential</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">In-Charge / Officer</label>
                <input
                  type="text"
                  value={inCharge}
                  onChange={(e) => setInCharge(e.target.value)}
                  placeholder="e.g. Warden Office, Estate Manager"
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold"
                >
                  Save Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
