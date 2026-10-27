import React, { useState, useMemo } from 'react';
import {
  Tag,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Wrench,
  Search,
  Filter,
  Check,
  ChevronRight,
  Layers,
  Hammer,
  Paintbrush,
  FileText,
  BarChart3,
  MapPin,
  User,
  ShieldCheck,
  FolderOpen,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { WorkCategoryRecord, ComplaintRecord } from '../../types';
import { getTodayDateString } from '../../data/seedData';

export const CategoryMasterView: React.FC = () => {
  const {
    categories,
    addCategory,
    complaints,
    addComplaint,
    updateComplaintStatus,
    workers,
    locations,
    attendance,
    showToast,
  } = useApp();

  // Active View Tab: 'categories' or 'complaints'
  const [activeTab, setActiveTab] = useState<'categories' | 'complaints'>('categories');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  const [complaintStatusFilter, setComplaintStatusFilter] = useState<string>('All');
  const [complaintSearch, setComplaintSearch] = useState<string>('');

  // Add Category Modal state
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [catDescription, setCatDescription] = useState('');
  const [catColor, setCatColor] = useState('#f97316');

  // Log Complaint Modal state
  const [compModalOpen, setCompModalOpen] = useState(false);
  const [compCategory, setCompCategory] = useState(categories[0]?.name || 'Mason Work');
  const [compLocation, setCompLocation] = useState(locations[0]?.name || 'Ruby Hostel');
  const [compDescription, setCompDescription] = useState('');
  const [compPriority, setCompPriority] = useState<'High' | 'Medium' | 'Low'>('High');
  const [compAssignedWorker, setCompAssignedWorker] = useState('');

  // Handle Save New Category
  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) {
      showToast('error', 'Category name is required.');
      return;
    }
    addCategory({
      name: catName,
      description: catDescription,
      color: catColor,
      complaintCount: 0,
      pendingComplaints: 0,
      resolvedComplaints: 0,
    });
    setCatModalOpen(false);
    setCatName('');
    setCatDescription('');
  };

  // Handle Save New Complaint
  const handleSaveComplaint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!compDescription.trim()) {
      showToast('error', 'Complaint description is required.');
      return;
    }
    addComplaint({
      category: compCategory,
      location: compLocation,
      description: compDescription,
      priority: compPriority,
      status: 'Pending',
      reportedDate: getTodayDateString(),
      assignedWorker: compAssignedWorker || undefined,
    });
    setCompModalOpen(false);
    setCompDescription('');
  };

  // Open Log Complaint modal with pre-selected category
  const handleOpenLogComplaint = (categoryName: string) => {
    setCompCategory(categoryName);
    setCompModalOpen(true);
  };

  // Get active workers count for a category
  const getAssignedWorkersCount = (catName: string) => {
    return workers.filter((w) => {
      const wCat = (w.category || '').toLowerCase();
      const wDesig = (w.designation || '').toLowerCase();
      const target = catName.toLowerCase();
      return wCat.includes(target) || wDesig.includes(target) || target.includes(wCat) || target.includes(wDesig);
    }).length;
  };

  // Get dynamic complaint count from recorded complaints list or category baseline
  const getCategoryStats = (cat: WorkCategoryRecord) => {
    const listForCat = complaints.filter(
      (c) => c.category.toLowerCase() === cat.name.toLowerCase()
    );
    const dynamicCount = listForCat.length;
    const dynamicPending = listForCat.filter((c) => c.status !== 'Resolved').length;
    const dynamicResolved = listForCat.filter((c) => c.status === 'Resolved').length;

    const baseCount = cat.complaintCount || 0;
    const basePending = cat.pendingComplaints || 0;
    const baseResolved = cat.resolvedComplaints || 0;

    const totalCount = Math.max(baseCount, dynamicCount);
    const pendingCount = Math.max(basePending, dynamicPending);
    const resolvedCount = Math.max(baseResolved, dynamicResolved);

    return { totalCount, pendingCount, resolvedCount };
  };

  // Overall Totals
  const totalCategories = categories.length;
  const overallComplaintCount = categories.reduce((sum, c) => sum + getCategoryStats(c).totalCount, 0);
  const overallPendingCount = categories.reduce((sum, c) => sum + getCategoryStats(c).pendingCount, 0);
  const overallResolvedCount = categories.reduce((sum, c) => sum + getCategoryStats(c).resolvedCount, 0);
  const overallResolutionRate =
    overallComplaintCount > 0 ? Math.round((overallResolvedCount / overallComplaintCount) * 100) : 0;

  // Filtered complaints table
  const filteredComplaints = useMemo(() => {
    return complaints.filter((comp) => {
      const matchCat =
        selectedCategoryFilter === 'All' ||
        comp.category.toLowerCase() === selectedCategoryFilter.toLowerCase();
      const matchStatus =
        complaintStatusFilter === 'All' || comp.status === complaintStatusFilter;
      const matchSearch =
        comp.description.toLowerCase().includes(complaintSearch.toLowerCase()) ||
        comp.location.toLowerCase().includes(complaintSearch.toLowerCase()) ||
        comp.id.toLowerCase().includes(complaintSearch.toLowerCase()) ||
        (comp.assignedWorker || '').toLowerCase().includes(complaintSearch.toLowerCase());

      return matchCat && matchStatus && matchSearch;
    });
  }, [complaints, selectedCategoryFilter, complaintStatusFilter, complaintSearch]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold uppercase tracking-wider">
              Trade Classification & Maintenance Requests
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
              BIT Civil Dept
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            Work Categories & Complaint Count Registry
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Standard civil trade groups, complaint ticket volumes, pending maintenance requests, and trade labour deployment.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCompModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1b7a54] hover:bg-[#16654a] text-white text-xs font-bold shadow-md shadow-emerald-900/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Log Complaint</span>
          </button>
          <button
            onClick={() => setCatModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
          >
            <FolderOpen className="w-4 h-4 text-slate-500" />
            <span>Add Category</span>
          </button>
        </div>
      </div>

      {/* METRICS SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase">Work Categories</span>
            <Layers className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalCategories}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Civil engineering trades</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-xs bg-amber-50/20">
          <div className="flex items-center justify-between text-amber-800 mb-1">
            <span className="text-[11px] font-bold uppercase">Total Complaints</span>
            <FileText className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-800">{overallComplaintCount}</div>
          <div className="text-[10px] text-amber-700 mt-0.5">No. of complaints logged</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-200/80 shadow-xs bg-rose-50/20">
          <div className="flex items-center justify-between text-rose-800 mb-1">
            <span className="text-[11px] font-bold uppercase">Pending Requests</span>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-800">{overallPendingCount}</div>
          <div className="text-[10px] text-rose-600 mt-0.5">Open & In-Progress tickets</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-xs bg-emerald-50/20">
          <div className="flex items-center justify-between text-emerald-800 mb-1">
            <span className="text-[11px] font-bold uppercase">Resolved Rate</span>
            <ShieldCheck className="w-4 h-4 text-[#1b7a54]" />
          </div>
          <div className="text-2xl font-black text-[#1b7a54]">{overallResolutionRate}%</div>
          <div className="text-[10px] text-emerald-700 mt-0.5">
            {overallResolvedCount} of {overallComplaintCount} closed
          </div>
        </div>
      </div>

      {/* VIEW NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'categories'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Work Categories & Complaint Count Grid ({categories.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('complaints')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'complaints'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Complaints & Tickets Registry ({complaints.length})</span>
        </button>
      </div>

      {/* TAB 1: CATEGORIES GRID WITH PROMINENT COMPLAINT NO OF COUNT */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => {
            const { totalCount, pendingCount, resolvedCount } = getCategoryStats(cat);
            const workersCount = getAssignedWorkersCount(cat.name);
            const rate = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 100;

            return (
              <div
                key={cat.id}
                className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition flex flex-col justify-between"
              >
                <div>
                  {/* Category Header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: cat.color }}
                      />
                      <h3 className="font-bold text-sm text-slate-900">{cat.name}</h3>
                    </div>
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-black uppercase font-mono shadow-2xs"
                      style={{
                        backgroundColor: `${cat.color}18`,
                        color: cat.color,
                        border: `1px solid ${cat.color}40`,
                      }}
                    >
                      {cat.name.split(' ')[0]}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed font-normal min-h-[36px]">
                    {cat.description || 'Standard civil engineering maintenance and repair works.'}
                  </p>

                  {/* PROMINENT COMPLAINT COUNT BADGE */}
                  <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                        Complaint No. of Count:
                      </span>
                      <span className="text-sm font-black text-slate-900 bg-white px-2.5 py-0.5 rounded-lg border border-slate-300 shadow-2xs">
                        {totalCount} Total
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="flex items-center gap-1 text-rose-700 font-semibold text-[11px]">
                        <AlertCircle className="w-3 h-3 text-rose-600" />
                        <span>{pendingCount} Pending</span>
                      </span>
                      <span className="flex items-center gap-1 text-[#1b7a54] font-semibold text-[11px]">
                        <CheckCircle2 className="w-3 h-3 text-[#1b7a54]" />
                        <span>{resolvedCount} Resolved</span>
                      </span>
                    </div>

                    {/* Resolution Progress Bar */}
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#1b7a54] rounded-full transition-all duration-300"
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer with Labours assigned and quick action */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium flex items-center gap-1.5 text-[11px]">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{workersCount} Specialists</span>
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenLogComplaint(cat.name)}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-[11px] font-bold transition border border-amber-200 cursor-pointer"
                      title="Log a new complaint for this category"
                    >
                      + Ticket
                    </button>
                    <button
                      onClick={() => {
                        setSelectedCategoryFilter(cat.name);
                        setActiveTab('complaints');
                      }}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                      title="View all complaints under this category"
                    >
                      View ({totalCount})
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: DETAILED COMPLAINTS & TICKETS REGISTRY */}
      {activeTab === 'complaints' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4 p-4 sm:p-5">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={complaintSearch}
                  onChange={(e) => setComplaintSearch(e.target.value)}
                  placeholder="Search complaint description, location, ID..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 font-medium cursor-pointer"
              >
                <option value="All">All Categories ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={complaintStatusFilter}
                onChange={(e) => setComplaintStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 font-medium cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
              </select>
            </div>

            <button
              onClick={() => setCompModalOpen(true)}
              className="px-3.5 py-1.5 bg-[#1b7a54] hover:bg-[#16654a] text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log New Complaint</span>
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Ticket ID</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Location</th>
                  <th className="py-2.5 px-3">Complaint Scope & Description</th>
                  <th className="py-2.5 px-3">Priority</th>
                  <th className="py-2.5 px-3">Assigned Trade Worker</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredComplaints.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500 text-xs">
                      No complaints match the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredComplaints.map((comp) => {
                    const catObj = categories.find((c) => c.name === comp.category);
                    const color = catObj?.color || '#f97316';

                    return (
                      <tr key={comp.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                          {comp.id}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-bold font-mono"
                            style={{
                              backgroundColor: `${color}18`,
                              color: color,
                              border: `1px solid ${color}40`,
                            }}
                          >
                            {comp.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-800 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{comp.location}</span>
                        </td>
                        <td className="py-2.5 px-3 max-w-xs text-slate-700 font-normal leading-relaxed">
                          {comp.description}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              comp.priority === 'High'
                                ? 'bg-rose-100 text-rose-800'
                                : comp.priority === 'Medium'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {comp.priority}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {comp.assignedWorker || <span className="text-slate-400 italic">Unassigned</span>}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                              comp.status === 'Resolved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : comp.status === 'In Progress'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {comp.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <select
                            value={comp.status}
                            onChange={(e) =>
                              updateComplaintStatus(
                                comp.id,
                                e.target.value as ComplaintRecord['status']
                              )
                            }
                            className="text-[11px] p-1 border border-slate-300 rounded-lg bg-white font-semibold cursor-pointer"
                          >
                            <option value="Pending">Pending</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Resolved">Resolved</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD CATEGORY MODAL */}
      {catModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 mb-3">Add Work Category</h3>
            <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category Name</label>
                <input
                  type="text"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="e.g. Waterproofing Work"
                  required
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Theme Color</label>
                <input
                  type="color"
                  value={catColor}
                  onChange={(e) => setCatColor(e.target.value)}
                  className="w-full h-10 p-1 border border-slate-300 rounded-xl cursor-pointer"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Scope & Description</label>
                <textarea
                  rows={3}
                  value={catDescription}
                  onChange={(e) => setCatDescription(e.target.value)}
                  placeholder="Details of trades included under this category..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setCatModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1b7a54] hover:bg-[#16654a] text-white rounded-xl font-bold cursor-pointer"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: LOG NEW COMPLAINT / SERVICE TICKET */}
      {compModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Log Maintenance Complaint / Ticket</h3>
                <p className="text-xs text-slate-500">Record an issue under a work category</p>
              </div>
              <span className="text-xs font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                CMP-{new Date().getFullYear()}-{String(complaints.length + 1).padStart(3, '0')}
              </span>
            </div>

            <form onSubmit={handleSaveComplaint} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Work Category</label>
                  <select
                    value={compCategory}
                    onChange={(e) => setCompCategory(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium cursor-pointer"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Location</label>
                  <select
                    value={compLocation}
                    onChange={(e) => setCompLocation(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium cursor-pointer"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.name}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Complaint / Work Request Description
                </label>
                <textarea
                  rows={3}
                  value={compDescription}
                  onChange={(e) => setCompDescription(e.target.value)}
                  placeholder="e.g. Broken door hinge and latch jamming in first floor room 104..."
                  required
                  className="w-full p-2.5 border border-slate-300 rounded-xl resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={compPriority}
                    onChange={(e) => setCompPriority(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium cursor-pointer"
                  >
                    <option value="High">High (Immediate)</option>
                    <option value="Medium">Medium (Routine)</option>
                    <option value="Low">Low (Scheduled)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Assign Labour (Optional)
                  </label>
                  <select
                    value={compAssignedWorker}
                    onChange={(e) => setCompAssignedWorker(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium cursor-pointer"
                  >
                    <option value="">-- Leave Unassigned --</option>
                    {workers
                      .filter((w) => w.status === 'Active')
                      .map((w) => (
                        <option key={w.id} value={w.name}>
                          {w.name} ({w.designation})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setCompModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1b7a54] hover:bg-[#16654a] text-white rounded-xl font-bold cursor-pointer"
                >
                  Save & Log Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
