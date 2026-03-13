import React, { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import { format, addDays, isSameDay, isToday, differenceInDays } from 'date-fns';
import { he } from 'date-fns/locale';

interface DateStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  rangeStart: Date;
  onShiftRange: (direction: 'forward' | 'backward') => void;
  onGoToToday: () => void;
  showTodayButton: boolean;
}

const DAY_NAMES_HE = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

const DAYS_BEFORE = 30;
const DAYS_AFTER = 30;
const TOTAL_DAYS = DAYS_BEFORE + 1 + DAYS_AFTER; // 61 days centered on anchor

const DayButton = React.memo(({
  day,
  isSelected,
  isTodayDate,
  onSelect,
}: {
  day: Date;
  isSelected: boolean;
  isTodayDate: boolean;
  onSelect: () => void;
}) => (
  <button
    data-date={format(day, 'yyyy-MM-dd')}
    onClick={onSelect}
    className={`flex flex-col items-center py-2 px-2.5 rounded-xl transition-all duration-200 min-w-[44px] shrink-0
      ${isSelected
        ? 'bg-primary-foreground text-primary scale-105 shadow-lg'
        : isTodayDate
          ? 'bg-primary-foreground/25 text-primary-foreground'
          : 'text-primary-foreground/80 hover:bg-primary-foreground/15'
      }`}
  >
    <span className="text-xs font-medium mb-0.5 text-center">
      {DAY_NAMES_HE[day.getDay()]}
    </span>
    <span className="text-lg font-bold">
      {format(day, 'd')}
    </span>
    <div className="h-1.5 mt-0.5 flex items-center justify-center">
      {isTodayDate && (
        <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-primary' : 'bg-primary-foreground'}`} />
      )}
    </div>
  </button>
));

DayButton.displayName = 'DayButton';

const DateStrip: React.FC<DateStripProps> = ({ selectedDate, onSelectDate, rangeStart, onShiftRange, onGoToToday, showTodayButton }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Anchor date determines the center of the generated days array.
  // Only changes when selectedDate goes outside the current range.
  const [anchor, setAnchor] = useState(() => selectedDate);
  const prevSelectedRef = useRef(selectedDate);

  const days = useMemo(() => {
    const start = addDays(anchor, -DAYS_BEFORE);
    return Array.from({ length: TOTAL_DAYS }, (_, i) => addDays(start, i));
  }, [anchor]);

  // Check if selectedDate is within the current days range; if not, re-anchor
  useEffect(() => {
    const diff = differenceInDays(selectedDate, anchor);
    if (Math.abs(diff) > DAYS_BEFORE - 5) {
      setAnchor(selectedDate);
    }
  }, [selectedDate, anchor]);

  // Scroll to the selected date element
  const scrollToDate = useCallback((date: Date, smooth: boolean) => {
    if (!scrollRef.current) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    const el = scrollRef.current.querySelector(`[data-date="${dateStr}"]`) as HTMLElement | null;
    if (!el) return;

    const container = scrollRef.current;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    // Calculate offset to center the element in the container
    // In RTL, we need to account for direction
    const elCenter = elRect.left + elRect.width / 2;
    const containerCenter = containerRect.left + containerRect.width / 2;
    const scrollOffset = container.scrollLeft + (elCenter - containerCenter);

    container.scrollTo({
      left: scrollOffset,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, []);

  // On mount: instant scroll to selected date
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (!hasInitialized.current) {
      // Wait for DOM render
      requestAnimationFrame(() => {
        scrollToDate(selectedDate, false);
        hasInitialized.current = true;
      });
    }
  }, [days]); // re-run when days change (anchor changed)

  // On selectedDate change: smooth scroll
  useEffect(() => {
    if (!hasInitialized.current) return;
    const prev = prevSelectedRef.current;
    prevSelectedRef.current = selectedDate;

    if (isSameDay(prev, selectedDate)) return;

    // If anchor just changed, wait for DOM to update, then instant-position, then smooth won't be needed
    // since days array includes the new date
    requestAnimationFrame(() => {
      scrollToDate(selectedDate, true);
    });
  }, [selectedDate, scrollToDate]);

  // When anchor changes (days array rebuilt), instantly scroll to selected without animation
  const prevAnchorRef = useRef(anchor);
  useEffect(() => {
    if (isSameDay(prevAnchorRef.current, anchor)) return;
    prevAnchorRef.current = anchor;
    hasInitialized.current = false; // trigger re-init
  }, [anchor]);

  return (
    <div className="medical-gradient rounded-b-2xl px-3 pt-4 pb-5 card-shadow">
      <div className="flex items-center justify-center mb-3 px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-primary-foreground font-semibold text-lg">
            {format(selectedDate, 'MMMM yyyy', { locale: he })}
          </h2>
          {showTodayButton && (
            <button
              onClick={onGoToToday}
              className="text-xs font-medium bg-primary-foreground/25 hover:bg-primary-foreground/35 text-primary-foreground px-2.5 py-1 rounded-full transition-colors"
            >
              היום
            </button>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        dir="rtl"
        className="flex gap-1.5 overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {days.map((day) => (
          <DayButton
            key={day.toISOString()}
            day={day}
            isSelected={isSameDay(day, selectedDate)}
            isTodayDate={isToday(day)}
            onSelect={() => onSelectDate(day)}
          />
        ))}
      </div>
    </div>
  );
};

export default React.memo(DateStrip);
