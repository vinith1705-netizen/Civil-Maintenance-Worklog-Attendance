import React, { useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Edit2,
  CheckCircle,
  XCircle,
  FileSpreadsheet,
  Download,
  Filter,
  ShieldAlert,
  RefreshCw,
  ExternalLink,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { WorkerRecord, WorkerStatus } from '../../types';

export const WorkerMasterView: React.FC = () => {
  const {
    workers,
    addWorker,
    updateWorker,
    toggleWorkerStatus,
    categories,
    showToast,
    settings,
    currentUser,
    handleGoogleLogin,
    isUpdatingLabour,
    updateLabourToGoogleSheet,
    importLabourFromGoogleSheet,
    setActiveTab,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<WorkerRecord | null>(null);
  const [syncToSheetOnSave, setSyncToSheetOnSave] = useState(true);

  // Form state
  const [eId, setEId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('Mason');
  const [category, setCategory] = useState('Mason Work');
  const [perDayWage, setPerDayWage] = useState(850);
  const [status, setStatus] = useState<WorkerStatus>('Active');
  const [joiningDate, setJoiningDate] = useState('2022-01-01');
  const [remarks, setRemarks] = useState('');

  const openAddModal = () => {
    setEditingWorker(null);
    const nextNum = workers.length + 1;
    const autoId = `CM410${String(nextNum).padStart(2, '0')}`;
    setEId(autoId);
    setStaffId(autoId);
    setName('');
    setDesignation('Mason');
    setCategory('Mason Work');
    setPerDayWage(850);
    setStatus('Active');
    setJoiningDate(new Date().toISOString().slice(0, 10));
    setRemarks('');
    setSyncToSheetOnSave(Boolean(settings.spreadsheetId));
    setModalOpen(true);
  };

  const openEditModal = (w: WorkerRecord) => {
    setEditingWorker(w);
    setEId(w.eId);
    setStaffId(w.staffId);
    setName(w.name);
    setDesignation(w.designation);
    setCategory(w.category);
    setPerDayWage(w.perDayWage);
    setStatus(w.status);
    setJoiningDate(w.joiningDate);
    setRemarks(w.remarks);
    setSyncToSheetOnSave(Boolean(settings.spreadsheetId));
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffId.trim() || !name.trim()) {
      showToast('error', 'Staff ID and Worker Name are required.');
      return;
    }

    if (editingWorker) {
      updateWorker({
        ...editingWorker,
        eId,
        staffId,
        name,
        designation,
        category,
        perDayWage: Number(perDayWage),
        status,
        joiningDate,
        remarks,
      });
    } else {
      addWorker({
        eId: eId || staffId,
        staffId,
        name,
        designation,
        category,
        perDayWage: Number(perDayWage),
        status,
        joiningDate,
        remarks,
      });
    }

    setModalOpen(false);

    if (syncToSheetOnSave && settings.spreadsheetId) {
      try {
        await updateLabourToGoogleSheet();
      } catch (err: any) {
        console.warn('Post-save labour sync warning:', err);
      }
    }
  };

  // Direct Update Labour to Google Sheet
  const handleUpdateLabourToGoogleSheet = async () => {
    try {
      await updateLabourToGoogleSheet();
    } catch (err: any) {
      // Toast is already triggered in context
    }
  };

  // Direct Import Labour from Google Sheet
  const handleImportLabourFromGoogleSheet = async () => {
    try {
      await importLabourFromGoogleSheet();
    } catch (err: any) {
      // Toast is already triggered in context
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['S.No', 'E.ID', 'Staff ID', 'Worker Name', 'Designation', 'Category', 'Per Day Wage', 'Status', 'Joining Date', 'Remarks'];
    const rows = workers.map((w, i) => [
      i + 1,
      `"${w.eId}"`,
      `"${w.staffId}"`,
      `"${w.name}"`,
      `"${w.designation}"`,
      `"${w.category}"`,
      w.perDayWage,
      w.status,
      w.joiningDate,
      `"${w.remarks}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BIT_Civil_Worker_Master_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', 'Exported Worker Master CSV.');
  };

  const filteredWorkers = workers.filter((w) => {
    const matchesSearch =
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.staffId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.designation.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || w.status === statusFilter;
    const matchesCategory = categoryFilter === 'All' || w.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
              Department Master
            </span>
            <span className="text-xs text-slate-500 font-semibold">{workers.length} Total Workers</span>
            {settings.spreadsheetId && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" />
                Sheet Linked
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-1">Worker Master Directory</h2>
          <p className="text-xs text-slate-500">
            Registered civil labour roster with skill trade designations, daily wage scales, and Google Sheets synchronization.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* PROMINENT GOOGLE SHEET LABOUR UPDATE BUTTON */}
          <button
            type="button"
            onClick={handleUpdateLabourToGoogleSheet}
            disabled={isUpdatingLabour}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1b7a54] hover:bg-[#16654a] text-white text-xs font-bold shadow-md shadow-emerald-950/20 transition cursor-pointer disabled:opacity-50"
            title="Publish and update all labour records to Google Sheet 'Workers' tab"
          >
            {isUpdatingLabour ? (
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-200" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
            )}
            <span>{isUpdatingLabour ? 'Updating Sheet...' : 'Update Labour to Google Sheet'}</span>
            <span className="ml-0.5 px-1.5 py-0.2 text-[10px] bg-emerald-900/40 rounded-full font-mono">
              {workers.length}
            </span>
          </button>

          {/* IMPORT LABOUR FROM GOOGLE SHEET */}
          <button
            type="button"
            onClick={handleImportLabourFromGoogleSheet}
            disabled={isUpdatingLabour}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 transition cursor-pointer disabled:opacity-50"
            title="Import or refresh labour details from Google Sheet"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isUpdatingLabour ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Import from Sheet</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/30 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Worker</span>
          </button>
        </div>
      </div>

      {/* GOOGLE SHEETS LABOUR SYNC BANNER */}
      {settings.spreadsheetId ? (
        <div className="p-3.5 bg-emerald-50/90 rounded-2xl border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <div className="font-bold text-slate-900 flex items-center gap-2">
                <span>Google Sheet Labour Sync Active</span>
                <span className="text-[10px] font-mono font-bold bg-white text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">
                  Tab: {settings.workerSheetName || 'Workers'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Target Sheet ID: <span className="font-mono font-medium text-slate-800">{settings.spreadsheetId}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <a
              href={settings.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${settings.spreadsheetId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-100/50 rounded-xl text-emerald-800 font-bold transition"
            >
              <span>View Sheet</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              onClick={handleUpdateLabourToGoogleSheet}
              disabled={isUpdatingLabour}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Push All Labours Now</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">Google Spreadsheet Not Yet Connected for Labours</span>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Sign in and configure your Google Spreadsheet in Settings to enable real-time 2-way sync with the Workers sheet.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs transition shrink-0"
          >
            Configure Sheet Settings →
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search worker by Staff ID, Name, or Designation..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active Only</option>
            <option value="Inactive">Inactive Only</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium"
          >
            <option value="All">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Worker Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px]">
              <tr>
                <th className="py-3 px-3.5">S.No</th>
                <th className="py-3 px-3.5">Staff ID / E.ID</th>
                <th className="py-3 px-3.5">Worker Name</th>
                <th className="py-3 px-3.5">Designation</th>
                <th className="py-3 px-3.5">Work Category</th>
                <th className="py-3 px-3.5">Per Day Wage</th>
                <th className="py-3 px-3.5">Status</th>
                <th className="py-3 px-3.5">Joining Date</th>
                <th className="py-3 px-3.5">Remarks</th>
                <th className="py-3 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredWorkers.map((w, idx) => (
                <tr key={w.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-2.5 px-3.5 text-slate-400 font-mono">{idx + 1}</td>
                  <td className="py-2.5 px-3.5 font-mono font-bold text-slate-700">{w.staffId}</td>
                  <td className="py-2.5 px-3.5 font-semibold text-slate-900">{w.name}</td>
                  <td className="py-2.5 px-3.5">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-medium">
                      {w.designation}
                    </span>
                  </td>
                  <td className="py-2.5 px-3.5 text-slate-600">{w.category}</td>
                  <td className="py-2.5 px-3.5 font-mono font-bold text-emerald-700">₹{w.perDayWage}</td>
                  <td className="py-2.5 px-3.5">
                    <button
                      onClick={() => toggleWorkerStatus(w.id)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition ${
                        w.status === 'Active'
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                      title="Click to toggle status (historical attendance preserved)"
                    >
                      {w.status}
                    </button>
                  </td>
                  <td className="py-2.5 px-3.5 text-slate-500 font-mono text-[11px]">{w.joiningDate}</td>
                  <td className="py-2.5 px-3.5 text-slate-500 max-w-[160px] truncate">{w.remarks || '-'}</td>
                  <td className="py-2.5 px-3.5 text-right">
                    <button
                      onClick={() => openEditModal(w)}
                      className="p-1 text-slate-500 hover:text-amber-600 hover:bg-slate-100 rounded transition"
                      title="Edit Worker details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Worker Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {editingWorker ? 'Edit Worker Record' : 'Register New Worker'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Changes to standard wage will apply only to future attendance entries. Historical wage logs remain preserved.
            </p>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Staff ID</label>
                  <input
                    type="text"
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                    required
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">E.ID (Optional)</label>
                  <input
                    type="text"
                    value={eId}
                    onChange={(e) => setEId(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Worker Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Mr. BAGAVATHI MURUGANANTHAM"
                  required
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Designation</label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Mason, Welder, Helper..."
                    required
                    className="w-full p-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Work Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Per Day Wages (₹)</label>
                  <input
                    type="number"
                    value={perDayWage}
                    onChange={(e) => setPerDayWage(Number(e.target.value))}
                    required
                    min={0}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as WorkerStatus)}
                    className="w-full p-2 border border-slate-300 rounded-xl"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Joining Date</label>
                <input
                  type="date"
                  value={joiningDate}
                  onChange={(e) => setJoiningDate(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Remarks</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Specialization, tools assigned, etc."
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>

              {settings.spreadsheetId && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="syncToSheetCheckbox"
                      checked={syncToSheetOnSave}
                      onChange={(e) => setSyncToSheetOnSave(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor="syncToSheetCheckbox" className="font-semibold text-slate-800 text-xs cursor-pointer">
                      Update directly to Google Sheet 'Workers' tab
                    </label>
                  </div>
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-semibold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingLabour}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-md shadow-amber-600/30 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isUpdatingLabour ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                  <span>{editingWorker ? 'Update Worker' : 'Save New Worker'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
