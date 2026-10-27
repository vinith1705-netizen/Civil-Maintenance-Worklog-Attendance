export type AttendanceStatus = 'Present' | 'Absent' | 'Leave' | 'Permission' | 'Holiday';
export type WorkerStatus = 'Active' | 'Inactive';
export type WorklogStatus = 'Completed' | 'In Progress' | 'Pending';
export type RecordApprovalStatus = 'Approved' | 'Draft' | 'Flagged';

export interface WorkerRecord {
  id: string; // Unique ID
  eId: string; // E.ID
  staffId: string; // Staff ID (e.g. CM41001)
  name: string; // Worker Name
  designation: string; // e.g. Mason, Tiles Mason, Carpentry, Welder, Helper
  category: string; // Mason, Carpentry, Welder, Helper, etc.
  perDayWage: number; // e.g. 850
  status: WorkerStatus;
  joiningDate: string; // YYYY-MM-DD
  remarks: string;
}

export interface AttendanceRecord {
  id: string; // e.g. CMWL-20261024-CM41001-001
  date: string; // YYYY-MM-DD
  staffId: string;
  eId?: string;
  workerName: string;
  designation: string;
  
  // Forenoon
  workPlaceFN: string;
  workDetailsFN: string;
  attendanceFN: AttendanceStatus;
  
  // Afternoon
  workPlaceAN: string;
  workDetailsAN: string;
  attendanceAN: AttendanceStatus;
  
  workCategory: string;
  calculatedWage: number;
  wageOverride?: number | null;
  wage: number; // Final wage to record
  status: RecordApprovalStatus;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
  syncedToSheet?: boolean;
}

export interface WorklogRecord {
  id: string;
  date: string; // YYYY-MM-DD
  staffId: string;
  workerName: string;
  designation: string;
  workCategory: string;
  workLocation: string;
  workDetails: string; // Complete, untruncated description
  session: 'Forenoon' | 'Afternoon' | 'Full Day';
  status: WorklogStatus;
  remarks: string;
  createdAt: string;
  syncedToSheet?: boolean;
}

export interface LocationRecord {
  id: string;
  name: string;
  category: 'Hostel' | 'Academic' | 'Infrastructure' | 'Workshop' | 'Residential' | 'Other';
  inCharge?: string;
  status: 'Active' | 'Inactive';
}

export interface ComplaintRecord {
  id: string; // e.g. CMP-2026-001
  category: string; // e.g. Mason Work, Carpentry Work
  location: string; // e.g. Ruby Hostel, Academic Block
  description: string;
  status: 'Pending' | 'In Progress' | 'Resolved';
  priority: 'High' | 'Medium' | 'Low';
  reportedDate: string;
  assignedWorker?: string;
  resolvedDate?: string;
}

export interface WorkCategoryRecord {
  id: string;
  name: string;
  color: string;
  description?: string;
  complaintCount?: number; // Total number of complaints / tickets
  pendingComplaints?: number;
  resolvedComplaints?: number;
}

export interface WageRules {
  fullDayPresent: number; // multiplier, default 1.0
  halfDayPresent: number; // multiplier, default 0.5
  absent: number; // 0
  leave: number; // 0
  permission: number; // 0.5 (half day pay) or 1.0
  holiday: number; // 1.0 (paid holiday) or 0
}

export interface SystemSettings {
  institutionName: string;
  departmentName: string;
  defaultWorkingHours: string;
  wageRules: WageRules;
  spreadsheetId: string;
  spreadsheetUrl: string;
  selectedSheetName: string;
  autoSyncGoogleSheet: boolean;
  attendanceSheetName: string;
  worklogSheetName: string;
  workerSheetName: string;
}

export type ViewTab =
  | 'dashboard'
  | 'attendance_entry'
  | 'worklog_entry'
  | 'workers'
  | 'locations'
  | 'categories'
  | 'daily_report'
  | 'monthly_report'
  | 'worker_report'
  | 'location_report'
  | 'mason_report'
  | 'search'
  | 'settings';
