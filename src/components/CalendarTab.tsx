import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, getDay, addMonths, subMonths, addWeeks, subWeeks, startOfDay } from 'date-fns';
import { ChevronRight, ChevronLeft, Clock, MapPin, CalendarDays } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

import type { Appointment } from '@/types';

interface CalendarTabProps {
  appointments: Appointment[];
  onSelectDate: (date: Date) => void;
  onAppointmentClick?: (appointment: Appointment) => void;
}

type ViewMode = 'monthly' | 'weekly';

const MONTH_NAMES_HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const DAY_NAMES_HE = ["יום א'", "יום ב'", "יום ג'", "יום ד'", "יום ה'", "יום ו'", 'שבת'];

const CalendarTab: React.FC<CalendarTabProps> = ({ appointments, onSelectDate, onAppointmentClick }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  // Use all appointments directly
  const filteredAppointments = appointments;

  // Get appointments for a specific date
  const getAppointmentsForDate = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return filteredAppointments.filter(a => a.date === dateKey);
  };

  // Generate calendar days
  const calendarDays = useMemo(() => {
    if (viewMode === 'monthly') {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
      const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

      const days: Date[] = [];
      let day = calStart;
      while (day <= calEnd) {
        days.push(day);
        day = addDays(day, 1);
      }
      return days;
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const days: Date[] = [];
      for (let i = 0; i < 7; i++) {
        days.push(addDays(weekStart, i));
      }
      return days;
    }
  }, [currentDate, viewMode]);

  const navigatePrev = () => {
    setSelectedDay(null);
    if (viewMode === 'monthly') setCurrentDate(subMonths(currentDate, 1));
    else setCurrentDate(subWeeks(currentDate, 1));
  };

  const navigateNext = () => {
    setSelectedDay(null);
    if (viewMode === 'monthly') setCurrentDate(addMonths(currentDate, 1));
    else setCurrentDate(addWeeks(currentDate, 1));
  };

  const handleDayClick = (day: Date) => {
    setSelectedDay(day);
    onSelectDate(day);
  };

  const selectedDayAppointments = selectedDay ? getAppointmentsForDate(selectedDay) : [];

  return (
    <div dir="rtl" className="space-y-3">
      {/* View Toggle + Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('monthly')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'monthly' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            חודשי
          </button>
          <button
            onClick={() => setViewMode('weekly')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'weekly' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            שבועי
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={navigateNext} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold min-w-[120px] text-center">
            {viewMode === 'monthly'
              ? `${MONTH_NAMES_HE[currentDate.getMonth()]} ${currentDate.getFullYear()}`
              : `שבוע ${format(calendarDays[0], 'dd/MM')} - ${format(calendarDays[6], 'dd/MM')}`
            }
          </span>
          <button onClick={navigatePrev} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-card rounded-2xl border border-border p-3 card-shadow">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {DAY_NAMES_HE.map((name, i) => (
            <div key={name} className={`text-center text-xs font-medium py-1 ${
              i === 6 ? 'text-destructive' : 'text-muted-foreground'
            }`}>
              {name}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7 gap-0.5">
          {calendarDays.map((day, idx) => {
            const dayAppts = getAppointmentsForDate(day);
            const isCurrentMonth = viewMode === 'monthly' ? isSameMonth(day, currentDate) : true;
            const isToday = isSameDay(day, new Date());
            const isSelected = selectedDay && isSameDay(day, selectedDay);
            const dayOfWeek = getDay(day); // 0=Sun, 6=Sat
            const isSaturday = dayOfWeek === 6;
            const isFriday = dayOfWeek === 5;

            return (
              <button
                key={idx}
                onClick={() => handleDayClick(day)}
                className={`relative p-1 rounded-xl text-center transition-all min-h-[44px] flex flex-col items-center justify-start gap-0.5
                  ${!isCurrentMonth ? 'opacity-30' : ''}
                  ${isToday && !isSelected ? 'bg-primary/10' : ''}
                  ${isSelected ? 'bg-primary text-primary-foreground' : isSaturday ? 'bg-destructive/10 hover:bg-destructive/20' : 'hover:bg-muted'}
                `}
              >
                <span className={`text-xs ${dayAppts.length > 0 ? 'font-bold' : 'font-medium'} ${isSelected ? 'text-primary-foreground' : isSaturday ? 'text-destructive' : ''}`}>
                  {format(day, 'd')}
                </span>
                {dayAppts.length > 0 && (
                  <div className="flex gap-0.5 flex-wrap justify-center items-center">
                    {dayAppts.slice(0, 3).map((_, i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-primary-foreground' : 'bg-medical'}`}
                      />
                    ))}
                    {dayAppts.length > 3 && (
                      <span className={`text-[9px] font-bold leading-none ${isSelected ? 'text-primary-foreground' : 'text-medical'}`}>
                        +{dayAppts.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Daily View (when a day is selected) */}
      {selectedDay && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-primary" />
            תורים ליום {format(selectedDay, 'dd/MM/yyyy')}
            {selectedDayAppointments.length > 0 && (
              <Badge variant="secondary" className="text-xs">{selectedDayAppointments.length}</Badge>
            )}
          </h3>

          {selectedDayAppointments.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              אין תורים ליום זה
            </div>
          ) : (
            <div className="space-y-2">
              {selectedDayAppointments
                .sort((a, b) => a.time.localeCompare(b.time))
                .map(appt => (
                  <div
                    key={appt.id}
                    className="bg-card rounded-xl p-3 border border-medical/20 card-shadow cursor-pointer active:scale-[0.98] transition-transform"
                    onClick={() => onAppointmentClick?.(appt)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-card-foreground">{appt.type}</h4>
                        <p className="text-xs text-muted-foreground">{appt.doctor}</p>
                        {appt.location && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <MapPin className="w-3 h-3" />
                            {appt.location}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm font-medium text-medical shrink-0">
                        <Clock className="w-3.5 h-3.5" />
                        {appt.time}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(CalendarTab);
