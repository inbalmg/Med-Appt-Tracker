import React, { useState, useRef } from 'react';
import { Upload, FileText, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { Medication, Appointment } from '@/types';
import { v4Fallback } from '@/lib/uuid';

type ImportMode = 'append' | 'overwrite';

interface ImportDataDialogProps {
  open: boolean;
  onClose: () => void;
  onImportMedications: (meds: Medication[], mode: ImportMode) => Promise<number>;
  onImportAppointments: (appts: Appointment[], mode: ImportMode) => Promise<number>;
}

type ImportType = 'medications' | 'appointments' | null;

interface ValidationResult {
  valid: boolean;
  data: any[];
  errors: string[];
  type: ImportType;
}

function generateId(): string {
  return v4Fallback();
}

function detectType(headers: string[]): ImportType {
  const lower = headers.map(h => h.toLowerCase().trim());
  if (lower.includes('type') && lower.includes('date') && lower.includes('time') && (lower.includes('doctor') || lower.includes('location'))) {
    return 'appointments';
  }
  if (lower.includes('name') && (lower.includes('times') || lower.includes('frequency') || lower.includes('dosage'))) {
    return 'medications';
  }
  return null;
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return obj;
  });

  return { headers, rows };
}

function validateMedication(row: any, index: number): { med: Medication | null; errors: string[] } {
  const errors: string[] = [];
  if (!row.name || !row.name.trim()) {
    errors.push(`שורה ${index + 1}: שם תרופה חסר`);
    return { med: null, errors };
  }

  const frequency = row.frequency || 'daily';
  if (!['daily', 'weekly', 'once', 'every_x_days'].includes(frequency)) {
    errors.push(`שורה ${index + 1}: תדירות לא חוקית "${frequency}"`);
    return { med: null, errors };
  }

  let times: string[] = [];
  if (row.times) {
    if (Array.isArray(row.times)) {
      times = row.times;
    } else {
      times = row.times.split(';').map((t: string) => t.trim()).filter(Boolean);
    }
    for (const t of times) {
      if (!/^\d{2}:\d{2}$/.test(t)) {
        errors.push(`שורה ${index + 1}: פורמט שעה לא חוקי "${t}" (נדרש HH:MM)`);
        return { med: null, errors };
      }
    }
  }
  if (times.length === 0) times = ['08:00'];

  const startDate = row.startDate || row.start_date || new Date().toISOString().split('T')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    errors.push(`שורה ${index + 1}: פורמט תאריך התחלה לא חוקי`);
    return { med: null, errors };
  }

  const med: Medication = {
    id: generateId(),
    name: row.name.trim(),
    dosage: row.dosage?.trim() || undefined,
    times,
    frequency: frequency as Medication['frequency'],
    weekDay: row.weekDay !== undefined ? Number(row.weekDay) : (row.week_day !== undefined ? Number(row.week_day) : undefined),
    intervalDays: row.intervalDays !== undefined ? Number(row.intervalDays) : (row.interval_days !== undefined ? Number(row.interval_days) : undefined),
    startDate,
    endDate: row.endDate || row.end_date || undefined,
    notes: row.notes || '',
    reminderMinutes: Number(row.reminderMinutes || row.reminder_minutes || 15),
    instruction: row.instruction || undefined,
  };

  return { med, errors: [] };
}

function validateAppointment(row: any, index: number): { appt: Appointment | null; errors: string[] } {
  const errors: string[] = [];

  if (!row.type?.trim()) {
    errors.push(`שורה ${index + 1}: סוג תור חסר`);
    return { appt: null, errors };
  }
  if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
    errors.push(`שורה ${index + 1}: תאריך חסר או לא חוקי (נדרש YYYY-MM-DD)`);
    return { appt: null, errors };
  }
  if (!row.time || !/^\d{2}:\d{2}$/.test(row.time)) {
    errors.push(`שורה ${index + 1}: שעה חסרה או לא חוקית (נדרש HH:MM)`);
    return { appt: null, errors };
  }

  const appt: Appointment = {
    id: generateId(),
    type: row.type.trim(),
    date: row.date,
    time: row.time,
    doctor: row.doctor || '',
    location: row.location || '',
    notes: row.notes || '',
    reminderMinutes: Number(row.reminderMinutes || row.reminder_minutes || 30),
  };

  return { appt, errors: [] };
}

