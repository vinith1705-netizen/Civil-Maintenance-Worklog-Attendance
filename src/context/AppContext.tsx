import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { User } from 'firebase/auth';
import {
  WorkerRecord,
  LocationRecord,
  WorkCategoryRecord,
  AttendanceRecord,
  WorklogRecord,
  SystemSettings,
  ViewTab,
  AttendanceStatus,
  ComplaintRecord,
} from '../types';
import {
  INITIAL_WORKERS,
  INITIAL_LOCATIONS,
  INITIAL_CATEGORIES,
  INITIAL_ATTENDANCE,
  INITIAL_WORKLOGS,
  INITIAL_SETTINGS,
  INITIAL_COMPLAINTS,
  getTodayDateString,
} from '../data/seedData';
import { initAuth, googleSignIn, googleSignOut, getAccessToken } from '../services/auth';
import { db } from '../services/firebase';
import { doc, setDoc, deleteDoc, writeBatch, collection, getDocs } from 'firebase/firestore';
import {
  fetchSpreadsheetInfo,
  fetchSheetValues,
  detectColumnMapping,
  appendAttendanceToSheet,
  appendWorklogToSheet,
  createNewSpreadsheet,
  extractSpreadsheetId,
  updateAllWorkersToSheet,
  importWorkersFromGoogleSheet,
  batchUpdateAttendanceToSheet,
  batchUpdateWorklogToSheet,
} from '../services/googleSheets';

interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title?: string;
  message: string;
}

interface AppContextType {
  workers: WorkerRecord[];
  locations: LocationRecord[];
  categories: WorkCategoryRecord[];
  attendance: AttendanceRecord[];
  worklogs: WorklogRecord[];
  complaints: ComplaintRecord[];
  settings: SystemSettings;
  activeTab: ViewTab;
  setActiveTab: (tab: ViewTab) => void;
  currentUser: User | null;
  accessToken: string | null;
  isLoggingIn: boolean;
  isSyncing: boolean;
  syncStatus: { status: 'idle' | 'syncing' | 'synced' | 'error'; message?: string };
  toast: ToastNotification | null;
  aiAssistantOpen: boolean;
  setAiAssistantOpen: (open: boolean) => void;

  workflowDate: string;
  setWorkflowDate: (date: string) => void;

  // Actions
  handleGoogleLogin: () => Promise<void>;
  handleGoogleLogout: () => Promise<void>;
  showToast: (type: ToastNotification['type'], message: string, title?: string) => void;
  clearToast: () => void;
  
  // Worker actions
  addWorker: (worker: Omit<WorkerRecord, 'id'>) => void;
  updateWorker: (worker: WorkerRecord) => void;
  toggleWorkerStatus: (id: string) => void;
  
  // Location actions
  addLocation: (loc: Omit<LocationRecord, 'id'>) => void;
  updateLocation: (loc: LocationRecord) => void;
  
  // Category actions
  addCategory: (cat: Omit<WorkCategoryRecord, 'id'>) => void;
  updateCategory: (cat: WorkCategoryRecord) => void;

  // Complaint actions
  addComplaint: (complaint: Omit<ComplaintRecord, 'id'>) => void;
  updateComplaintStatus: (id: string, status: ComplaintRecord['status']) => void;
  
  // Attendance actions
  calculateWage: (
    perDayWage: number,
    attendanceFN: AttendanceStatus,
    attendanceAN: AttendanceStatus
  ) => number;
  checkDuplicateAttendance: (
    date: string,
    staffId: string,
    excludeId?: string
  ) => AttendanceRecord | undefined;
  saveAttendanceRecord: (
    record: Omit<AttendanceRecord, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string,
    confirmSheetSync?: boolean
  ) => Promise<{ success: boolean; record: AttendanceRecord; sheetSynced?: boolean }>;
  saveBatchAttendanceRecords: (
    records: AttendanceRecord[],
    confirmSheetSync?: boolean
  ) => Promise<{ success: boolean; count: number }>;
  deleteAttendanceRecord: (id: string) => void;
  deleteAttendanceForWorker: (date: string, staffId: string) => void;
  clearAttendanceForDate: (date: string) => void;

  // Worklog actions
  saveWorklogRecord: (
    record: Omit<WorklogRecord, 'id' | 'createdAt'>,
    existingId?: string,
    confirmSheetSync?: boolean
  ) => Promise<{ success: boolean; record: WorklogRecord; sheetSynced?: boolean }>;
  deleteWorklogRecord: (id: string) => void;

  // Settings & Sheets actions
  updateSettings: (newSettings: Partial<SystemSettings>) => void;
  connectGoogleSpreadsheet: (urlOrId: string) => Promise<{ title: string; sheets: string[] }>;
  createGoogleSpreadsheet: (customTitle?: string) => Promise<{ url: string; id: string }>;
  syncSheetToLocal: () => Promise<void>;
  resetToSeedData: () => void;

  // Labour Master Google Sheet Actions
  isUpdatingLabour: boolean;
  updateLabourToGoogleSheet: () => Promise<{ success: boolean; count: number; sheetName?: string }>;
  importLabourFromGoogleSheet: () => Promise<{ success: boolean; count: number }>;

  // Attendance & Worklog Google Sheet Actions (Exact Format)
  updateAttendanceToGoogleSheet: (customDate?: string) => Promise<{ success: boolean; count: number }>;
  updateWorklogToGoogleSheet: (customDate?: string) => Promise<{ success: boolean; count: number }>;
  updateAllToGoogleSheet: () => Promise<{ success: boolean }>;
}

const AppContext = createContext<AppContextType | null>(null);

