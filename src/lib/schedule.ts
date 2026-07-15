import { format, getDay, parseISO, startOfDay } from 'date-fns';
import type { Medication, MedicationInstance } from '@/types';

/**
 * Expands the medication list into the individual doses due on `date`.
 *
 * This is the only definition of "which doses are due when", so it is also the
 * denominator for adherence: a skipped dose leaves no row behind, so the number
 * expected on a day can only be derived from the schedule, never from what was
 * recorded.
 */
export function getMedInstancesForDate(
  medications: Medication[],
  date: Date
): MedicationInstance[] {
  const instances: MedicationInstance[] = [];
  const dateStr = format(date, 'yyyy-MM-dd');

  medications.forEach(med => {
    if (dateStr < med.startDate) return;
    if (med.endDate && dateStr > med.endDate) return;

    let active = false;
    if (med.frequency === 'daily') {
      active = true;
    } else if (med.frequency === 'weekly') {
      active = getDay(date) === med.weekDay;
    } else if (med.frequency === 'once') {
      active = dateStr === med.startDate;
    } else if (med.frequency === 'every_x_days' && med.intervalDays) {
      const start = startOfDay(parseISO(med.startDate));
      const diff = Math.round(
        (startOfDay(date).getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      );
      active = diff >= 0 && diff % med.intervalDays === 0;
    }

    if (active) {
      med.times.forEach(time => {
        instances.push({ medicationId: med.id, time, medication: med });
      });
    }
  });

  return instances.sort((a, b) => a.time.localeCompare(b.time));
}
