import { AttendanceRecord, WorklogRecord, WorkerRecord, LocationRecord } from '../types';

export interface SheetMetadata {
  spreadsheetId: string;
  title: string;
  sheets: {
    sheetId: number;
    title: string;
    index: number;
    rowCount: number;
    columnCount: number;
  }[];
}

export interface ColumnMapping {
  dateCol: number;
  staffIdCol: number;
  nameCol: number;
  designationCol: number;
  workPlaceFNCol: number;
  workDetailsFNCol: number;
  attendanceFNCol: number;
  workPlaceANCol: number;
  workDetailsANCol: number;
  attendanceANCol: number;
  categoryCol: number;
  wagesCol: number;
  recordIdCol: number;
}

export const extractSpreadsheetId = (input: string): string => {
  if (!input) return '';
  const trimmed = input.trim();
  // Check if it's a full Google Sheets URL
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  // Otherwise check if it looks like a clean ID
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    return trimmed;
  }
  return trimmed;
};

export const fetchSpreadsheetInfo = async (spreadsheetId: string, token: string): Promise<SheetMetadata> => {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || `HTTP ${response.status}: Failed to inspect spreadsheet`;
    throw new Error(message);
  }

  const data = await response.json();
  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title || 'Civil Maintenance Worklog',
    sheets: (data.sheets || []).map((s: any) => ({
      sheetId: s.properties?.sheetId,
      title: s.properties?.title,
      index: s.properties?.index,
      rowCount: s.properties?.gridProperties?.rowCount || 0,
      columnCount: s.properties?.gridProperties?.columnCount || 0,
    })),
  };
};

export const fetchSheetValues = async (
  spreadsheetId: string,
  range: string,
  token: string
): Promise<{ headers: string[]; rows: string[][] }> => {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(range)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `HTTP ${response.status}: Failed to read values from ${range}`);
  }

  const data = await response.json();
  const values: string[][] = data.values || [];
  if (values.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = values[0].map((h) => String(h || '').trim());
  const rows = values.slice(1);
  return { headers, rows };
};

export const detectColumnMapping = (headers: string[]): ColumnMapping => {
  const findIndex = (patterns: RegExp[]): number => {
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i].toLowerCase();
      if (patterns.some((p) => p.test(h))) {
        return i;
      }
    }
    return -1;
  };

  return {
    dateCol: findIndex([/^date$/, /entry\s*date/, /work\s*date/]),
    staffIdCol: findIndex([/staff\s*id/, /e\.?\s*id/, /emp(loyee)?\s*id/, /^id$/]),
    nameCol: findIndex([/worker\s*name/, /labour\s*name/, /staff\s*name/, /^name$/]),
    designationCol: findIndex([/designation/, /trade/, /role/]),
    workPlaceFNCol: findIndex([/work\s*place.*fn/, /fn.*location/, /place.*fn/, /location.*fn/]),
    workDetailsFNCol: findIndex([/work\s*detail.*fn/, /fn.*detail/, /fn.*work/]),
    attendanceFNCol: findIndex([/attendance.*fn/, /fn.*attendance/, /fn.*status/]),
    workPlaceANCol: findIndex([/work\s*place.*an/, /an.*location/, /place.*an/, /location.*an/]),
    workDetailsANCol: findIndex([/work\s*detail.*an/, /an.*detail/, /an.*work/]),
    attendanceANCol: findIndex([/attendance.*an/, /an.*attendance/, /an.*status/]),
    categoryCol: findIndex([/work\s*category/, /^category$/]),
    wagesCol: findIndex([/wage/, /amount/, /daily\s*wage/, /rate/]),
    recordIdCol: findIndex([/record\s*id/, /internal\s*id/, /log\s*id/, /^cmwl/]),
  };
};

// USER-SPECIFIED EXACT GOOGLE SHEET HEADERS:
// 1. Worker Master: S.No | Worker Name | Category | Status
export const WORKER_HEADERS = ['S.No', 'Worker Name', 'Category', 'Status'];

