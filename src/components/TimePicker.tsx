import React, { useState, useRef, useEffect } from 'react';
import { Clock, ChevronUp, ChevronDown } from 'lucide-react';

interface TimePickerProps {
  value: string; // "HH:mm"
  onChange: (value: string) => void;
  className?: string;
}

const TimePicker: React.FC<TimePickerProps> = ({ value, onChange, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [h, m] = value.split(':');
  const hour = parseInt(h || '8', 10);
  const minute = parseInt(m || '0', 10);

  const [tempHour, setTempHour] = useState(hour);
  const [tempMinute, setTempMinute] = useState(minute);
  const [editingHour, setEditingHour] = useState(false);
  const [editingMinute, setEditingMinute] = useState(false);
  const [hourInput, setHourInput] = useState('');
  const [minuteInput, setMinuteInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTempHour(hour);
      setTempMinute(minute);
      setEditingHour(false);
      setEditingMinute(false);
    }
  }, [isOpen]);

  const incHour = () => setTempHour((prev) => (prev + 1) % 24);
  const decHour = () => setTempHour((prev) => (prev - 1 + 24) % 24);
  const incMinute = () => setTempMinute((prev) => (prev + 5) % 60);
  const decMinute = () => setTempMinute((prev) => (prev - 5 + 60) % 60);

  const handleHourInputBlur = () => {
    const val = parseInt(hourInput, 10);
    if (!isNaN(val) && val >= 0 && val <= 23) setTempHour(val);
    setEditingHour(false);
  };

  const handleMinuteInputBlur = () => {
    const val = parseInt(minuteInput, 10);
    if (!isNaN(val) && val >= 0 && val <= 59) setTempMinute(val);
    setEditingMinute(false);
  };

  const handleConfirm = () => {
    onChange(`${String(tempHour).padStart(2, '0')}:${String(tempMinute).padStart(2, '0')}`);
    setIsOpen(false);
  };

  const display = value || '08:00';

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`flex items-center justify-between w-full h-10 rounded-md border border-input bg-background px-3 text-base md:text-sm ring-offset-background transition-colors hover:bg-accent/50 ${className || ''}`}
      >
        <span className="font-medium text-foreground">{display}</span>
        <Clock className="w-4 h-4 text-muted-foreground" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[60] bg-foreground/40 flex items-end sm:items-center justify-center" onClick={() => setIsOpen(false)}>
          <div
            className="bg-background w-full sm:max-w-[280px] rounded-t-3xl sm:rounded-3xl p-5 animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-foreground text-center mb-5">בחירת שעה</h3>

            <div className="flex items-center justify-center gap-3" dir="ltr">
              {/* Hours */}
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={incHour}
                  className="p-2 rounded-xl hover:bg-muted active:bg-muted/80 transition-colors"
                >
                  <ChevronUp className="w-6 h-6 text-muted-foreground" />
                </button>
                <div
                  className="w-16 h-16 rounded-2xl bg-primary/10 border-2 border-primary/30 flex items-center justify-center cursor-text"
                  onClick={() => { setEditingHour(true); setHourInput(String(tempHour).padStart(2, '0')); }}
                >
                  {editingHour ? (
                    <input
                      autoFocus
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      value={hourInput}
                      onChange={(e) => setHourInput(e.target.value.replace(/\D/g, ''))}
                      onBlur={handleHourInputBlur}
                      onKeyDown={(e) => e.key === 'Enter' && handleHourInputBlur()}
                      className="w-full h-full text-center text-3xl font-bold text-primary tabular-nums bg-transparent outline-none"
                    />
                  ) : (
                    <span className="text-3xl font-bold text-primary tabular-nums">
                      {String(tempHour).padStart(2, '0')}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={decHour}
                  className="p-2 rounded-xl hover:bg-muted active:bg-muted/80 transition-colors"
                >
                  <ChevronDown className="w-6 h-6 text-muted-foreground" />
                </button>
                <span className="text-xs text-muted-foreground font-medium">שעה</span>
              </div>

              <span className="text-3xl font-bold text-primary mb-6">:</span>

              {/* Minutes */}
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={incMinute}
                  className="p-2 rounded-xl hover:bg-muted active:bg-muted/80 transition-colors"
                >
                  <ChevronUp className="w-6 h-6 text-muted-foreground" />
                </button>
                <div
                  className="w-16 h-16 rounded-2xl bg-primary/10 border-2 border-primary/30 flex items-center justify-center cursor-text"
                  onClick={() => { setEditingMinute(true); setMinuteInput(String(tempMinute).padStart(2, '0')); }}
                >
                  {editingMinute ? (
                    <input
                      autoFocus
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      value={minuteInput}
                      onChange={(e) => setMinuteInput(e.target.value.replace(/\D/g, ''))}
                      onBlur={handleMinuteInputBlur}
                      onKeyDown={(e) => e.key === 'Enter' && handleMinuteInputBlur()}
                      className="w-full h-full text-center text-3xl font-bold text-primary tabular-nums bg-transparent outline-none"
                    />
                  ) : (
                    <span className="text-3xl font-bold text-primary tabular-nums">
                      {String(tempMinute).padStart(2, '0')}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={decMinute}
                  className="p-2 rounded-xl hover:bg-muted active:bg-muted/80 transition-colors"
                >
                  <ChevronDown className="w-6 h-6 text-muted-foreground" />
                </button>
                <span className="text-xs text-muted-foreground font-medium">דקות</span>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-secondary text-secondary-foreground hover:bg-muted transition-colors"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold medical-gradient text-primary-foreground shadow-md hover:opacity-90 transition-opacity"
              >
                אישור
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TimePicker;
