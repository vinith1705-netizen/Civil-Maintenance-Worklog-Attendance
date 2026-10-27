import { GoogleGenAI } from '@google/genai';
import { AttendanceRecord, WorklogRecord, WorkerRecord, LocationRecord } from '../types';

// Initialize Gemini SDK with apiKey from environment
const apiKey = (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
  (import.meta as any).env?.VITE_GEMINI_API_KEY ||
  '';

let aiClient: GoogleGenAI | null = null;
if (apiKey) {
  try {
    aiClient = new GoogleGenAI({ apiKey });
  } catch (err) {
    console.error('Failed to initialize GoogleGenAI client:', err);
  }
}

/**
 * Improves work description: fixes typos, grammatical structures, enhances civil engineering terminology
 * without hallucinating any tasks that were not mentioned.
 */
export const improveWorkDescription = async (
  rawDescription: string,
  context?: { workerName?: string; designation?: string; location?: string }
): Promise<string> => {
  if (!rawDescription || rawDescription.trim().length === 0) {
    return rawDescription;
  }

  if (!aiClient) {
    // Elegant fallback rule-based cleanup if API key is not yet set
    const cleaned = rawDescription
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^([a-z])/, (m) => m.toUpperCase());
    return cleaned.endsWith('.') ? cleaned : `${cleaned}.`;
  }

  const prompt = `You are a professional Civil Engineering Maintenance Supervisor at Bannari Amman Institute of Technology (BIT).
The user has provided rough site notes or spoken transcription of civil maintenance work:
"${rawDescription}"

Context:
Worker: ${context?.workerName || 'Staff'} (${context?.designation || 'Worker'})
Location: ${context?.location || 'Campus'}

INSTRUCTIONS:
1. Correct all spelling, typographical, and grammatical mistakes.
2. Standardize civil maintenance and construction terms (e.g., scaffolding, masonry, plastering, shuttering, vitrified tiles, PCC bed, conduit pipe, red oxide primer, arch welding).
3. STRICT RULE: DO NOT INVENT ANY WORK OR ACTIONS THAT WERE NOT IN THE ORIGINAL TEXT.
4. Output ONLY the improved sentence/paragraph in plain text. Do not wrap in quotes, do not add introductory phrases or bullet points.`;

  try {
    const response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text?.trim() || rawDescription;
  } catch (err) {
    console.error('AI description improvement failed:', err);
    return rawDescription;
  }
};

/**
 * Civil Maintenance AI Assistant:
 * Queries the connected civil worklog, attendance, workers, and locations database.
 * Formulates fact-grounded responses strictly referencing actual records and dates.
 */
export const askCivilMaintenanceAssistant = async (
  userQuestion: string,
  dataContext: {
    attendance: AttendanceRecord[];
    worklogs: WorklogRecord[];
    workers: WorkerRecord[];
    locations: LocationRecord[];
  }
): Promise<string> => {
  if (!userQuestion || userQuestion.trim().length === 0) {
    return 'Please enter a question regarding civil maintenance work, workers, attendance, or locations.';
  }

  // Prepare a compact representation of the data to avoid token overflow
  const compactAttendance = dataContext.attendance.slice(0, 100).map((a) => ({
    id: a.id,
    date: a.date,
    staffId: a.staffId,
    worker: a.workerName,
    designation: a.designation,
    category: a.workCategory,
    fnPlace: a.workPlaceFN,
    fnWork: a.workDetailsFN,
    fnStatus: a.attendanceFN,
    anPlace: a.workPlaceAN,
    anWork: a.workDetailsAN,
    anStatus: a.attendanceAN,
    wage: a.wage,
  }));

  const compactWorklogs = dataContext.worklogs.slice(0, 80).map((w) => ({
    id: w.id,
    date: w.date,
    worker: w.workerName,
    designation: w.designation,
    category: w.workCategory,
    location: w.workLocation,
    details: w.workDetails,
    status: w.status,
  }));

  const compactWorkers = dataContext.workers.map((w) => ({
    staffId: w.staffId,
    name: w.name,
    designation: w.designation,
    category: w.category,
    status: w.status,
    wage: w.perDayWage,
  }));

  const compactLocations = dataContext.locations.map((l) => l.name);

  if (!aiClient) {
    // Intelligent local search answering when API key is offline
    const q = userQuestion.toLowerCase();
    if (q.includes('ruby hostel') || q.includes('ruby')) {
      const rubyRecords = compactAttendance.filter(
        (a) => a.fnPlace.toLowerCase().includes('ruby') || a.anPlace.toLowerCase().includes('ruby')
      );
      if (rubyRecords.length > 0) {
        return `Found ${rubyRecords.length} records for Ruby Hostel:\n` +
          rubyRecords.map((r) => `• ${r.date}: ${r.worker} (${r.designation}) - ${r.fnWork}`).join('\n');
      }
    }
    if (q.includes('mason')) {
      const masons = compactWorkers.filter((w) => w.designation.toLowerCase().includes('mason'));
      return `There are ${masons.length} active masons registered:\n` +
        masons.slice(0, 6).map((m) => `• ${m.staffId}: ${m.name} (${m.designation})`).join('\n') +
        `\n(Connect Gemini API key in environment to unlock full conversational queries)`;
    }
    return `Civil Maintenance Assistant received your question: "${userQuestion}".\nPlease verify that your GEMINI_API_KEY is configured in your environment to run complex AI reasoning. Currently querying local database with ${compactAttendance.length} attendance records and ${compactWorkers.length} registered workers.`;
  }

  const systemPrompt = `You are the specialized "Civil Maintenance AI Assistant" for the Department of Civil Maintenance at Bannari Amman Institute of Technology.
Your duty is to assist civil engineers, supervisors, and department heads with operational insights, attendance verification, manpower deployment, and work progress.

GROUNDING RULES:
1. Base all answers ONLY on the provided JSON data below.
2. DO NOT hallucinate or make up work logs, workers, locations, or dates that are not present.
3. When answering, cite specific Dates, Worker Names, Staff IDs, and Locations.
4. If the data does not contain the answer, explicitly state: "No matching records were found in the current worklog records."
5. Format your response cleanly with markdown bullet points, bold highlights, and clear tables where appropriate.

AVAILABLE DATA:
Registered Workers (${compactWorkers.length}): ${JSON.stringify(compactWorkers)}
Campus Locations (${compactLocations.length}): ${JSON.stringify(compactLocations)}
Attendance Records (${compactAttendance.length}): ${JSON.stringify(compactAttendance)}
Worklog Records (${compactWorklogs.length}): ${JSON.stringify(compactWorklogs)}`;

  try {
    const response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\nUSER QUESTION: ${userQuestion}` }] }
      ],
    });
    return response.text?.trim() || 'No response generated.';
  } catch (err: any) {
    console.error('Gemini Assistant query error:', err);
    return `Error consulting Civil Maintenance AI: ${err.message || 'Please check API connection.'}`;
  }
};