// 2. Attendance: Date | S.No | Worker Name | Category | Attendance | Locked | Saved Time
export const ATTENDANCE_HEADERS = ['Date', 'S.No', 'Worker Name', 'Category', 'Attendance', 'Locked', 'Saved Time'];

// 3. Worklog: Date | S.No | Worker Name | Category | FN Work | AN Work | Saved Time
export const WORKLOG_HEADERS = ['Date', 'S.No', 'Worker Name', 'Category', 'FN Work', 'AN Work', 'Saved Time'];

export const LOCATION_HEADERS = ['ID', 'Location Name', 'Category', 'In-Charge', 'Status'];

/**
 * Format worker name to match user pattern: "Mr. BAGAVATHI MURUGANANTHAM"
 */
export const formatWorkerName = (name: string): string => {
  if (!name) return '';
  const trimmed = name.trim();
  if (/^Mr\.\s+/i.test(trimmed) || /^Mrs\.\s+/i.test(trimmed) || /^Ms\.\s+/i.test(trimmed)) {
    return trimmed;
  }
  return `Mr. ${trimmed}`;
};

/**
 * Format category/trade to match user pattern: "Mason", "Carpentry", etc.
 */
export const formatTradeCategory = (designation?: string, category?: string): string => {
  if (designation && designation.trim()) {
    const d = designation.trim();
    if (/carpenter/i.test(d)) return 'Carpentry';
    if (/mason/i.test(d)) return 'Mason';
    if (/welder/i.test(d)) return 'Welding';
    if (/painter/i.test(d)) return 'Painting';
    return d;
  }
  if (category && category.trim()) {
    return category.replace(/\s*Work$/i, '').trim();
  }
  return 'Civil Maintenance';
};

/**
 * Format saved date matching user pattern "10/24/2026"
 */
export const getSavedDateString = (): string => {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
};

/**
 * Append single attendance record matching exact schema:
 * Date | S.No | Worker Name | Category | Attendance | Locked | Saved Time
 * e.g. 2026-10-18 | 21 | Mr. KUMAR P | Carpentry | Absent | TRUE | 10/24/2026
 */
export const appendAttendanceToSheet = async (
  spreadsheetId: string,
  sheetName: string = 'Attendance',
  record: AttendanceRecord,
  token: string,
  sNo: number = 1
) => {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const isPresent = record.attendanceFN === 'Present' || record.attendanceAN === 'Present';
  const attendanceVal = isPresent ? 'Present' : (record.attendanceFN || record.attendanceAN || 'Absent');

  const rowData = [
    record.date,
    sNo,
    formatWorkerName(record.workerName),
    formatTradeCategory(record.designation, record.workCategory),
    attendanceVal,
    'TRUE',
    getSavedDateString(),
  ];

  const range = `${sheetName}!A:G`;
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(
      range
    )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [rowData],
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `HTTP ${response.status}: Failed to append attendance to Google Sheet`);
  }

  return response.json();
};

/**
 * Append single worklog record matching exact schema:
 * Date | S.No | Worker Name | Category | FN Work | AN Work | Saved Time
 */
export const appendWorklogToSheet = async (
  spreadsheetId: string,
  sheetName: string = 'Worklog',
  record: {
    date: string;
    workerName: string;
    designation?: string;
    workCategory?: string;
    workDetailsFN?: string;
    workDetailsAN?: string;
    workDetails?: string;
  },
  token: string,
  sNo: number = 1
) => {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const rowData = [
    record.date,
    sNo,
    formatWorkerName(record.workerName),
    formatTradeCategory(record.designation, record.workCategory),
    record.workDetailsFN || record.workDetails || 'General civil maintenance FN',
    record.workDetailsAN || record.workDetails || 'General civil maintenance AN',
    getSavedDateString(),
  ];

  const range = `${sheetName}!A:G`;
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(
      range
    )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [rowData],
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `HTTP ${response.status}: Failed to append worklog to Google Sheet`);
  }

  return response.json();
};

/**
 * Batch update attendance records matching user exact schema:
 * Date | S.No | Worker Name | Category | Attendance | Locked | Saved Time
 * e.g. 2026-10-18 | 21 | Mr. KUMAR P | Carpentry | Absent | TRUE | 10/24/2026
 */
