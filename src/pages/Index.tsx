import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { format, addDays, isToday, isTomorrow, parseISO, getDay, startOfDay } from 'date-fns';
import { Plus, Pill, Stethoscope, CalendarDays, Bell, BellOff, BookOpen, LogOut, Upload, Download, BellRing } from 'lucide-react';
import DateStrip from '@/components/DateStrip';
import MedicationCard from '@/components/MedicationCard';
import AppointmentCard from '@/components/AppointmentCard';
import AddMedicationForm from '@/components/AddMedicationForm';
import AddAppointmentForm from '@/components/AddAppointmentForm';
import CalendarTab from '@/components/CalendarTab';
import ActionSheet from '@/components/ActionSheet';
import ConfirmDialog from '@/components/ConfirmDialog';
import ImportDataDialog from '@/components/ImportDataDialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useNotifications } from '@/hooks/useNotifications';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { useAuth } from '@/hooks/useAuth';
import type { Medication, Appointment, MedicationInstance } from '@/types';
import InstallBanner from '@/components/InstallBanner';
import { Navigate } from 'react-router-dom';


const Index = () => {
  const { signOut, user, loading: authLoading } = useAuth();
  const {
    medications, appointments, completions, arrivals, loading,
    saveMedication, saveAppointment, deleteMedication, deleteAppointment,
    toggleCompletion, toggleArrival, importMedications, importAppointments,
  } = useSupabaseData();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [rangeStart, setRangeStart] = useState(() => addDays(new Date(), -2));
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showMedForm, setShowMedForm] = useState(false);
  const [showApptForm, setShowApptForm] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [actionTarget, setActionTarget] = useState<{ type: 'med' | 'appt'; med?: Medication; appt?: Appointment } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'med' | 'appt'; id: string; name: string } | null>(null);
  const [showImport, setShowImport] = useState(false);

  const { isSubscribed, isLoading, subscribe, unsubscribe, startNotificationChecker, debouncedSync, sendTestNotification } = useNotifications();
  

  // Start notification checker when subscribed
  useEffect(() => {
    if (isSubscribed) {
      const cleanup = startNotificationChecker(
        () => medications,
        () => appointments,
      );
      return cleanup;
    }
  }, [isSubscribed, medications, appointments, startNotificationChecker]);

  // Sync reminders to DB whenever data changes
  useEffect(() => {
    if (isSubscribed) {
      debouncedSync(medications, appointments);
    }
  }, [isSubscribed, medications, appointments, debouncedSync]);

  // Reset to today when returning
  useEffect(() => {
    const handleFocus = () => {
      const now = new Date();
      if (!isToday(selectedDate)) {
        setSelectedDate(now);
        setRangeStart(addDays(now, -2));
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [selectedDate]);

  const dateKey = format(selectedDate, 'yyyy-MM-dd');

  const shiftRange = useCallback((direction: 'forward' | 'backward') => {
    setRangeStart(prev => addDays(prev, direction === 'forward' ? 7 : -7));
  }, []);

  // Single source of truth for date selection (carousel + calendar)
  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
    setRangeStart(addDays(date, -2));
  }, []);

  // Filter medications for selected date
  const dailyMedInstances = useMemo((): MedicationInstance[] => {
    const instances: MedicationInstance[] = [];
    const selDate = selectedDate;
    const selDateStr = format(selDate, 'yyyy-MM-dd');

    medications.forEach(med => {
      if (selDateStr < med.startDate) return;
      if (med.endDate && selDateStr > med.endDate) return;

      let active = false;
      if (med.frequency === 'daily') {
        active = true;
      } else if (med.frequency === 'weekly') {
        active = getDay(selDate) === med.weekDay;
      } else if (med.frequency === 'once') {
        active = selDateStr === med.startDate;
      } else if (med.frequency === 'every_x_days' && med.intervalDays) {
        const start = startOfDay(parseISO(med.startDate));
        const diff = Math.round((startOfDay(selDate).getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        active = diff >= 0 && diff % med.intervalDays === 0;
      }

      if (active) {
        med.times.forEach(time => {
          instances.push({ medicationId: med.id, time, medication: med });
        });
      }
    });

    return instances.sort((a, b) => a.time.localeCompare(b.time));
  }, [medications, selectedDate]);

  // Filter appointments for selected date
  const dailyAppointments = useMemo(() => {
    return appointments
      .filter(a => a.date === dateKey)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments, dateKey]);

  const handleSaveMed = async (med: Medication) => {
    await saveMedication(med);
    setShowMedForm(false);
    setEditingMed(null);
  };

  const handleSaveAppt = async (appt: Appointment) => {
    await saveAppointment(appt);
    setShowApptForm(false);
    setEditingAppt(null);
  };

  const canMarkArrival = (appt: Appointment): boolean => {
    if (appt.date !== format(new Date(), 'yyyy-MM-dd')) return false;
    const now = new Date();
    const [h, m] = appt.time.split(':').map(Number);
    const apptTime = new Date();
    apptTime.setHours(h, m, 0, 0);
    return now >= apptTime;
  };

  // Auth gate: redirect immediately when auth check is complete and no user exists
  if (!authLoading && !user) {
    return <Navigate to="/auth" replace />;
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 max-w-md mx-auto">
      {/* Header */}
      <DateStrip
        selectedDate={selectedDate}
        onSelectDate={handleDateSelect}
        rangeStart={rangeStart}
        onShiftRange={shiftRange}
        onGoToToday={() => {
          const now = new Date();
          handleDateSelect(now);
        }}
        showTodayButton={!isToday(selectedDate) || rangeStart.toDateString() !== addDays(new Date(), -2).toDateString()}
      />

      {/* Content */}
      <div className="px-4 mt-5 min-h-[calc(100vh-200px)]">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2 mb-3">
          <CalendarDays className="w-5 h-5 text-primary" />
          {(() => {
            const MONTH_NAMES_HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
            const DAY_NAMES_HE = ["יום א'", "יום ב'", "יום ג'", "יום ד'", "יום ה'", "יום ו'", 'שבת'];
            const day = selectedDate.getDate();
            const monthName = MONTH_NAMES_HE[selectedDate.getMonth()];
            const datePart = `${day} ב${monthName}`;
            const sel = startOfDay(selectedDate);
            if (isToday(sel)) return `היום, ${datePart}`;
            if (isTomorrow(sel)) return `מחר, ${datePart}`;
            return `${DAY_NAMES_HE[sel.getDay()]}, ${datePart}`;
          })()}
          <span className="text-sm font-normal text-muted-foreground ms-auto flex items-center gap-2">
            <button
              onClick={async () => {
                if (isSubscribed) {
                  await unsubscribe();
                } else {
                  await subscribe();
                }
              }}
              disabled={isLoading}
              className={`p-1.5 rounded-lg border transition-colors ${isSubscribed ? 'bg-primary/10 text-primary border-primary/40' : 'hover:bg-muted text-muted-foreground border-transparent'}`}
              title={isSubscribed ? 'התראות פעילות - לחץ לכיבוי' : 'אפשר התראות'}
            >
              {isSubscribed ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </button>
            <span className={`text-xs ${isSubscribed ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
              {isSubscribed ? 'התראות פעילות' : 'התראות כבויות'}
            </span>
            <button
              onClick={sendTestNotification}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
              title="בדיקת התראה"
            >
              <BellRing className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
              title="ייבוא מקובץ"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                const data = {
                  medications: medications.map(m => ({
                    name: m.name, dosage: m.dosage, times: m.times, frequency: m.frequency,
                    weekDay: m.weekDay, intervalDays: m.intervalDays, startDate: m.startDate,
                    endDate: m.endDate, notes: m.notes, reminderMinutes: m.reminderMinutes, instruction: m.instruction,
                  })),
                  appointments: appointments.map(a => ({
                    type: a.type, date: a.date, time: a.time, doctor: a.doctor,
                    location: a.location, notes: a.notes, reminderMinutes: a.reminderMinutes,
                  })),
                };
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = `pill-mate-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
                anchor.click();
                URL.revokeObjectURL(url);
              }}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
              title="ייצוא נתונים"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={signOut}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
              title="התנתק"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </span>
        </h1>


        <Tabs defaultValue="journal" dir="rtl" className="w-full">
          <TabsList className="w-full grid grid-cols-3 mb-3">
            {/* Right (RTL start) - Journal */}
            <TabsTrigger value="journal" className="flex items-center gap-1.5 data-[state=active]:text-medical data-[state=active]:shadow-sm">
              <BookOpen className="w-4 h-4" />
              יומן
            </TabsTrigger>
            {/* Center - Appointments */}
            <TabsTrigger value="appointments" className="flex items-center gap-1.5 justify-center data-[state=active]:text-purple data-[state=active]:shadow-sm">
              <Stethoscope className="w-4 h-4" />
              <span>תורים</span>
              {dailyAppointments.length > 0 && (
                <span className="inline-flex items-center justify-center min-w-[1.4rem] h-5 rounded-full bg-purple-100 text-purple-700 text-[0.7rem] px-1">
                  {dailyAppointments.length}
                </span>
              )}
            </TabsTrigger>
            {/* Left - Medications */}
            <TabsTrigger value="medications" className="flex items-center gap-1.5 data-[state=active]:text-success data-[state=active]:shadow-sm">
              <Pill className="w-4 h-4" />
              תרופות
            </TabsTrigger>
          </TabsList>

          <TabsContent value="journal">
            <CalendarTab
              appointments={appointments}
              selectedDate={selectedDate}
              onSelectDate={handleDateSelect}
              onAppointmentClick={(appt) => setActionTarget({ type: 'appt', appt })}
            />
          </TabsContent>

          <TabsContent value="medications">
            {dailyMedInstances.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-14 h-14 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center">
                  <Pill className="w-7 h-7 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-base">אין תרופות ליום זה</p>
                <p className="text-muted-foreground/60 text-sm mt-1">לחץ על + להוספת תרופה</p>
              </div>
            ) : (
              <div className="space-y-2">
                {dailyMedInstances.map((inst) => (
                  <MedicationCard
                    key={`${inst.medicationId}_${inst.time}`}
                    medication={inst.medication}
                    time={inst.time}
                    completed={!!completions[dateKey]?.[`${inst.medicationId}_${inst.time}`]}
                    onToggleComplete={() => toggleCompletion(inst.medicationId, inst.time, dateKey)}
                    onCardClick={() => setActionTarget({ type: 'med', med: inst.medication })}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="appointments">
            {dailyAppointments.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-14 h-14 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center">
                  <Stethoscope className="w-7 h-7 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-base">אין תורים ליום זה</p>
                <p className="text-muted-foreground/60 text-sm mt-1">לחץ על + להוספת תור</p>
              </div>
            ) : (
              <div className="space-y-2">
                {dailyAppointments.map((appt) => (
                  <AppointmentCard
                    key={appt.id}
                    appointment={appt}
                    canMarkArrival={canMarkArrival(appt)}
                    arrived={!!arrivals[dateKey]?.[appt.id]}
                    onMarkArrival={() => toggleArrival(appt.id, dateKey)}
                    onCardClick={() => setActionTarget({ type: 'appt', appt })}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* FAB */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        {showAddMenu && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <button
              onClick={() => { setShowAddMenu(false); setEditingAppt(null); setShowApptForm(true); }}
              className="flex items-center gap-2 bg-card px-5 py-3 rounded-2xl card-shadow border border-border whitespace-nowrap hover:bg-secondary transition-colors"
            >
              <Stethoscope className="w-5 h-5 text-medical" />
              <span className="font-medium text-sm">הוספת תור</span>
            </button>
            <button
              onClick={() => { setShowAddMenu(false); setEditingMed(null); setShowMedForm(true); }}
              className="flex items-center gap-2 bg-card px-5 py-3 rounded-2xl card-shadow border border-border whitespace-nowrap hover:bg-secondary transition-colors"
            >
              <Pill className="w-5 h-5 text-primary" />
              <span className="font-medium text-sm">הוספת תרופה</span>
            </button>
          </div>
        )}

        <button
          onClick={() => setShowAddMenu(!showAddMenu)}
          className={`w-14 h-14 rounded-full medical-gradient shadow-lg flex items-center justify-center transition-transform duration-200 hover:scale-105
            ${showAddMenu ? 'rotate-45' : ''}`}
        >
          <Plus className="w-7 h-7 text-primary-foreground" />
        </button>
      </div>

      {/* Overlay to close menu */}
      {showAddMenu && (
        <div className="fixed inset-0 z-30" onClick={() => setShowAddMenu(false)} />
      )}

      {/* Forms */}
      {showMedForm && (
        <AddMedicationForm
          onSave={handleSaveMed}
          onClose={() => { setShowMedForm(false); setEditingMed(null); }}
          editingMedication={editingMed}
        />
      )}
      <InstallBanner />

      <ImportDataDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onImportMedications={importMedications}
        onImportAppointments={importAppointments}
      />
      {showApptForm && (
        <AddAppointmentForm
          onSave={handleSaveAppt}
          onClose={() => { setShowApptForm(false); setEditingAppt(null); }}
          editingAppointment={editingAppt}
          defaultDate={dateKey}
        />
      )}

      {/* Action Sheet */}
      {actionTarget && (
        <ActionSheet
          title={actionTarget.type === 'med' ? actionTarget.med!.name : actionTarget.appt!.type}
          onEdit={() => {
            if (actionTarget.type === 'med') {
              setEditingMed(actionTarget.med!);
              setShowMedForm(true);
            } else {
              setEditingAppt(actionTarget.appt!);
              setShowApptForm(true);
            }
            setActionTarget(null);
          }}
          onDelete={() => {
            const id = actionTarget.type === 'med' ? actionTarget.med!.id : actionTarget.appt!.id;
            const name = actionTarget.type === 'med' ? actionTarget.med!.name : actionTarget.appt!.type;
            setConfirmDelete({ type: actionTarget.type, id, name });
            setActionTarget(null);
          }}
          onClose={() => setActionTarget(null)}
        />
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={!!confirmDelete}
        title={confirmDelete?.type === 'med' ? 'מחיקת תרופה' : 'ביטול תור'}
        description={`האם למחוק את "${confirmDelete?.name || ''}"? פעולה זו אינה ניתנת לביטול.`}
        onConfirm={async () => {
          if (confirmDelete) {
            if (confirmDelete.type === 'med') await deleteMedication(confirmDelete.id);
            else await deleteAppointment(confirmDelete.id);
          }
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
};

export default Index;
