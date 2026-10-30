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
  Download,
  Printer,
  Calendar,
  CalendarRange,
  TrendingUp,
  FileSpreadsheet,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { WorkCategoryRecord, ComplaintRecord, ALLOWED_WORK_CATEGORIES } from '../../types';
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

  // Active View Tab: 'categories' | 'complaints' | 'monthly_report'
  const [activeTab, setActiveTab] = useState<'categories' | 'complaints' | 'monthly_report'>('categories');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  const [complaintStatusFilter, setComplaintStatusFilter] = useState<string>('All');
  const [complaintSearch, setComplaintSearch] = useState<string>('');

  // Monthly Report Filter state
  const currentDate = new Date();
  const [reportYear, setReportYear] = useState<number>(currentDate.getFullYear());
  const [reportMonth, setReportMonth] = useState<number>(currentDate.getMonth() + 1);

  const selectedMonthStr = `${reportYear}-${String(reportMonth).padStart(2, '0')}`;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  // Add Category Modal state
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catName, setCatName] = useState<string>('Mason Work');
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

  // Monthly complaints filtered
  const monthlyComplaints = useMemo(() => {
    return complaints.filter((c) => c.reportedDate && c.reportedDate.startsWith(selectedMonthStr));
  }, [complaints, selectedMonthStr]);

  // Monthly category breakdown
  const monthlyCategoryBreakdown = useMemo(() => {
    return categories.map((cat) => {
      const catComplaints = monthlyComplaints.filter(
        (c) => c.category.toLowerCase() === cat.name.toLowerCase()
      );
      const total = catComplaints.length;
      const pending = catComplaints.filter((c) => c.status === 'Pending').length;
      const inProgress = catComplaints.filter((c) => c.status === 'In Progress').length;
      const resolved = catComplaints.filter((c) => c.status === 'Resolved').length;
      const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 100;
      const assignedWorkers = getAssignedWorkersCount(cat.name);

      // Monthly task deployments
      const monthlyAttendanceForCat = attendance.filter(
        (a) => a.date.startsWith(selectedMonthStr) && a.workCategory === cat.name
      );

      return {
        category: cat,
        totalComplaints: total,
        pending,
        inProgress,
        resolved,
        resolutionRate,
        assignedWorkers,
        taskDeployments: monthlyAttendanceForCat.length,
      };
    });
  }, [categories, monthlyComplaints, attendance, selectedMonthStr, workers]);

  // Overall monthly totals
  const monthlyTotalComplaints = monthlyCategoryBreakdown.reduce((sum, item) => sum + item.totalComplaints, 0);
  const monthlyTotalPending = monthlyCategoryBreakdown.reduce((sum, item) => sum + item.pending, 0);
  const monthlyTotalInProgress = monthlyCategoryBreakdown.reduce((sum, item) => sum + item.inProgress, 0);
  const monthlyTotalResolved = monthlyCategoryBreakdown.reduce((sum, item) => sum + item.resolved, 0);
  const monthlyOverallResolutionRate =
    monthlyTotalComplaints > 0 ? Math.round((monthlyTotalResolved / monthlyTotalComplaints) * 100) : 100;

  // Monthly CSV Download handler
  const handleDownloadMonthlyReportCSV = () => {
    const monthLabel = `${monthNames[reportMonth - 1]} ${reportYear}`;
    const lines: string[] = [];

    // Header metadata
    lines.push(`"BANNARI AMMAN INSTITUTE OF TECHNOLOGY - DEPARTMENT OF CIVIL MAINTENANCE"`);
    lines.push(`"WORK CATEGORIES & COMPLAINT COUNT MONTHLY REPORT - ${monthLabel.toUpperCase()}"`);
    lines.push(`"Generated On: ${getTodayDateString()}","Permitted Categories: Mason Work, Carpentry Work, Welding Work"`);
    lines.push('');

    // Summary KPI section
    lines.push('"--- MONTHLY EXECUTIVE SUMMARY ---"');
    lines.push(`"Report Month","${monthLabel}"`);
    lines.push(`"Total Complaints Registered",${monthlyTotalComplaints}`);
    lines.push(`"Pending Complaints",${monthlyTotalPending}`);
    lines.push(`"In Progress Complaints",${monthlyTotalInProgress}`);
    lines.push(`"Resolved Complaints",${monthlyTotalResolved}`);
    lines.push(`"Overall Resolution Rate","${monthlyOverallResolutionRate}%"`);
    lines.push(`"Total Official Workers in Roster",${workers.length}`);
    lines.push('');

    // Category breakdown section
    lines.push('"--- WORK CATEGORIES & COMPLAINT COUNT BREAKDOWN ---"');
    lines.push('"S.No","Work Category","Total Complaints","Pending","In Progress","Resolved","Resolution Rate (%)","Assigned Specialists","Monthly Tasks"');
    monthlyCategoryBreakdown.forEach((item, idx) => {
      lines.push(
        [
          idx + 1,
          `"${item.category.name}"`,
          item.totalComplaints,
          item.pending,
          item.inProgress,
          item.resolved,
          `"${item.resolutionRate}%"`,
          item.assignedWorkers,
          item.taskDeployments,
        ].join(',')
      );
    });
    lines.push(
      [
        '"TOTAL"',
        '"ALL 3 CIVIL TRADES"',
        monthlyTotalComplaints,
        monthlyTotalPending,
        monthlyTotalInProgress,
        monthlyTotalResolved,
        `"${monthlyOverallResolutionRate}%"`,
        workers.length,
        monthlyCategoryBreakdown.reduce((sum, i) => sum + i.taskDeployments, 0),
      ].join(',')
    );
    lines.push('');

    // Detailed complaints table
    lines.push('"--- DETAILED COMPLAINT TICKETS REGISTER ---"');
    lines.push('"Ticket ID","Work Category","Location","Complaint Description","Priority","Status","Reported Date","Resolved Date","Assigned Specialist"');
    if (monthlyComplaints.length === 0) {
      lines.push('"No complaints logged for this month."');
    } else {
      monthlyComplaints.forEach((c) => {
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
    link.setAttribute('download', `BIT_Civil_Work_Categories_Complaint_Monthly_Report_${selectedMonthStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', `Exported Work Categories & Complaint Count Report for ${monthLabel}.`);
  };

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
            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
              3 Civil Trades (Mason • Carpentry • Welding)
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
              BIT Civil Dept
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            Work Categories & Complaint Count Registry
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Active trade classification restricted to <strong>Mason Work</strong>, <strong>Carpentry Work</strong>, and <strong>Welding Work</strong> with complaint tracking and monthly audit reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setActiveTab('monthly_report');
              handleDownloadMonthlyReportCSV();
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
            title="Download Monthly Report CSV for Work Categories & Complaints"
          >
            <Download className="w-4 h-4" />
            <span>Download Monthly Report</span>
          </button>
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
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
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
        <button
          onClick={() => setActiveTab('monthly_report')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'monthly_report'
              ? 'bg-[#1b7a54] text-white shadow-md shadow-emerald-900/20'
              : 'text-amber-800 bg-amber-50 hover:bg-amber-100'
          }`}
        >
          <CalendarRange className="w-3.5 h-3.5 text-amber-500" />
          <span>Work Categories & Complaint Count Monthly Report & Download</span>
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

      {/* TAB 3: WORK CATEGORIES & COMPLAINT COUNT MONTHLY REPORT & DOWNLOAD */}
      {activeTab === 'monthly_report' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Monthly Report Control Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
                  Monthly Audit Report
                </span>
                <span className="text-xs text-slate-500 font-mono font-bold">
                  Period: {monthNames[reportMonth - 1]} {reportYear}
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mt-1">
                Work Categories & Complaint Count Monthly Consolidation
              </h3>
              <p className="text-xs text-slate-500">
                Audited performance, complaint resolution rate, and manpower distribution for Mason, Carpentry, and Welding trades.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Month & Year Selectors */}
              <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    if (reportMonth === 1) {
                      setReportMonth(12);
                      setReportYear((y) => y - 1);
                    } else {
                      setReportMonth((m) => m - 1);
                    }
                  }}
                  className="px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg text-xs font-bold transition cursor-pointer"
                  title="Previous Month"
                >
                  &larr; Prev
                </button>

                <select
                  value={reportMonth}
                  onChange={(e) => setReportMonth(Number(e.target.value))}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg border-0 bg-transparent text-slate-800 cursor-pointer focus:ring-0"
                >
                  {monthNames.map((name, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {name}
                    </option>
                  ))}
                </select>

                <select
                  value={reportYear}
                  onChange={(e) => setReportYear(Number(e.target.value))}
                  className="px-2 py-1 text-xs font-mono font-bold rounded-lg border-0 bg-transparent text-slate-800 cursor-pointer focus:ring-0"
                >
                  {[currentDate.getFullYear() - 2, currentDate.getFullYear() - 1, currentDate.getFullYear(), currentDate.getFullYear() + 1].map(
                    (yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    )
                  )}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    if (reportMonth === 12) {
                      setReportMonth(1);
                      setReportYear((y) => y + 1);
                    } else {
                      setReportMonth((m) => m + 1);
                    }
                  }}
                  className="px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg text-xs font-bold transition cursor-pointer"
                  title="Next Month"
                >
                  Next &rarr;
                </button>
              </div>

              {/* Action Buttons: Download CSV & Print */}
              <button
                onClick={handleDownloadMonthlyReportCSV}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/20 transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Monthly CSV</span>
              </button>

              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                <Printer className="w-4 h-4 text-slate-500" />
                <span>Print / PDF</span>
              </button>
            </div>
          </div>

          {/* Monthly KPI Overview Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                Total Complaints
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1">{monthlyTotalComplaints}</div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Logged in {monthNames[reportMonth - 1]}</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-rose-200/80 shadow-xs bg-rose-50/20">
              <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wide block">
                Pending Issues
              </span>
              <div className="text-2xl font-black text-rose-800 mt-1">{monthlyTotalPending}</div>
              <span className="text-[10px] text-rose-600 mt-0.5 block">Requires action</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-xs bg-amber-50/20">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wide block">
                In Progress
              </span>
              <div className="text-2xl font-black text-amber-800 mt-1">{monthlyTotalInProgress}</div>
              <span className="text-[10px] text-amber-700 mt-0.5 block">Under execution</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-xs bg-emerald-50/20">
              <span className="text-[10px] font-bold text-[#1b7a54] uppercase tracking-wide block">
                Resolved Tickets
              </span>
              <div className="text-2xl font-black text-[#1b7a54] mt-1">{monthlyTotalResolved}</div>
              <span className="text-[10px] text-emerald-700 mt-0.5 block">Work completed</span>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-white p-4 rounded-2xl border border-purple-200/80 shadow-xs bg-purple-50/20">
              <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wide block">
                Resolution Rate
              </span>
              <div className="text-2xl font-black text-purple-900 mt-1">
                {monthlyOverallResolutionRate}%
              </div>
              <span className="text-[10px] text-purple-700 mt-0.5 block">
                {monthlyTotalResolved} of {monthlyTotalComplaints} closed
              </span>
            </div>
          </div>

          {/* TABLE 1: WORK CATEGORIES & COMPLAINT COUNT BREAKDOWN TABLE */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50">
              <div>
                <h4 className="font-black text-sm text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-600" />
                  <span>Work Categories & Complaint Count Breakdown ({monthNames[reportMonth - 1]} {reportYear})</span>
                </h4>
                <p className="text-xs text-slate-500">
                  Consolidated distribution across the 3 permitted trade categories
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700">
                  3 Official Categories
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 text-slate-700 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">S.No</th>
                    <th className="py-3 px-4">Work Category</th>
                    <th className="py-3 px-4">Scope of Trades</th>
                    <th className="py-3 px-4 text-center">Complaints Count</th>
                    <th className="py-3 px-4 text-center">Pending</th>
                    <th className="py-3 px-4 text-center">In Progress</th>
                    <th className="py-3 px-4 text-center">Resolved</th>
                    <th className="py-3 px-4">Resolution Progress</th>
                    <th className="py-3 px-4 text-center">Assigned Roster</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlyCategoryBreakdown.map((item, idx) => (
                    <tr key={item.category.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-500">{idx + 1}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: item.category.color }}
                          />
                          <span>{item.category.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs">
                        <span className="line-clamp-2 text-[11px]">{item.category.description}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono font-black text-sm text-slate-900 px-2.5 py-0.5 rounded-lg bg-slate-100 border border-slate-200">
                          {item.totalComplaints}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-rose-700">
                        {item.pending > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                            {item.pending}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">0</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-amber-700">
                        {item.inProgress > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                            {item.inProgress}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">0</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-emerald-700">
                        {item.resolved > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {item.resolved}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">0</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 min-w-[140px]">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-bold text-slate-700">
                            <span>{item.resolutionRate}% Rate</span>
                            <span>{item.resolved}/{item.totalComplaints}</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                            <div
                              className="h-2 rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.max(item.resolutionRate, item.totalComplaints === 0 ? 100 : 5)}%`,
                                backgroundColor: item.category.color,
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono font-bold text-slate-700 text-xs">
                          {item.assignedWorkers} Labours
                        </span>
                      </td>
                    </tr>
                  ))}
                  {/* Total Summary Row */}
                  <tr className="bg-slate-50 font-black text-slate-900 border-t-2 border-slate-300">
                    <td className="py-3 px-4 font-mono">TOTAL</td>
                    <td className="py-3 px-4 uppercase text-[11px] tracking-wider text-slate-800">
                      All 3 Civil Trades
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px] font-medium">
                      Masonry, Carpentry, Welding Maintenance
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-sm text-slate-900">
                      {monthlyTotalComplaints}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-rose-700">
                      {monthlyTotalPending}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-amber-700">
                      {monthlyTotalInProgress}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-[#1b7a54]">
                      {monthlyTotalResolved}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-mono text-xs text-[#1b7a54]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{monthlyOverallResolutionRate}% Overall</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      {workers.length} Total
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* TABLE 2: MONTHLY COMPLAINT TICKETS REGISTER */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50">
              <div>
                <h4 className="font-black text-sm text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#1b7a54]" />
                  <span>Complaints & Service Tickets Log ({monthlyComplaints.length} Records)</span>
                </h4>
                <p className="text-xs text-slate-500">
                  Individual maintenance requests logged in {monthNames[reportMonth - 1]} {reportYear}
                </p>
              </div>

              <button
                onClick={handleDownloadMonthlyReportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-white text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Log to CSV</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 text-slate-700 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Ticket ID</th>
                    <th className="py-3 px-3">Work Category</th>
                    <th className="py-3 px-3">Campus Site</th>
                    <th className="py-3 px-3">Issue Description</th>
                    <th className="py-3 px-3">Assigned Specialist</th>
                    <th className="py-3 px-3">Priority</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Reported Date</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlyComplaints.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No maintenance complaints registered for {monthNames[reportMonth - 1]} {reportYear}.
                      </td>
                    </tr>
                  ) : (
                    monthlyComplaints.map((comp) => (
                      <tr key={comp.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                          {comp.id}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-800">{comp.category}</span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-700">
                          {comp.location}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 max-w-xs">
                          <span className="line-clamp-2">{comp.description}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {comp.assignedWorker || <span className="text-slate-400 italic">Unassigned</span>}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
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
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                          {comp.reportedDate}
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* OFFICIAL INSTITUTIONAL PRINT FORMAT (Visible when printed) */}
          <div className="hidden print:block space-y-4 pt-6 border-t-2 border-slate-800 text-slate-900">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-black uppercase tracking-wider">
                BANNARI AMMAN INSTITUTE OF TECHNOLOGY
              </h2>
              <p className="text-xs uppercase tracking-wide font-bold">
                DEPARTMENT OF CIVIL MAINTENANCE • SATHYAMANGALAM
              </p>
              <h3 className="text-sm font-bold underline mt-1">
                MONTHLY WORK CATEGORIES & COMPLAINT COUNT AUDIT REPORT
              </h3>
              <p className="text-xs font-mono">
                Report Period: {monthNames[reportMonth - 1]} {reportYear} | Generated: {getTodayDateString()}
              </p>
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
      )}

      {/* MODAL 1: ADD CATEGORY MODAL */}
      {catModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 mb-1">Manage Work Category</h3>
            <p className="text-xs text-slate-500 mb-3">Configure settings for supported trade categories</p>
            <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category Name</label>
                <select
                  value={catName}
                  onChange={(e) => {
                    const selected = e.target.value;
                    setCatName(selected);
                    const existing = categories.find((c) => c.name === selected);
                    if (existing) {
                      setCatColor(existing.color);
                      setCatDescription(existing.description || '');
                    }
                  }}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium cursor-pointer"
                >
                  {ALLOWED_WORK_CATEGORIES.map((trade) => (
                    <option key={trade} value={trade}>
                      {trade}
                    </option>
                  ))}
                </select>
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