export const batchUpdateAttendanceToSheet = async (
  spreadsheetId: string,
  sheetName: string = 'Attendance',
  records: AttendanceRecord[],
  workers: WorkerRecord[],
  token: string
): Promise<{ success: boolean; count: number; sheetName: string }> => {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  if (!cleanId) throw new Error('Valid Google Spreadsheet ID or URL is required.');

  const meta = await fetchSpreadsheetInfo(cleanId, token);
  const existingSheet = meta.sheets.find(
    (s) => s.title.toLowerCase() === sheetName.toLowerCase() || s.title.toLowerCase().includes('attendance')
  );

  let targetSheetTitle = sheetName;
  if (!existingSheet) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      }),
    });
  } else {
    targetSheetTitle = existingSheet.title;
  }

  // S.No map
  const sNoMap = new Map<string, number>();
  workers.forEach((w, idx) => {
    sNoMap.set(w.staffId.toLowerCase(), idx + 1);
    sNoMap.set(w.name.toLowerCase(), idx + 1);
  });

  const savedTime = getSavedDateString();
  const rows = records.map((r, idx) => {
    const sNo = sNoMap.get(r.staffId.toLowerCase()) || sNoMap.get(r.workerName.toLowerCase()) || idx + 1;
    const isPresent = r.attendanceFN === 'Present' || r.attendanceAN === 'Present';
    const attendanceVal = isPresent ? 'Present' : (r.attendanceFN || r.attendanceAN || 'Absent');

    return [
      r.date,
      sNo,
      formatWorkerName(r.workerName),
      formatTradeCategory(r.designation, r.workCategory),
      attendanceVal,
      'TRUE',
      savedTime,
    ];
  });

  const allRows = [ATTENDANCE_HEADERS, ...rows];

  // Write exact table
  const range = `${targetSheetTitle}!A1:G${allRows.length}`;
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: allRows,
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to update attendance in Google Sheet`);
  }

  return { success: true, count: records.length, sheetName: targetSheetTitle };
};

/**
 * Batch update worklog records matching user exact schema:
 * Date | S.No | Worker Name | Category | FN Work | AN Work | Saved Time
 */
export const batchUpdateWorklogToSheet = async (
  spreadsheetId: string,
  sheetName: string = 'Worklog',
  records: AttendanceRecord[],
  workers: WorkerRecord[],
  token: string
): Promise<{ success: boolean; count: number; sheetName: string }> => {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  if (!cleanId) throw new Error('Valid Google Spreadsheet ID or URL is required.');

  const meta = await fetchSpreadsheetInfo(cleanId, token);
  const existingSheet = meta.sheets.find(
    (s) => s.title.toLowerCase() === sheetName.toLowerCase() || s.title.toLowerCase().includes('worklog')
  );

  let targetSheetTitle = sheetName;
  if (!existingSheet) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      }),
    });
  } else {
    targetSheetTitle = existingSheet.title;
  }

  const sNoMap = new Map<string, number>();
  workers.forEach((w, idx) => {
    sNoMap.set(w.staffId.toLowerCase(), idx + 1);
    sNoMap.set(w.name.toLowerCase(), idx + 1);
  });

  const savedTime = getSavedDateString();
  const rows = records.map((r, idx) => {
    const sNo = sNoMap.get(r.staffId.toLowerCase()) || sNoMap.get(r.workerName.toLowerCase()) || idx + 1;
    return [
      r.date,
      sNo,
      formatWorkerName(r.workerName),
      formatTradeCategory(r.designation, r.workCategory),
      r.workDetailsFN || '',
      r.workDetailsAN || '',
      savedTime,
    ];
  });

  const allRows = [WORKLOG_HEADERS, ...rows];

  const range = `${targetSheetTitle}!A1:G${allRows.length}`;
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: allRows,
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to update worklog in Google Sheet`);
  }

  return { success: true, count: records.length, sheetName: targetSheetTitle };
};

