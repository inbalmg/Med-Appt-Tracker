import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import TimePicker from '@/components/TimePicker';
import type { Medication } from '@/types';

interface AddMedicationFormProps {
  onSave: (med: Medication) => void;
  onClose: () => void;
  editingMedication?: Medication | null;
}

const AddMedicationForm: React.FC<AddMedicationFormProps> = ({ onSave, onClose, editingMedication }) => {
  const [name, setName] = useState(editingMedication?.name || '');
  const [dosage, setDosage] = useState(editingMedication?.dosage || '');
  const [times, setTimes] = useState<string[]>(editingMedication?.times || ['08:00']);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'once' | 'every_x_days'>(editingMedication?.frequency || 'daily');
  const [weekDay, setWeekDay] = useState(editingMedication?.weekDay ?? 0);
  const [intervalDays, setIntervalDays] = useState(editingMedication?.intervalDays ?? 2);
  const [startDate, setStartDate] = useState(editingMedication?.startDate || new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(editingMedication?.endDate || '');
  const [notes, setNotes] = useState(editingMedication?.notes || '');
  const [instruction, setInstruction] = useState(editingMedication?.instruction || '');
  const [reminderMinutes, setReminderMinutes] = useState<number | ''>(
    editingMedication?.reminderMinutes && editingMedication.reminderMinutes > 0 ? editingMedication.reminderMinutes : ''
  );
  const [errors, setErrors] = useState<string[]>([]);

  const addTime = () => setTimes([...times, '12:00']);
  const removeTime = (index: number) => {
    if (times.length <= 1) return;
    setTimes(times.filter((_, i) => i !== index));
  };
  const updateTime = (index: number, value: string) => {
    const updated = [...times];
    updated[index] = value;
    setTimes(updated);
  };

  const validate = (): boolean => {
    const errs: string[] = [];
    if (!name.trim()) errs.push('שם התרופה חובה');
    if (times.length === 0) errs.push('יש להוסיף לפחות שעה אחת');
    if (!startDate) errs.push('תאריך התחלה חובה');
    if (endDate && startDate && endDate < startDate) errs.push('תאריך סיום חייב להיות אחרי תאריך ההתחלה');
    if (frequency === 'once' && endDate && startDate !== endDate) errs.push('באירוע חד פעמי התאריכים חייבים להיות זהים');
    if (frequency === 'every_x_days' && (!intervalDays || intervalDays < 2)) errs.push('מרווח ימים חייב להיות 2 לפחות');

    // Check duplicate times
    const uniqueTimes = new Set(times);
    if (uniqueTimes.size !== times.length) errs.push('לא ניתן להוסיף שעות זהות');

    setErrors(errs);
    return errs.length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    onSave({
      id: editingMedication?.id || crypto.randomUUID(),
      name: name.trim(),
      dosage: dosage.trim() || undefined,
      times,
      frequency,
      weekDay: frequency === 'weekly' ? weekDay : undefined,
      intervalDays: frequency === 'every_x_days' ? intervalDays : undefined,
      startDate,
      endDate: endDate || undefined,
      notes: notes.trim(),
      instruction: instruction.trim(),
      reminderMinutes: reminderMinutes === '' ? 0 : reminderMinutes,
    });
  };

  const WEEK_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-background w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6 animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-foreground text-start">
            {editingMedication ? 'עריכת תרופה' : 'הוספת תרופה'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errors.length > 0 && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 mb-4">
            {errors.map((err, i) => (
              <p key={i} className="text-sm text-destructive">{err}</p>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>שם התרופה *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="לדוגמא: אומפרדקס" className="mt-1" />
          </div>

          <div>
            <Label>מינון</Label>
            <Input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="לדוגמא: 20mg" className="mt-1" />
          </div>

          <div>
            <Label>שעות נטילה *</Label>
            <div className="space-y-2 mt-1">
              {times.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1">
                    <TimePicker value={t} onChange={(val) => updateTime(i, val)} />
                  </div>
                  {times.length > 1 && (
                    <button type="button" onClick={() => removeTime(i)} className="p-2 text-destructive hover:bg-destructive/10 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addTime} className="w-full gap-1">
                <Plus className="w-4 h-4" /> הוסף שעה
              </Button>
            </div>
          </div>

          <div>
            <Label>תדירות</Label>
            <div className="flex gap-2 mt-1">
              {[
                { val: 'daily' as const, label: 'יומי' },
                { val: 'weekly' as const, label: 'שבועי' },
                { val: 'every_x_days' as const, label: 'כל X ימים' },
                { val: 'once' as const, label: 'חד פעמי' },
              ].map(({ val, label }) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    setFrequency(val);
                    if (val === 'once') setEndDate(startDate);
                  }}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all
                    ${frequency === val
                      ? 'medical-gradient text-primary-foreground shadow-md'
                      : 'bg-secondary text-secondary-foreground hover:bg-muted'
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {frequency === 'every_x_days' && (
            <div>
              <Label>כל כמה ימים?</Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">כל</span>
                <Input
                  type="number"
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(Math.max(2, Number(e.target.value)))}
                  min={2}
                  className="w-20 text-center"
                />
                <span className="text-sm text-muted-foreground">ימים</span>
              </div>
            </div>
          )}

          {frequency === 'weekly' && (
            <div>
              <Label>יום בשבוע</Label>
              <div className="flex gap-1 mt-1 flex-wrap">
                {WEEK_DAYS.map((day, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setWeekDay(i)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                      ${weekDay === i
                        ? 'medical-gradient text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-muted'
                      }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>תאריך התחלה *</Label>
              <Input type="date" value={startDate} onChange={(e) => {
                setStartDate(e.target.value);
                if (frequency === 'once') setEndDate(e.target.value);
              }} className="mt-1 h-10 min-h-[2.5rem] appearance-none" />
            </div>
            <div>
              <Label>תאריך סיום</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 h-10 min-h-[2.5rem] appearance-none"
                disabled={frequency === 'once'}
              />
            </div>
          </div>

          <div>
            <Label>הנחיה משנית</Label>
            <Input value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="לדוגמא: לפני הארוחה" className="mt-1" />
          </div>

          <div>
            <Label>תזכורת (דקות לפני)</Label>
            <Input
              type="text"
              inputMode="numeric"
              value={reminderMinutes === '' || reminderMinutes === 0 ? '' : reminderMinutes}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setReminderMinutes(val === '' ? '' : Number(val));
              }}
              placeholder="ללא תזכורת"
              className="mt-1"
            />
          </div>

          <div>
            <Label>הערות</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="הערות נוספות..." className="mt-1" rows={2} />
          </div>

          <Button type="submit" className="w-full medical-gradient text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity">
            {editingMedication ? 'שמור שינויים' : 'הוסף תרופה'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AddMedicationForm;
