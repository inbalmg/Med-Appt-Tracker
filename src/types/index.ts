export interface Medication {
  id: string;
  name: string;
  dosage?: string;
  times: string[]; // e.g. ["08:00", "20:00"]
  frequency: 'daily' | 'weekly' | 'once' | 'every_x_days';
  weekDay?: number; // 0-6 for weekly
  intervalDays?: number; // for 'every_x_days' frequency
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  notes: string;
  reminderMinutes: number; // minutes before
  instruction?: string; // e.g. "לפני הארוחה"
}

export interface MedicationInstance {
  medicationId: string;
  time: string;
  medication: Medication;
}

export interface Appointment {
  id: string;
  type: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  doctor: string;
  location: string;
  notes: string;
  reminderMinutes: number;
  arrived?: boolean;
}

export interface CompletionRecord {
  [dateKey: string]: {
    [medicationId_time: string]: boolean;
  };
}

export interface ArrivalRecord {
  [dateKey: string]: {
    [appointmentId: string]: boolean;
  };
}
