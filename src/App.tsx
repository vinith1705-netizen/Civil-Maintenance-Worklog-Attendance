import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Toast } from './components/Toast';
import { AiAssistantDrawer } from './components/AiAssistantDrawer';
import { UnauthorizedDomainModal } from './components/UnauthorizedDomainModal';
import { GooglePopupHelpModal } from './components/GooglePopupHelpModal';

// Views
import { DashboardView } from './components/views/DashboardView';
import { AttendanceEntryView } from './components/views/AttendanceEntryView';
import { WorklogEntryView } from './components/views/WorklogEntryView';
import { WorkerMasterView } from './components/views/WorkerMasterView';
import { CategoryMasterView } from './components/views/CategoryMasterView';
import { DailyReportView } from './components/views/DailyReportView';
import { MonthlyReportView } from './components/views/MonthlyReportView';
import { WorkerReportView } from './components/views/WorkerReportView';
import { MasonReportView } from './components/views/MasonReportView';
import { SearchFilterView } from './components/views/SearchFilterView';
import { SettingsView } from './components/views/SettingsView';

const MainLayout: React.FC = () => {
  const {
    activeTab,
    showUnauthorizedModal,
    setShowUnauthorizedModal,
    showPopupHelpModal,
    setShowPopupHelpModal,
    popupErrorDetail,
    handleGoogleLogin,
  } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'attendance_entry':
        return <AttendanceEntryView />;
      case 'worklog_entry':
        return <WorklogEntryView />;
      case 'workers':
        return <WorkerMasterView />;
      case 'categories':
        return <CategoryMasterView />;
      case 'daily_report':
        return <DailyReportView />;
      case 'monthly_report':
        return <MonthlyReportView />;
      case 'worker_report':
        return <WorkerReportView />;
      case 'mason_report':
        return <MasonReportView />;
      case 'search':
        return <SearchFilterView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-amber-500 selection:text-white">
      {/* Top Header */}
      <Header onToggleMobileMenu={() => setMobileMenuOpen(true)} />

      {/* Main Body with Sidebar + Active View */}
      <div className="flex-1 flex w-full">
        <Sidebar mobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />

        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-x-hidden">
          {renderActiveView()}
        </main>
      </div>

      {/* Slide-out AI Assistant Drawer */}
      <AiAssistantDrawer />

      {/* Global Notifications */}
      <Toast />

      {/* Firebase Auth Domain Authorization Dialog */}
      <UnauthorizedDomainModal
        isOpen={showUnauthorizedModal}
        onClose={() => setShowUnauthorizedModal(false)}
        onRetry={() => {
          setShowUnauthorizedModal(false);
          handleGoogleLogin();
        }}
      />

      {/* Google Popup Closed / Blocked Troubleshooting Modal */}
      <GooglePopupHelpModal
        isOpen={showPopupHelpModal}
        errorCode={popupErrorDetail}
        onClose={() => setShowPopupHelpModal(false)}
        onRetryFirebase={() => {
          setShowPopupHelpModal(false);
          handleGoogleLogin();
        }}
      />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