export const createNewSpreadsheet = async (
  title: string,
  token: string,
  workers: WorkerRecord[],
  locations?: LocationRecord[]
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> => {
  // Create spreadsheet with exact 3 sheets requested by user: Attendance, Worklog, Workers
  const requestBody = {
    properties: {
      title: title || 'BIT Civil Maintenance Worklog & Attendance',
    },
    sheets: [
      { properties: { title: 'Attendance' } },
      { properties: { title: 'Worklog' } },
      { properties: { title: 'Workers' } },
    ],
  };

  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || 'Failed to create Google Spreadsheet');
  }

  const created = await response.json();
  const spreadsheetId = created.spreadsheetId;
  const spreadsheetUrl = created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  // Populate headers and initial worker rows in exact format:
  // S.No | Worker Name | Category | Status
  const workerRows = workers.map((w, idx) => [
    idx + 1,
    formatWorkerName(w.name),
    formatTradeCategory(w.designation, w.category),
    w.status || 'Active',
  ]);

  const valueData = [
    { range: 'Attendance!A1:G1', values: [ATTENDANCE_HEADERS] },
    { range: 'Worklog!A1:G1', values: [WORKLOG_HEADERS] },
    { range: 'Workers!A1:D1', values: [WORKER_HEADERS] },
    { range: `Workers!A2:D${workerRows.length + 1}`, values: workerRows },
  ];

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: valueData,
    }),
  });

  return { spreadsheetId, spreadsheetUrl };
};

export const initializeMissingSheets = async (
  spreadsheetId: string,
  existingSheetNames: string[],
  token: string,
  workers: WorkerRecord[],
  locations?: LocationRecord[]
) => {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const needed = ['Attendance', 'Worklog', 'Workers'].filter((s) => !existingSheetNames.includes(s));

  if (needed.length > 0) {
    const requests = needed.map((title) => ({
      addSheet: {
        properties: { title },
      },
    }));

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    });
  }

  // Populate headers for added sheets
  const valueData: any[] = [];
  if (needed.includes('Attendance')) {
    valueData.push({ range: 'Attendance!A1:G1', values: [ATTENDANCE_HEADERS] });
  }
  if (needed.includes('Worklog')) {
    valueData.push({ range: 'Worklog!A1:G1', values: [WORKLOG_HEADERS] });
  }
  if (needed.includes('Workers')) {
    const workerRows = workers.map((w, idx) => [
      idx + 1,
      formatWorkerName(w.name),
      formatTradeCategory(w.designation, w.category),
      w.status || 'Active',
    ]);
    valueData.push({ range: 'Workers!A1:D1', values: [WORKER_HEADERS] });
    valueData.push({ range: `Workers!A2:D${workerRows.length + 1}`, values: workerRows });
  }

  if (valueData.length > 0) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: valueData,
      }),
    });
  }
};

/**
 * Update all workers / labours directly to Google Sheet matching exact user format:
 * S.No | Worker Name | Category | Status
 * e.g. 1 | Mr. BAGAVATHI MURUGANANTHAM | Mason | Active
 */
export const updateAllWorkersToSheet = async (
  spreadsheetId: string,
  sheetName: string = 'Workers',
  workers: WorkerRecord[],
  token: string
): Promise<{ success: boolean; count: number; sheetName: string }> => {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  if (!cleanId) {
    throw new Error('Valid Google Spreadsheet ID or URL is required.');
  }

  const meta = await fetchSpreadsheetInfo(cleanId, token);
  const existingSheet = meta.sheets.find(
    (s) =>
      s.title.toLowerCase() === sheetName.toLowerCase() ||
      s.title.toLowerCase().includes('worker') ||
      s.title.toLowerCase().includes('labour')
  );

  let targetSheetTitle = sheetName;
  if (!existingSheet) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: { title: sheetName },
            },
          },
        ],
      }),
    });
    targetSheetTitle = sheetName;
  } else {
    targetSheetTitle = existingSheet.title;
  }

  // Exact 4 columns: S.No | Worker Name | Category | Status
  const workerRows = workers.map((w, idx) => [
    idx + 1,
    formatWorkerName(w.name),
    formatTradeCategory(w.designation, w.category),
    w.status || 'Active',
  ]);

  const allRows = [WORKER_HEADERS, ...workerRows];

  // Clear existing values in worker sheet to avoid leftover stale records
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(targetSheetTitle)}!A1:Z500:clear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  ).catch((e) => console.warn('Worker clear range notice:', e));

  // Write exact 4 columns
  const range = `${targetSheetTitle}!A1:D${allRows.length}`;
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: allRows,
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `HTTP ${response.status}: Failed to update labours to Google Sheet`);
  }

  return { success: true, count: workers.length, sheetName: targetSheetTitle };
};