function validateData(data: any[], type: ImportType): ValidationResult {
  if (!type) return { valid: false, data: [], errors: ['לא ניתן לזהות את סוג הנתונים'], type: null };

  const allErrors: string[] = [];
  const validItems: any[] = [];

  for (let i = 0; i < data.length; i++) {
    if (type === 'medications') {
      const { med, errors } = validateMedication(data[i], i);
      if (med) validItems.push(med);
      allErrors.push(...errors);
    } else {
      const { appt, errors } = validateAppointment(data[i], i);
      if (appt) validItems.push(appt);
      allErrors.push(...errors);
    }
  }

  return {
    valid: validItems.length > 0,
    data: validItems,
    errors: allErrors,
    type,
  };
}

export default function ImportDataDialog({ open, onClose, onImportMedications, onImportAppointments }: ImportDataDialogProps) {
  const [medsValidation, setMedsValidation] = useState<ValidationResult | null>(null);
  const [apptsValidation, setApptsValidation] = useState<ValidationResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState('');
  const [mode, setMode] = useState<ImportMode>('append');
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const reset = () => {
    setMedsValidation(null);
    setApptsValidation(null);
    setFileName('');
    setMode('append');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setMedsValidation(null);
    setApptsValidation(null);

    const text = await file.text();

    try {
      if (file.name.endsWith('.json')) {
        const parsed = JSON.parse(text);

        // Handle combined JSON with both medications and appointments
        if (parsed.medications && Array.isArray(parsed.medications)) {
          const result = validateData(parsed.medications, 'medications');
          setMedsValidation(result);
        }
        if (parsed.appointments && Array.isArray(parsed.appointments)) {
          const result = validateData(parsed.appointments, 'appointments');
          setApptsValidation(result);
        }

        // Handle plain array
        if (!parsed.medications && !parsed.appointments) {
          const rows = Array.isArray(parsed) ? parsed : [];
          if (rows.length > 0) {
            const keys = Object.keys(rows[0]);
            const detectedType = detectType(keys);
            if (detectedType) {
              const result = validateData(rows, detectedType);
              if (detectedType === 'medications') setMedsValidation(result);
              else setApptsValidation(result);
            } else {
              setMedsValidation({ valid: false, data: [], errors: ['לא ניתן לזהות את סוג הנתונים'], type: null });
            }
          } else {
            setMedsValidation({ valid: false, data: [], errors: ['הקובץ ריק או לא מכיל נתונים'], type: null });
          }
        }

        // Check if nothing was found
        if (!parsed.medications && !parsed.appointments && !Array.isArray(parsed)) {
          setMedsValidation({ valid: false, data: [], errors: ['מבנה קובץ לא מזוהה'], type: null });
        }
      } else {
        // CSV - single type only
        const { headers, rows } = parseCSV(text);
        if (rows.length === 0) {
          setMedsValidation({ valid: false, data: [], errors: ['הקובץ ריק או לא מכיל נתונים'], type: null });
          return;
        }
        const detectedType = detectType(headers);
        const result = validateData(rows, detectedType);
        if (detectedType === 'appointments') setApptsValidation(result);
        else setMedsValidation(result);
      }
    } catch {
      setMedsValidation({ valid: false, data: [], errors: ['שגיאה בקריאת הקובץ. ודא שהפורמט תקין (CSV או JSON).'], type: null });
    }
  };

  const hasValidMeds = medsValidation?.valid && medsValidation.data.length > 0;
  const hasValidAppts = apptsValidation?.valid && apptsValidation.data.length > 0;
  const allErrors = [
    ...(medsValidation?.errors || []),
    ...(apptsValidation?.errors || []),
  ];

  const handleImport = async () => {
    if (!hasValidMeds && !hasValidAppts) return;

    // Confirm destructive overwrite
    if (mode === 'overwrite') {
      const ok = window.confirm('פעולה זו תמחק את כל הנתונים הקיימים שלך (תרופות ותורים) ותייבא רק את הנתונים מהקובץ. האם להמשיך?');
      if (!ok) return;
    }

    setImporting(true);
    try {
      const results: string[] = [];
      let medsAdded = 0;
      let apptsAdded = 0;
      if (hasValidMeds) {
        medsAdded = await onImportMedications(medsValidation!.data, mode);
        results.push(`${medsAdded} תרופות`);
      }
      if (hasValidAppts) {
        apptsAdded = await onImportAppointments(apptsValidation!.data, mode);
        results.push(`${apptsAdded} תורים`);
      }
      const modeLabel = mode === 'append' ? 'עדכון בלבד (ללא דריסה)' : 'דריסה מלאה';
      toast.success(`ייבוא בוצע בהצלחה (${modeLabel}). נוסף/הוחלף: ${results.join(' ו-')}`);
      reset();
      onClose();
    } catch {
      toast.error('שגיאה בייבוא הנתונים');
    } finally {
      setImporting(false);
    }
  };

  const totalItems = (hasValidMeds ? medsValidation!.data.length : 0) + (hasValidAppts ? apptsValidation!.data.length : 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={() => { reset(); onClose(); }} />
      <div className="relative bg-card rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto p-5 animate-in slide-in-from-bottom duration-200" dir="rtl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">ייבוא נתונים</h2>
          <button onClick={() => { reset(); onClose(); }} className="p-1 rounded-lg hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* File input */}
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">לחץ לבחירת קובץ CSV או JSON</p>
          {fileName && (
            <p className="text-sm text-primary mt-2 flex items-center justify-center gap-1">
              <FileText className="w-4 h-4" />
              {fileName}
            </p>
          )}
        </div>
        <input ref={fileRef} type="file" accept=".csv,.json" className="hidden" onChange={handleFile} />

        {/* Validation results */}
        {(medsValidation || apptsValidation) && (
          <div className="mt-4 space-y-3">
            {/* Import mode selection */}
            <div className="bg-muted/40 rounded-xl p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground mb-1">בחירת אופן הייבוא:</p>
              <div className="space-y-1 text-xs">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="import-mode"
                    className="mt-0.5"
                    checked={mode === 'append'}
                    onChange={() => setMode('append')}
                  />
                  <span>
                    <span className="font-medium">אפשרות א' – עדכון בלבד</span><br />
                    <span className="text-muted-foreground">
                      הוספת רשומות חדשות בלבד, ללא מחיקת נתונים קיימים. כפילויות לפי שם, יום ושעה לא ייובאו שוב.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="import-mode"
                    className="mt-0.5"
                    checked={mode === 'overwrite'}
                    onChange={() => setMode('overwrite')}
                  />
                  <span>
                    <span className="font-medium text-destructive">אפשרות ב' – דריסה מלאה</span><br />
                    <span className="text-muted-foreground">
                      מחיקת כל התרופות והתורים הקיימים של המשתמש וייבוא מלא של כל הנתונים מהקובץ.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            {hasValidMeds && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">
                    נמצאו {medsValidation!.data.length} תרופות תקינות
                  </p>
                </div>
              </div>
            )}

            {hasValidAppts && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">
                    נמצאו {apptsValidation!.data.length} תורים תקינים
                  </p>
                </div>
              </div>
            )}

            {allErrors.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-destructive mb-1">שגיאות:</p>
                  <ul className="text-xs text-destructive/80 space-y-0.5">
                    {allErrors.slice(0, 5).map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                    {allErrors.length > 5 && (
                      <li>... ועוד {allErrors.length - 5} שגיאות</li>
                    )}
                  </ul>
                </div>
              </div>
            )}

            {/* Preview */}
            {hasValidMeds && (
              <div className="bg-muted/50 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-2">תרופות:</p>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {medsValidation!.data.slice(0, 3).map((item: Medication, i: number) => (
                    <div key={i} className="text-xs bg-card rounded-lg p-2 border border-border">
                      💊 {item.name}{item.dosage ? ` - ${item.dosage}` : ''} ({item.times.join(', ')})
                    </div>
                  ))}
                  {medsValidation!.data.length > 3 && (
                    <p className="text-xs text-muted-foreground text-center">... ועוד {medsValidation!.data.length - 3}</p>
                  )}
                </div>
              </div>
            )}

            {hasValidAppts && (
              <div className="bg-muted/50 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-2">תורים:</p>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {apptsValidation!.data.slice(0, 3).map((item: Appointment, i: number) => (
                    <div key={i} className="text-xs bg-card rounded-lg p-2 border border-border">
                      🏥 {item.type} - {item.date} {item.time}
                    </div>
                  ))}
                  {apptsValidation!.data.length > 3 && (
                    <p className="text-xs text-muted-foreground text-center">... ועוד {apptsValidation!.data.length - 3}</p>
                  )}
                </div>
              </div>
            )}

            {(hasValidMeds || hasValidAppts) && (
              <Button onClick={handleImport} disabled={importing} className="w-full">
                {importing ? 'מייבא...' : `ייבא ${totalItems} רשומות`}
              </Button>
            )}
          </div>
        )}

        {/* Format help */}
        <div className="mt-4 bg-muted/30 rounded-xl p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">פורמט נתמך:</p>
          <div className="text-xs text-muted-foreground/80 space-y-1">
            <p><strong>תרופות CSV:</strong> name, dosage, times (מופרד ב-;), frequency, startDate</p>
            <p><strong>תורים CSV:</strong> type, date, time, doctor, location</p>
            <p><strong>JSON:</strong> {"{"} medications: [...], appointments: [...] {"}"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
