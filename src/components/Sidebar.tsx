import React from 'react';
import {
  LayoutDashboard,
  CalendarCheck,
  ClipboardList,
  Users,
  MapPin,
  Tag,
  FileText,
  CalendarRange,
  UserCheck,
  Building,
  Hammer,
  Search,
  Settings,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ViewTab } from '../types';

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onCloseMobile }) => {
  const { activeTab, setActiveTab } = useApp();

  const navItems: { id: ViewTab; label: string; icon: React.ElementType; section?: string; badge?: string }[] = [
    { id: 'attendance_entry', label: '1. Labour Attendance', icon: CalendarCheck, section: 'Daily Operations', badge: 'Step 1' },
    { id: 'worklog_entry', label: '2. Worklog Entry', icon: ClipboardList, section: 'Daily Operations', badge: 'Step 2' },
    
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'Overview' },
    
    { id: 'workers', label: 'Worker Master', icon: Users, section: 'Masters' },
    { id: 'locations', label: 'Work Locations', icon: MapPin },
    { id: 'categories', label: 'Work Categories', icon: Tag },
    
    { id: 'daily_report', label: 'Daily Report', icon: FileText, section: 'Reports & Analytics' },
    { id: 'monthly_report', label: 'Monthly Report', icon: CalendarRange },
    { id: 'worker_report', label: 'Worker Report', icon: UserCheck },
    { id: 'location_report', label: 'Location Report', icon: Building },
    { id: 'mason_report', label: 'Mason Work Summary', icon: Hammer, badge: 'Key' },
    
    { id: 'search', label: 'Search & Filter', icon: Search, section: 'System' },
    { id: 'settings', label: 'Admin Settings', icon: Settings },
  ];

  const handleSelectTab = (tab: ViewTab) => {
    setActiveTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  const content = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300 w-64 border-r border-slate-800">
      {/* Brand Header inside Sidebar for Mobile */}
      <div className="p-4 flex items-center justify-between border-b border-slate-800 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-600 text-white font-bold flex items-center justify-center text-xs">
            BIT
          </div>
          <span className="font-bold text-white text-sm">Civil Maintenance</span>
        </div>
        <button
          onClick={onCloseMobile}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {['Daily Operations', 'Overview', 'Masters', 'Reports & Analytics', 'System'].map((sectionTitle) => {
          const itemsInSection = navItems.filter((item) => {
            if (sectionTitle === 'Daily Operations') return item.id === 'attendance_entry' || item.id === 'worklog_entry';
            if (sectionTitle === 'Overview') return item.id === 'dashboard';
            if (sectionTitle === 'Masters') return item.id === 'workers' || item.id === 'locations' || item.id === 'categories';
            if (sectionTitle === 'Reports & Analytics') return item.id === 'daily_report' || item.id === 'monthly_report' || item.id === 'worker_report' || item.id === 'location_report' || item.id === 'mason_report';
            if (sectionTitle === 'System') return item.id === 'search' || item.id === 'settings';
            return false;
          });

          return (
            <div key={sectionTitle} className="space-y-1">
              <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {sectionTitle}
              </div>
              <div className="space-y-0.5">
                {itemsInSection.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectTab(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition group ${
                        isActive
                          ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={`w-4 h-4 transition ${
                            isActive ? 'text-white' : 'text-slate-400 group-hover:text-amber-400'
                          }`}
                        />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
        <div>
          <span className="font-medium text-slate-400">BIT Civil Dept</span>
          <span className="block text-[10px] text-slate-600">Erode, Tamil Nadu</span>
        </div>
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="System Operational" />
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block shrink-0 sticky top-[61px] h-[calc(100vh-61px)] no-print">
        {content}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCloseMobile} />
          <div className="relative z-10 animate-in slide-in-from-left duration-200">{content}</div>
        </div>
      )}
    </>
  );
};