/**
 * Import workers / labours from Google Sheet
 */
export const importWorkersFromGoogleSheet = async (
  spreadsheetId: string,
  sheetName: string = 'Workers',
  token: string
): Promise<WorkerRecord[]> => {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const meta = await fetchSpreadsheetInfo(cleanId, token);
  const targetSheet = meta.sheets.find(
    (s) =>
      s.title.toLowerCase() === sheetName.toLowerCase() ||
      s.title.toLowerCase().includes('worker') ||
      s.title.toLowerCase().includes('labour')
  );

  const titleToFetch = targetSheet ? targetSheet.title : (meta.sheets[0]?.title || sheetName);
  const { headers, rows } = await fetchSheetValues(cleanId, `${titleToFetch}!A1:Z500`, token);

  if (rows.length === 0) {
    return [];
  }

  const findCol = (patterns: RegExp[]): number => {
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i].toLowerCase();
      if (patterns.some((p) => p.test(h))) return i;
    }
    return -1;
  };

  const sNoCol = findCol([/^s\.?\s*no/i, /^sl\.?\s*no/i, /^sno$/i]);
  const staffIdCol = findCol([/staff\s*id/, /e\.?\s*id/, /^id$/]);
  const nameCol = findCol([/worker\s*name/, /labour\s*name/, /^name$/]);
  const designationCol = findCol([/designation/, /trade/, /role/]);
  const categoryCol = findCol([/category/, /work\s*category/]);
  const wageCol = findCol([/wage/, /rate/, /amount/, /per\s*day/]);
  const statusCol = findCol([/status/]);
  const joiningCol = findCol([/join/, /date/]);
  const remarksCol = findCol([/remark/, /notes/]);

  const importedWorkers: WorkerRecord[] = [];

  rows.forEach((row, idx) => {
    if (!row || row.length === 0) return;
    const sNo = sNoCol >= 0 ? parseInt(String(row[sNoCol])) || idx + 1 : idx + 1;
    const name = nameCol >= 0 ? String(row[nameCol] || '').trim() : '';
    const staffId = staffIdCol >= 0 ? String(row[staffIdCol] || '').trim() : `CM41${String(sNo).padStart(3, '0')}`;

    if (!name && !staffId) return;

    const categoryVal = categoryCol >= 0 && row[categoryCol] ? String(row[categoryCol]).trim() : 'Mason';
    const designationVal = designationCol >= 0 && row[designationCol] ? String(row[designationCol]).trim() : categoryVal;
    const wageRaw = wageCol >= 0 ? String(row[wageCol]) : '850';
    const parsedWage = parseFloat(wageRaw.replace(/[^0-9.]/g, '')) || 850;
    const statusVal = statusCol >= 0 && String(row[statusCol]).toLowerCase().includes('inact') ? 'Inactive' : 'Active';

    importedWorkers.push({
      id: `w-sheet-${sNo}-${Date.now()}`,
      eId: staffId,
      staffId: staffId,
      name: name ? formatWorkerName(name) : `Labour ${sNo}`,
      designation: designationVal,
      category: categoryVal,
      perDayWage: parsedWage,
      status: statusVal,
      joiningDate: joiningCol >= 0 && row[joiningCol] ? String(row[joiningCol]).trim() : '2022-01-01',
      remarks: remarksCol >= 0 && row[remarksCol] ? String(row[remarksCol]).trim() : 'Synced from Google Sheet',
    });
  });

  return importedWorkers;
};