const STORAGE_KEYS = {
  WORKERS: 'bit_civil_workers_v1',
  LOCATIONS: 'bit_civil_locations_v1',
  CATEGORIES: 'bit_civil_categories_v1',
  ATTENDANCE: 'bit_civil_attendance_v1',
  WORKLOGS: 'bit_civil_worklogs_v1',
  COMPLAINTS: 'bit_civil_complaints_v1',
  SETTINGS: 'bit_civil_settings_v1',
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<ViewTab>('attendance_entry');
  const [workflowDate, setWorkflowDate] = useState<string>(getTodayDateString());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isUpdatingLabour, setIsUpdatingLabour] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<{ status: 'idle' | 'syncing' | 'synced' | 'error'; message?: string }>({
    status: 'idle',
  });
  const [toast, setToast] = useState<ToastNotification | null>(null);
  const [aiAssistantOpen, setAiAssistantOpen] = useState<boolean>(false);

  // Core Data States with localStorage persistence fallback
  const [workers, setWorkers] = useState<WorkerRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.WORKERS);
      return saved ? JSON.parse(saved) : INITIAL_WORKERS;
    } catch {
      return INITIAL_WORKERS;
    }
  });

  const [locations, setLocations] = useState<LocationRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LOCATIONS);
      return saved ? JSON.parse(saved) : INITIAL_LOCATIONS;
    } catch {
      return INITIAL_LOCATIONS;
    }
  });

  const [categories, setCategories] = useState<WorkCategoryRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      return saved ? JSON.parse(saved) : INITIAL_CATEGORIES;
    } catch {
      return INITIAL_CATEGORIES;
    }
  });

  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
      if (saved) {
        const parsed: AttendanceRecord[] = JSON.parse(saved);
        return parsed.map((a) => ({
          ...a,
          workDetailsFN: a.workDetailsFN?.includes('Parapet wall brick plastering') ? '' : a.workDetailsFN,
          workDetailsAN: a.workDetailsAN?.includes('Parapet wall brick plastering') || a.workDetailsAN?.includes('Second floor corridor tile joints') ? '' : a.workDetailsAN,
        }));
      }
      return INITIAL_ATTENDANCE;
    } catch {
      return INITIAL_ATTENDANCE;
    }
  });

  const [worklogs, setWorklogs] = useState<WorklogRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.WORKLOGS);
      if (saved) {
        const parsed: WorklogRecord[] = JSON.parse(saved);
        return parsed.map((w) => ({
          ...w,
          workDetails: w.workDetails?.includes('Parapet wall brick plastering') ? '' : w.workDetails,
        }));
      }
      return INITIAL_WORKLOGS;
    } catch {
      return INITIAL_WORKLOGS;
    }
  });

  const [complaints, setComplaints] = useState<ComplaintRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.COMPLAINTS);
      return saved ? JSON.parse(saved) : INITIAL_COMPLAINTS;
    } catch {
      return INITIAL_COMPLAINTS;
    }
  });

  const [settings, setSettings] = useState<SystemSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return saved ? JSON.parse(saved) : INITIAL_SETTINGS;
    } catch {
      return INITIAL_SETTINGS;
    }
  });

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.WORKERS, JSON.stringify(workers));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }, [workers]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.LOCATIONS, JSON.stringify(locations));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }, [locations]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }, [categories]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(attendance));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }, [attendance]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.WORKLOGS, JSON.stringify(worklogs));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }, [worklogs]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.COMPLAINTS, JSON.stringify(complaints));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }, [complaints]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }, [settings]);

  // Initialize Firebase Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser(user);
        setAccessToken(token);
        setSyncStatus({ status: 'idle', message: 'Signed in with Google' });
      },
      () => {
        setCurrentUser(null);
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Load from Firestore when user signs in
  useEffect(() => {
    if (!currentUser) return;
    const loadFromFirestore = async () => {
      try {
        const [attSnap, wlSnap] = await Promise.all([
          getDocs(collection(db, 'attendance')),
          getDocs(collection(db, 'worklogs')),
        ]);
        if (!attSnap.empty) {
          const cloudAtt: AttendanceRecord[] = [];
          attSnap.forEach((d) => cloudAtt.push(d.data() as AttendanceRecord));
          setAttendance((prev) => {
            const map = new Map(prev.map((a) => [a.id, a]));
            cloudAtt.forEach((a) => map.set(a.id, a));
            return Array.from(map.values());
          });
        }
        if (!wlSnap.empty) {
          const cloudWl: WorklogRecord[] = [];
          wlSnap.forEach((d) => cloudWl.push(d.data() as WorklogRecord));
          setWorklogs((prev) => {
            const map = new Map(prev.map((w) => [w.id, w]));
            cloudWl.forEach((w) => map.set(w.id, w));
            return Array.from(map.values());
          });
        }
      } catch (err) {
        console.warn('Load from Firestore note:', err);
      }
    };
    loadFromFirestore();
  }, [currentUser]);

  const showToast = (type: ToastNotification['type'], message: string, title?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToast({ id, type, message, title });
    setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 4500);
  };

  const clearToast = () => setToast(null);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setCurrentUser(res.user);
        setAccessToken(res.accessToken);
        showToast('success', `Signed in as ${res.user.displayName || res.user.email}`);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      showToast('error', err.message || 'Google Sign-in was cancelled or failed.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await googleSignOut();
      setCurrentUser(null);
      setAccessToken(null);
      showToast('info', 'Signed out successfully.');
    } catch (err: any) {
      showToast('error', err.message || 'Error signing out');
    }
  };

  // Wage Calculation Rule Engine
  const calculateWage = (
    perDayWage: number,
    attendanceFN: AttendanceStatus,
    attendanceAN: AttendanceStatus
  ): number => {
    const rules = settings.wageRules;

    const getMultiplier = (status: AttendanceStatus): number => {
      switch (status) {
        case 'Present':
          return rules.halfDayPresent;
        case 'Absent':
          return rules.absent;
        case 'Leave':
          return rules.leave;
        case 'Permission':
          return rules.permission * 0.5;
        case 'Holiday':
          return rules.holiday * 0.5;
        default:
          return 0;
      }
    };

    if (attendanceFN === 'Present' && attendanceAN === 'Present') {
      return Math.round(perDayWage * rules.fullDayPresent);
    }

    const multFN = getMultiplier(attendanceFN);
    const multAN = getMultiplier(attendanceAN);
    const totalMult = multFN + multAN;

    return Math.round(perDayWage * totalMult);
  };

  // Duplicate Protection: check Date + Staff ID + Session
  const checkDuplicateAttendance = (
    date: string,
    staffId: string,
    excludeId?: string
  ): AttendanceRecord | undefined => {
    return attendance.find(
      (a) => a.date === date && a.staffId.toLowerCase() === staffId.toLowerCase() && a.id !== excludeId
    );
  };

  // Save Attendance Record (Add or Update)
  const saveAttendanceRecord = async (
    recordInput: Omit<AttendanceRecord, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string,
    confirmSheetSync: boolean = true
  ): Promise<{ success: boolean; record: AttendanceRecord; sheetSynced?: boolean }> => {
    const isEdit = Boolean(existingId);
    const now = new Date().toISOString();

    // Generate stable unique record ID: CMWL-YYYYMMDD-STAFFID-uniqueNumber
    let recordId = existingId;
    if (!recordId) {
      const cleanDate = recordInput.date.replace(/-/g, '');
      const cleanStaff = recordInput.staffId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const countForDay = attendance.filter((a) => a.date === recordInput.date).length + 1;
      const serial = String(countForDay).padStart(3, '0');
      recordId = `CMWL-${cleanDate}-${cleanStaff}-${serial}`;
    }

    const finalRecord: AttendanceRecord = {
      ...recordInput,
      id: recordId,
      createdAt: isEdit ? attendance.find((a) => a.id === existingId)?.createdAt || now : now,
      updatedAt: now,
      syncedToSheet: false,
    };

    let sheetSynced = false;

    // Save locally
    if (isEdit) {
      setAttendance((prev) => prev.map((a) => (a.id === existingId ? finalRecord : a)));
    } else {
      setAttendance((prev) => [finalRecord, ...prev]);
    }

    // Also automatically create/update corresponding Worklog entry for tracking
    const worklogId = `WL-${finalRecord.id.replace('CMWL-', '')}`;
    const combinedWorkDetails =
      finalRecord.workDetailsFN === finalRecord.workDetailsAN
        ? finalRecord.workDetailsFN
        : `FN: ${finalRecord.workDetailsFN} | AN: ${finalRecord.workDetailsAN}`;
    const primaryLocation =
      finalRecord.workPlaceFN === finalRecord.workPlaceAN
        ? finalRecord.workPlaceFN
        : `${finalRecord.workPlaceFN} / ${finalRecord.workPlaceAN}`;

    const worklogEntry: WorklogRecord = {
      id: worklogId,
      date: finalRecord.date,
      staffId: finalRecord.staffId,
      workerName: finalRecord.workerName,
      designation: finalRecord.designation,
      workCategory: finalRecord.workCategory,
      workLocation: primaryLocation,
      workDetails: combinedWorkDetails,
      session: 'Full Day',
      status: 'Completed',
      remarks: finalRecord.remarks || `Generated from Attendance #${finalRecord.id}`,
      createdAt: now,
    };

    setWorklogs((prev) => {
      const idx = prev.findIndex((w) => w.id === worklogId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = worklogEntry;
        return copy;
      }
      return [worklogEntry, ...prev];
    });

    // Write back to Google Sheet if token & spreadsheet are connected
    if (confirmSheetSync && settings.spreadsheetId && accessToken) {
      try {
        await appendAttendanceToSheet(
          settings.spreadsheetId,
          settings.attendanceSheetName || 'Attendance',
          finalRecord,
          accessToken
        );
        sheetSynced = true;
        finalRecord.syncedToSheet = true;
        setAttendance((prev) => prev.map((a) => (a.id === finalRecord.id ? { ...a, syncedToSheet: true } : a)));
      } catch (sheetError: any) {
        console.error('Failed to sync to Google Sheet:', sheetError);
        showToast('warning', `Saved locally, but Google Sheet sync failed: ${sheetError.message}`);
      }
    }

    // Sync to Firestore if authenticated
    if (currentUser) {
      setDoc(doc(db, 'attendance', finalRecord.id), finalRecord).catch((e) =>
        console.warn('Firestore attendance save warning:', e)
      );
      setDoc(doc(db, 'worklogs', worklogEntry.id), worklogEntry).catch((e) =>
        console.warn('Firestore worklog save warning:', e)
      );
    }

    showToast(
      'success',
      isEdit
        ? `Attendance updated for ${finalRecord.workerName}`
        : `Attendance recorded for ${finalRecord.workerName} (Wage: ₹${finalRecord.wage})`
    );

    return { success: true, record: finalRecord, sheetSynced };
  };

  const deleteAttendanceRecord = (id: string) => {
    setAttendance((prev) => prev.filter((a) => a.id !== id));
    if (currentUser) {
      deleteDoc(doc(db, 'attendance', id)).catch((e) =>
        console.warn('Firestore attendance delete warning:', e)
      );
    }
    showToast('info', 'Attendance record removed.');
  };

  const deleteAttendanceForWorker = (targetDate: string, staffId: string) => {
    setAttendance((prev) =>
      prev.filter(
        (a) => !(a.date === targetDate && a.staffId.toLowerCase() === staffId.toLowerCase())
      )
    );
    setWorklogs((prev) =>
      prev.filter(
        (w) => !(w.date === targetDate && w.staffId.toLowerCase() === staffId.toLowerCase())
      )
    );
  };

  const clearAttendanceForDate = (targetDate: string) => {
    setAttendance((prev) => prev.filter((a) => a.date !== targetDate));
    setWorklogs((prev) => prev.filter((w) => w.date !== targetDate));
  };

  // Batch Save Attendance for All Labours (Daily Roll Call)
  const saveBatchAttendanceRecords = async (
    records: AttendanceRecord[],
    confirmSheetSync: boolean = true
  ): Promise<{ success: boolean; count: number }> => {
    const now = new Date().toISOString();
    const updatedRecords = records.map((r) => ({
      ...r,
      updatedAt: now,
      createdAt: r.createdAt || now,
    }));

    // Update attendance state: replace records for the same (date + staffId) or add new
    setAttendance((prev) => {
      const recordMap = new Map<string, AttendanceRecord>();
      // Keep existing non-conflicting records
      prev.forEach((item) => {
        const key = `${item.date}_${item.staffId.toLowerCase()}`;
        recordMap.set(key, item);
      });
      // Merge batch records
      updatedRecords.forEach((item) => {
        const key = `${item.date}_${item.staffId.toLowerCase()}`;
        recordMap.set(key, item);
      });
      return Array.from(recordMap.values());
    });

    // Create or update corresponding worklogs for present workers
    const presentLabours = updatedRecords.filter(
      (r) => r.attendanceFN === 'Present' || r.attendanceAN === 'Present'
    );

    const generatedWorklogs: WorklogRecord[] = presentLabours.map((r) => {
      const worklogId = `WL-${r.id.replace('CMWL-', '')}`;
      const combinedDetails =
        r.workDetailsFN === r.workDetailsAN
          ? r.workDetailsFN || ''
          : `FN: ${r.workDetailsFN || 'Civil work'} | AN: ${r.workDetailsAN || 'Civil work'}`;
      const location =
        r.workPlaceFN === r.workPlaceAN
          ? r.workPlaceFN || 'Campus Sites'
          : `${r.workPlaceFN || 'Campus'} / ${r.workPlaceAN || 'Campus'}`;

      return {
        id: worklogId,
        date: r.date,
        staffId: r.staffId,
        workerName: r.workerName,
        designation: r.designation,
        workCategory: r.workCategory || 'Civil Maintenance',
        workLocation: location,
        workDetails: combinedDetails,
        session: 'Full Day',
        status: 'In Progress',
        remarks: r.remarks || `Daily muster roll #${r.id}`,
        createdAt: now,
      };
    });

    setWorklogs((prev) => {
      const logMap = new Map<string, WorklogRecord>();
      prev.forEach((l) => logMap.set(l.id, l));
      generatedWorklogs.forEach((l) => logMap.set(l.id, l));
      return Array.from(logMap.values());
    });

    // Google Sheets sync if connected using exact 7-column schema:
    // Attendance: Date | S.No | Worker Name | Category | Attendance | Locked | Saved Time
    // Worklog: Date | S.No | Worker Name | Category | FN Work | AN Work | Saved Time
    if (confirmSheetSync && settings.spreadsheetId && accessToken) {
      try {
        await batchUpdateAttendanceToSheet(
          settings.spreadsheetId,
          settings.attendanceSheetName || 'Attendance',
          updatedRecords,
          workers,
          accessToken
        );
        await batchUpdateWorklogToSheet(
          settings.spreadsheetId,
          settings.worklogSheetName || 'Worklog',
          updatedRecords,
          workers,
          accessToken
        );
        showToast('success', `Synced ${updatedRecords.length} records to Google Sheet Attendance & Worklog!`);
      } catch (sheetErr: any) {
        console.warn('Google Sheet batch sync warning:', sheetErr);
      }
    }

    // Sync batch to Firestore
    if (currentUser && updatedRecords.length > 0) {
      try {
        const batch = writeBatch(db);
        updatedRecords.forEach((r) => {
          batch.set(doc(db, 'attendance', r.id), r);
        });
        generatedWorklogs.forEach((w) => {
          batch.set(doc(db, 'worklogs', w.id), w);
        });
        batch.commit().catch((e) => console.warn('Firestore batch save warning:', e));
      } catch (e) {
        console.warn('Firestore batch setup warning:', e);
      }
    }

    showToast('success', `Daily roll-call recorded for all ${updatedRecords.length} labours.`);
    return { success: true, count: updatedRecords.length };
  };

  // Worklog Management
  const saveWorklogRecord = async (
    recordInput: Omit<WorklogRecord, 'id' | 'createdAt'>,
    existingId?: string,
    confirmSheetSync: boolean = true
  ): Promise<{ success: boolean; record: WorklogRecord; sheetSynced?: boolean }> => {
    const isEdit = Boolean(existingId);
    const now = new Date().toISOString();
    let recordId = existingId;
    if (!recordId) {
      const cleanDate = recordInput.date.replace(/-/g, '');
      const count = worklogs.length + 1;
      recordId = `WL-${cleanDate}-${String(count).padStart(3, '0')}`;
    }

    const finalRecord: WorklogRecord = {
      ...recordInput,
      id: recordId,
      createdAt: isEdit ? worklogs.find((w) => w.id === existingId)?.createdAt || now : now,
      syncedToSheet: false,
    };

    let sheetSynced = false;

    if (isEdit) {
      setWorklogs((prev) => prev.map((w) => (w.id === existingId ? finalRecord : w)));
    } else {
      setWorklogs((prev) => [finalRecord, ...prev]);
    }

    if (confirmSheetSync && settings.spreadsheetId && accessToken) {
      try {
        const workerIdx = workers.findIndex(
          (w) =>
            w.staffId.toLowerCase() === finalRecord.staffId.toLowerCase() ||
            w.name.toLowerCase() === finalRecord.workerName.toLowerCase()
        );
        await appendWorklogToSheet(
          settings.spreadsheetId,
          settings.worklogSheetName || 'Worklog',
          finalRecord,
          accessToken,
          workerIdx >= 0 ? workerIdx + 1 : 1
        );
        sheetSynced = true;
        setWorklogs((prev) => prev.map((w) => (w.id === finalRecord.id ? { ...w, syncedToSheet: true } : w)));
      } catch (err: any) {
        console.error('Worklog Google Sheet sync failed:', err);
      }
    }

    // Sync to Firestore
    if (currentUser) {
      setDoc(doc(db, 'worklogs', finalRecord.id), finalRecord).catch((e) =>
        console.warn('Firestore worklog save warning:', e)
      );
    }

    showToast('success', isEdit ? 'Worklog updated' : 'New worklog entry saved');
    return { success: true, record: finalRecord, sheetSynced };
  };

  const deleteWorklogRecord = (id: string) => {
    setWorklogs((prev) => prev.filter((w) => w.id !== id));
    if (currentUser) {
      deleteDoc(doc(db, 'worklogs', id)).catch((e) =>
        console.warn('Firestore worklog delete warning:', e)
      );
    }
    showToast('info', 'Worklog entry removed.');
  };

  // Worker Master Actions
  const addWorker = (workerInput: Omit<WorkerRecord, 'id'>) => {
    const id = `w-${Date.now()}`;
    const newWorker: WorkerRecord = { ...workerInput, id };
    setWorkers((prev) => [...prev, newWorker]);
    showToast('success', `Added worker: ${newWorker.name} (${newWorker.staffId})`);
  };

  const updateWorker = (worker: WorkerRecord) => {
    setWorkers((prev) => prev.map((w) => (w.id === worker.id ? worker : w)));
    showToast('success', `Updated worker ${worker.name}`);
  };

  const toggleWorkerStatus = (id: string) => {
    setWorkers((prev) =>
      prev.map((w) => {
        if (w.id === id) {
          const newStatus = w.status === 'Active' ? 'Inactive' : 'Active';
          showToast('info', `${w.name} is now ${newStatus}. Historical attendance preserved.`);
          return { ...w, status: newStatus };
        }
        return w;
      })
    );
  };

  // Location Master Actions
  const addLocation = (locInput: Omit<LocationRecord, 'id'>) => {
    const id = `loc-${Date.now()}`;
    const newLoc: LocationRecord = { ...locInput, id };
    setLocations((prev) => [...prev, newLoc]);
    showToast('success', `Added location: ${newLoc.name}`);
  };

  const updateLocation = (loc: LocationRecord) => {
    setLocations((prev) => prev.map((l) => (l.id === loc.id ? loc : l)));
    showToast('success', `Updated location: ${loc.name}`);
  };

  // Category Actions
  const addCategory = (catInput: Omit<WorkCategoryRecord, 'id'>) => {
    const id = `cat-${Date.now()}`;
    const newCat: WorkCategoryRecord = {
      ...catInput,
      id,
      complaintCount: catInput.complaintCount ?? 0,
      pendingComplaints: catInput.pendingComplaints ?? 0,
      resolvedComplaints: catInput.resolvedComplaints ?? 0,
    };
    setCategories((prev) => [...prev, newCat]);
    showToast('success', `Added category: ${newCat.name}`);
  };

  const updateCategory = (cat: WorkCategoryRecord) => {
    setCategories((prev) => prev.map((c) => (c.id === cat.id ? cat : c)));
    showToast('success', `Updated category: ${cat.name}`);
  };

  // Complaint Actions
  const addComplaint = (input: Omit<ComplaintRecord, 'id'>) => {
    const id = `CMP-${new Date().getFullYear()}-${String(complaints.length + 1).padStart(3, '0')}`;
    const newComp: ComplaintRecord = { ...input, id };
    setComplaints((prev) => [newComp, ...prev]);

    // Update corresponding category complaint count
    setCategories((prev) =>
      prev.map((c) => {
        if (c.name.toLowerCase() === input.category.toLowerCase()) {
          const isResolved = input.status === 'Resolved';
          return {
            ...c,
            complaintCount: (c.complaintCount || 0) + 1,
            pendingComplaints: (c.pendingComplaints || 0) + (isResolved ? 0 : 1),
            resolvedComplaints: (c.resolvedComplaints || 0) + (isResolved ? 1 : 0),
          };
        }
        return c;
      })
    );
    showToast('success', `Logged complaint #${id} for ${input.category}`);
  };

  const updateComplaintStatus = (id: string, newStatus: ComplaintRecord['status']) => {
    let affectedCategory = '';
    let oldStatus: ComplaintRecord['status'] = 'Pending';

    setComplaints((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          affectedCategory = c.category;
          oldStatus = c.status;
          const resolvedDate = newStatus === 'Resolved' ? getTodayDateString() : c.resolvedDate;
          return { ...c, status: newStatus, resolvedDate };
        }
        return c;
      })
    );

    if (affectedCategory && oldStatus !== newStatus) {
      setCategories((prev) =>
        prev.map((c) => {
          if (c.name.toLowerCase() === affectedCategory.toLowerCase()) {
            let pending = c.pendingComplaints || 0;
            let resolved = c.resolvedComplaints || 0;
            if (oldStatus !== 'Resolved' && newStatus === 'Resolved') {
              pending = Math.max(0, pending - 1);
              resolved += 1;
            } else if (oldStatus === 'Resolved' && newStatus !== 'Resolved') {
              resolved = Math.max(0, resolved - 1);
              pending += 1;
            }
            return { ...c, pendingComplaints: pending, resolvedComplaints: resolved };
          }
          return c;
        })
      );
    }

    showToast('info', `Complaint #${id} updated to "${newStatus}"`);
  };

  const updateSettings = (newSettings: Partial<SystemSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
    showToast('success', 'Settings updated.');
  };

  // Google Sheet Connect and Discover
  const connectGoogleSpreadsheet = async (
    urlOrId: string
  ): Promise<{ title: string; sheets: string[] }> => {
    if (!accessToken) {
      throw new Error('Please sign in with Google first to connect your Google Spreadsheet.');
    }
    const cleanId = extractSpreadsheetId(urlOrId);
    if (!cleanId) {
      throw new Error('Please enter a valid Google Spreadsheet URL or ID.');
    }

    setIsSyncing(true);
    setSyncStatus({ status: 'syncing', message: 'Inspecting Google Spreadsheet structure...' });

    try {
      const meta = await fetchSpreadsheetInfo(cleanId, accessToken);
      const sheetTitles = meta.sheets.map((s) => s.title);

      const cleanUrl = urlOrId.startsWith('http')
        ? urlOrId
        : `https://docs.google.com/spreadsheets/d/${cleanId}`;

      setSettings((prev) => ({
        ...prev,
        spreadsheetId: cleanId,
        spreadsheetUrl: cleanUrl,
        selectedSheetName: sheetTitles[0] || 'Attendance',
      }));

      // Check if there are existing rows to import or inspect
      const firstSheet = sheetTitles.find((s) => s.toLowerCase().includes('attendance')) || sheetTitles[0];
      if (firstSheet) {
        const { headers, rows } = await fetchSheetValues(cleanId, `${firstSheet}!A1:Z100`, accessToken);
        if (headers.length > 0) {
          const mapping = detectColumnMapping(headers);
          console.log('Dynamic column mapping result:', mapping, 'from headers:', headers);
        }
      }

      setSyncStatus({ status: 'synced', message: `Connected to "${meta.title}"` });
      showToast('success', `Connected to Google Spreadsheet: "${meta.title}"`);
      return { title: meta.title, sheets: sheetTitles };
    } catch (err: any) {
      setSyncStatus({ status: 'error', message: err.message });
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  // Create brand new Google Sheet in Drive
  const createGoogleSpreadsheet = async (
    customTitle?: string
  ): Promise<{ url: string; id: string }> => {
    if (!accessToken) {
      throw new Error('Please sign in with Google first to create a spreadsheet in your Google Drive.');
    }
    setIsSyncing(true);
    setSyncStatus({ status: 'syncing', message: 'Creating Civil Maintenance spreadsheet...' });

    try {
      const res = await createNewSpreadsheet(
        customTitle || 'BIT Civil Maintenance Worklog & Attendance',
        accessToken,
        workers,
        locations
      );

      setSettings((prev) => ({
        ...prev,
        spreadsheetId: res.spreadsheetId,
        spreadsheetUrl: res.spreadsheetUrl,
        attendanceSheetName: 'Attendance',
        worklogSheetName: 'Worklog',
        workerSheetName: 'Workers',
      }));

      setSyncStatus({ status: 'synced', message: 'New Google Spreadsheet created and linked' });
      showToast('success', 'Google Spreadsheet created with Attendance, Worklog, Workers, and Locations tabs!');
      return { url: res.spreadsheetUrl, id: res.spreadsheetId };
    } catch (err: any) {
      setSyncStatus({ status: 'error', message: err.message });
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  // Pull latest records from connected sheet into local state
  const syncSheetToLocal = async () => {
    if (!accessToken || !settings.spreadsheetId) {
      showToast('warning', 'Please sign in and configure a Google Spreadsheet ID first.');
      return;
    }

    setIsSyncing(true);
    setSyncStatus({ status: 'syncing', message: 'Reading records from Google Sheets...' });

    try {
      const attendanceSheet = settings.attendanceSheetName || 'Attendance';
      const { headers, rows } = await fetchSheetValues(
        settings.spreadsheetId,
        `${attendanceSheet}!A1:Q500`,
        accessToken
      );

      if (rows.length > 0) {
        const mapping = detectColumnMapping(headers);
        const importedRecords: AttendanceRecord[] = [];

        rows.forEach((row, idx) => {
          if (!row || row.length === 0) return;
          const recId = mapping.recordIdCol >= 0 ? row[mapping.recordIdCol] : `CMWL-SYNC-${idx}`;
          const date = mapping.dateCol >= 0 ? row[mapping.dateCol] : getTodayDateString();
          const staffId = mapping.staffIdCol >= 0 ? row[mapping.staffIdCol] : `STAFF-${idx}`;
          const workerName = mapping.nameCol >= 0 ? row[mapping.nameCol] : 'Unknown';
          const designation = mapping.designationCol >= 0 ? row[mapping.designationCol] : 'Worker';
          const category = mapping.categoryCol >= 0 ? row[mapping.categoryCol] : 'Civil Maintenance';
          const wage = mapping.wagesCol >= 0 ? parseFloat(row[mapping.wagesCol]) || 0 : 0;

          if (staffId && workerName) {
            importedRecords.push({
              id: recId || `CMWL-${date.replace(/-/g, '')}-${staffId}-${idx}`,
              date,
              staffId,
              workerName,
              designation,
              workCategory: category,
              workPlaceFN: mapping.workPlaceFNCol >= 0 ? row[mapping.workPlaceFNCol] || 'Campus' : 'Campus',
              workDetailsFN: mapping.workDetailsFNCol >= 0 ? row[mapping.workDetailsFNCol] || '' : '',
              attendanceFN: (mapping.attendanceFNCol >= 0 ? row[mapping.attendanceFNCol] : 'Present') as AttendanceStatus,
              workPlaceAN: mapping.workPlaceANCol >= 0 ? row[mapping.workPlaceANCol] || 'Campus' : 'Campus',
              workDetailsAN: mapping.workDetailsANCol >= 0 ? row[mapping.workDetailsANCol] || '' : '',
              attendanceAN: (mapping.attendanceANCol >= 0 ? row[mapping.attendanceANCol] : 'Present') as AttendanceStatus,
              calculatedWage: wage,
              wage: wage,
              status: 'Approved',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              syncedToSheet: true,
            });
          }
        });

        if (importedRecords.length > 0) {
          // Merge imported records without deleting existing ones
          setAttendance((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const newOnes = importedRecords.filter((r) => !existingIds.has(r.id));
            return [...prev, ...newOnes];
          });
          showToast('success', `Synced ${importedRecords.length} records from Google Sheet.`);
        }
      }

      setSyncStatus({ status: 'synced', message: 'Synced with Google Sheet' });
    } catch (err: any) {
      console.error('Sync failed:', err);
      setSyncStatus({ status: 'error', message: err.message });
      showToast('error', `Sheet sync failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Update all labours to Google Sheet
  const updateLabourToGoogleSheet = async (): Promise<{ success: boolean; count: number; sheetName?: string }> => {
    let token = accessToken;
    if (!token) {
      token = await getAccessToken();
    }
    if (!token) {
      showToast('warning', 'Please sign in with Google to update your Google Sheet.');
      await handleGoogleLogin();
      token = await getAccessToken();
    }

    if (!token) {
      throw new Error('Google sign-in required to update Google Sheet.');
    }

    if (!settings.spreadsheetId) {
      showToast('warning', 'Please link or create a Google Spreadsheet in Settings first.');
      throw new Error('No Google Spreadsheet linked. Please configure a Spreadsheet URL or create one in Settings.');
    }

    setIsUpdatingLabour(true);
    setSyncStatus({ status: 'syncing', message: `Updating ${workers.length} labours to Google Sheet...` });

    try {
      const res = await updateAllWorkersToSheet(
        settings.spreadsheetId,
        settings.workerSheetName || 'Workers',
        workers,
        token
      );

      setSyncStatus({ status: 'synced', message: `Labour Master updated (${res.count} workers)` });
      showToast(
        'success',
        `Successfully updated all ${res.count} labours to Google Sheet tab "${res.sheetName}"!`,
        'Labour Master Synced'
      );
      return res;
    } catch (err: any) {
      console.error('Update labour to Google Sheet failed:', err);
      setSyncStatus({ status: 'error', message: err.message });
      showToast('error', `Failed to update labours to Google Sheet: ${err.message}`);
      throw err;
    } finally {
      setIsUpdatingLabour(false);
    }
  };

  // Import / refresh labours from Google Sheet
  const importLabourFromGoogleSheet = async (): Promise<{ success: boolean; count: number }> => {
    let token = accessToken;
    if (!token) {
      token = await getAccessToken();
    }
    if (!token) {
      showToast('warning', 'Please sign in with Google first.');
      await handleGoogleLogin();
      token = await getAccessToken();
    }

    if (!token) {
      throw new Error('Google sign-in required to import from Google Sheet.');
    }

    if (!settings.spreadsheetId) {
      showToast('warning', 'Please configure a Google Spreadsheet first in Settings.');
      throw new Error('No Google Spreadsheet linked.');
    }

    setIsUpdatingLabour(true);
    try {
      const imported = await importWorkersFromGoogleSheet(
        settings.spreadsheetId,
        settings.workerSheetName || 'Workers',
        token
      );

      if (imported.length === 0) {
        showToast('info', 'No worker records found in the specified Google Sheet tab.');
        return { success: false, count: 0 };
      }

      setWorkers((prev) => {
        const staffMap = new Map<string, WorkerRecord>();
        prev.forEach((w) => staffMap.set(w.staffId.toLowerCase(), w));
        imported.forEach((w) => {
          const existing = staffMap.get(w.staffId.toLowerCase());
          if (existing) {
            staffMap.set(w.staffId.toLowerCase(), { ...existing, ...w, id: existing.id });
          } else {
            staffMap.set(w.staffId.toLowerCase(), w);
          }
        });
        return Array.from(staffMap.values());
      });

      showToast('success', `Imported & updated ${imported.length} labours from Google Sheet!`, 'Labour Master Updated');
      return { success: true, count: imported.length };
    } catch (err: any) {
      console.error('Import labour failed:', err);
      showToast('error', `Failed to import labours: ${err.message}`);
      throw err;
    } finally {
      setIsUpdatingLabour(false);
    }
  };

  // Update Attendance to Google Sheet (Exact schema: Date | S.No | Worker Name | Category | Attendance | Locked | Saved Time)
  const updateAttendanceToGoogleSheet = async (customDate?: string): Promise<{ success: boolean; count: number }> => {
    let token = accessToken;
    if (!token) token = await getAccessToken();
    if (!token) {
      showToast('warning', 'Please sign in with Google to update Google Sheet.');
      await handleGoogleLogin();
      token = await getAccessToken();
    }
    if (!token) throw new Error('Google sign-in required.');
    if (!settings.spreadsheetId) throw new Error('No Google Spreadsheet linked in Settings.');

    const targetDate = customDate || workflowDate || getTodayDateString();
    const recordsForDate = attendance.filter((a) => a.date === targetDate);
    const recordsToSync = recordsForDate.length > 0 ? recordsForDate : attendance;

    setIsSyncing(true);
    setSyncStatus({ status: 'syncing', message: `Updating ${recordsToSync.length} attendance rows to Google Sheet...` });

    try {
      const res = await batchUpdateAttendanceToSheet(
        settings.spreadsheetId,
        settings.attendanceSheetName || 'Attendance',
        recordsToSync,
        workers,
        token
      );
      setSyncStatus({ status: 'synced', message: `Attendance updated (${res.count} rows)` });
      showToast(
        'success',
        `Successfully updated ${res.count} attendance rows to Google Sheet "${res.sheetName}"!`,
        'Attendance Updated'
      );
      return res;
    } catch (err: any) {
      console.error('Update attendance failed:', err);
      setSyncStatus({ status: 'error', message: err.message });
      showToast('error', `Failed to update attendance: ${err.message}`);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  // Update Worklog to Google Sheet (Exact schema: Date | S.No | Worker Name | Category | FN Work | AN Work | Saved Time)
  const updateWorklogToGoogleSheet = async (customDate?: string): Promise<{ success: boolean; count: number }> => {
    let token = accessToken;
    if (!token) token = await getAccessToken();
    if (!token) {
      showToast('warning', 'Please sign in with Google to update Google Sheet.');
      await handleGoogleLogin();
      token = await getAccessToken();
    }
    if (!token) throw new Error('Google sign-in required.');
    if (!settings.spreadsheetId) throw new Error('No Google Spreadsheet linked in Settings.');

    const targetDate = customDate || workflowDate || getTodayDateString();
    const recordsForDate = attendance.filter((a) => a.date === targetDate);
    const recordsToSync = recordsForDate.length > 0 ? recordsForDate : attendance;

    setIsSyncing(true);
    setSyncStatus({ status: 'syncing', message: `Updating ${recordsToSync.length} worklog rows to Google Sheet...` });

    try {
      const res = await batchUpdateWorklogToSheet(
        settings.spreadsheetId,
        settings.worklogSheetName || 'Worklog',
        recordsToSync,
        workers,
        token
      );
      setSyncStatus({ status: 'synced', message: `Worklog updated (${res.count} rows)` });
      showToast(
        'success',
        `Successfully updated ${res.count} worklog rows to Google Sheet "${res.sheetName}"!`,
        'Worklog Updated'
      );
      return res;
    } catch (err: any) {
      console.error('Update worklog failed:', err);
      setSyncStatus({ status: 'error', message: err.message });
      showToast('error', `Failed to update worklog: ${err.message}`);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  // One-click Master Sync for all 3 formats: Workers + Attendance + Worklog
  const updateAllToGoogleSheet = async (): Promise<{ success: boolean }> => {
    setIsSyncing(true);
    try {
      await updateLabourToGoogleSheet();
      await updateAttendanceToGoogleSheet();
      await updateWorklogToGoogleSheet();
      showToast('success', 'All 3 sheets (Workers, Attendance, Worklog) updated in Google Sheets!', 'Google Sheet Updated');
      return { success: true };
    } catch (err: any) {
      showToast('error', `Google Sheet sync failed: ${err.message}`);
      return { success: false };
    } finally {
      setIsSyncing(false);
    }
  };

  const resetToSeedData = () => {
    setWorkers(INITIAL_WORKERS);
    setLocations(INITIAL_LOCATIONS);
    setCategories(INITIAL_CATEGORIES);
    setAttendance(INITIAL_ATTENDANCE);
    setWorklogs(INITIAL_WORKLOGS);
    setComplaints(INITIAL_COMPLAINTS);
    setSettings(INITIAL_SETTINGS);
    showToast('info', 'Reset to initial BIT Civil Maintenance master data.');
  };

  const value = useMemo(
    () => ({
      workers,
      locations,
      categories,
      attendance,
      worklogs,
      complaints,
      settings,
      activeTab,
      setActiveTab,
      currentUser,
      accessToken,
      isLoggingIn,
      isSyncing,
      isUpdatingLabour,
      syncStatus,
      toast,
      aiAssistantOpen,
      setAiAssistantOpen,
      handleGoogleLogin,
      handleGoogleLogout,
      showToast,
      clearToast,
      addWorker,
      updateWorker,
      toggleWorkerStatus,
      addLocation,
      updateLocation,
      addCategory,
      updateCategory,
      addComplaint,
      updateComplaintStatus,
      calculateWage,
      checkDuplicateAttendance,
      workflowDate,
      setWorkflowDate,
      saveBatchAttendanceRecords,
      saveAttendanceRecord,
      deleteAttendanceRecord,
      deleteAttendanceForWorker,
      clearAttendanceForDate,
      saveWorklogRecord,
      deleteWorklogRecord,
      updateSettings,
      connectGoogleSpreadsheet,
      createGoogleSpreadsheet,
      syncSheetToLocal,
      resetToSeedData,
      updateLabourToGoogleSheet,
      importLabourFromGoogleSheet,
      updateAttendanceToGoogleSheet,
      updateWorklogToGoogleSheet,
      updateAllToGoogleSheet,
    }),
    [
      workers,
      locations,
      categories,
      attendance,
      worklogs,
      complaints,
      settings,
      activeTab,
      workflowDate,
      currentUser,
      accessToken,
      isLoggingIn,
      isSyncing,
      isUpdatingLabour,
      syncStatus,
      toast,
      aiAssistantOpen,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
