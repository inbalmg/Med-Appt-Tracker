import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import TimePicker from '@/components/TimePicker';
import type { Appointment } from '@/types';

interface AddAppointmentFormProps {
  onSave: (appt: Appointment) => void;
  onClose: () => void;
  editingAppointment?: Appointment | null;
  defaultDate?: string;
}

const AddAppointmentForm: React.FC<AddAppointmentFormProps> = ({ onSave, onClose, editingAppointment, defaultDate }) => {
  const [type, setType] = useState(editingAppointment?.type || '');
  const [date, setDate] = useState(editingAppointment?.date || defaultDate || new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(editingAppointment?.time || '09:00');
  const [doctor, setDoctor] = useState(editingAppointment?.doctor || '');
  const [location, setLocation] = useState(editingAppointment?.location || '');
  const [notes, setNotes] = useState(editingAppointment?.notes || '');
  const [reminderMinutes, setReminderMinutes] = useState(editingAppointment?.reminderMinutes ?? 30);
  const [errors, setErrors] = useState<string[]>([]);

  const validate = (): boolean => {
    const errs: string[] = [];
    if (!type.trim()) errs.push('סוג התור חובה');
    if (!date) errs.push('תאריך חובה');
    if (!time) errs.push('שעה חובה');
    
    setErrors(errs);
    return errs.length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    onSave({
      id: editingAppointment?.id || crypto.randomUUID(),
      type: type.trim(),
      date,
      time,
      doctor: doctor.trim(),
      location: location.trim(),
      notes: notes.trim(),
      reminderMinutes,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-background w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6 animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-foreground text-start">
            {editingAppointment ? 'עריכת תור' : 'הוספת תור'}
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
            <Label>סוג התור *</Label>
            <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="לדוגמא: רופא משפחה" className="mt-1" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>תאריך *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 h-10 min-h-[2.5rem] appearance-none" />
            </div>
            <div>
              <Label>שעה *</Label>
              <div className="mt-1">
                <TimePicker value={time} onChange={setTime} className="h-10 min-h-[2.5rem]" />
              </div>
            </div>
          </div>

          <div>
            <Label>שם רופא</Label>
            <Input value={doctor} onChange={(e) => setDoctor(e.target.value)} placeholder="ד״ר ישראלי" className="mt-1" />
          </div>

          <div>
            <Label>מיקום</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="קופת חולים, סניף..." className="mt-1" />
          </div>

          <div>
            <Label>תזכורת (דקות לפני)</Label>
            <Input type="number" value={reminderMinutes} onChange={(e) => setReminderMinutes(Number(e.target.value))} min={0} className="mt-1" />
          </div>

          <div>
            <Label>הערות</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="הערות נוספות..." className="mt-1" rows={2} />
          </div>

          <Button type="submit" className="w-full medical-gradient text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity">
            {editingAppointment ? 'שמור שינויים' : 'הוסף תור'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AddAppointmentForm;
