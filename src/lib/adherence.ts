import { addDays, format, startOfDay } from 'date-fns';
import { getMedInstancesForDate } from '@/lib/schedule';
import type { CompletionRecord, Medication } from '@/types';

export interface DayAdherence {
  date: string;
  taken: number;
  total: number;
  pct: number;
}

export interface MedicationAdherence {
  medication: Medication;
  taken: number;
  total: number;
  pct: number;
}

export interface AdherenceStats {
  overallPct: number;
  taken: number;
  total: number;
  perDay: DayAdherence[];
  perMedication: MedicationAdherence[];
  currentStreak: number;
  hasData: boolean;
}

const pct = (taken: number, total: number) =>
  total === 0 ? 0 : Math.round((taken / total) * 100);

/**
 * Adherence over the last `days` days, ending today.
 *
 * Untaking a dose deletes its row rather than storing `completed: false`, so a
 * missed dose and a dose that was never scheduled look identical in
 * `completions`. Every count here therefore derives its denominator from the
 * schedule and only its numerator from `completions`.
 *
 * Today is counted, but doses later today are not yet missed — including them
 * would drag the number down all morning — so the day's denominator stops at
 * the current time. Future days are excluded entirely.
 */
export function computeAdherence(
  medications: Medication[],
  completions: CompletionRecord,
  days = 30
): AdherenceStats {
  const today = startOfDay(new Date());
  const nowHHMM = format(new Date(), 'HH:mm');

  const perDay: DayAdherence[] = [];
  const perMedMap = new Map<string, { taken: number; total: number }>();

  let taken = 0;
  let total = 0;

  for (let offset = days - 1; offset >= 0; offset--) {
    const date = addDays(today, -offset);
    const dateKey = format(date, 'yyyy-MM-dd');
    const isToday = offset === 0;

    const instances = getMedInstancesForDate(medications, date)
      // On today, a dose whose time has not arrived yet is not a miss.
      .filter(inst => !isToday || inst.time <= nowHHMM);

    const dayCompletions = completions[dateKey] ?? {};

    let dayTaken = 0;
    for (const inst of instances) {
      const wasTaken = dayCompletions[`${inst.medicationId}_${inst.time}`] === true;
      if (wasTaken) dayTaken++;

      const acc = perMedMap.get(inst.medicationId) ?? { taken: 0, total: 0 };
      acc.total++;
      if (wasTaken) acc.taken++;
      perMedMap.set(inst.medicationId, acc);
    }

    perDay.push({
      date: dateKey,
      taken: dayTaken,
      total: instances.length,
      pct: pct(dayTaken, instances.length),
    });

    taken += dayTaken;
    total += instances.length;
  }

  const perMedication: MedicationAdherence[] = medications
    .map(med => {
      const acc = perMedMap.get(med.id) ?? { taken: 0, total: 0 };
      return { medication: med, taken: acc.taken, total: acc.total, pct: pct(acc.taken, acc.total) };
    })
    // A medication with nothing scheduled in the window has no rate to report.
    .filter(m => m.total > 0)
    .sort((a, b) => a.pct - b.pct);

  return {
    overallPct: pct(taken, total),
    taken,
    total,
    perDay,
    perMedication,
    currentStreak: computeStreak(medications, completions, today),
    hasData: total > 0,
  };
}

/**
 * Consecutive fully-adhered days counting back from today.
 *
 * Today only extends the streak once every dose due so far has been taken, so a
 * streak never breaks on doses that are merely still ahead. Days with nothing
 * scheduled are skipped rather than counted or treated as a break. The scan is
 * bounded at a year to stay cheap.
 */
function computeStreak(
  medications: Medication[],
  completions: CompletionRecord,
  today: Date
): number {
  const nowHHMM = format(new Date(), 'HH:mm');
  let streak = 0;

  for (let offset = 0; offset < 365; offset++) {
    const date = addDays(today, -offset);
    const dateKey = format(date, 'yyyy-MM-dd');
    const isToday = offset === 0;

    const instances = getMedInstancesForDate(medications, date)
      .filter(inst => !isToday || inst.time <= nowHHMM);

    if (instances.length === 0) continue;

    const dayCompletions = completions[dateKey] ?? {};
    const allTaken = instances.every(
      inst => dayCompletions[`${inst.medicationId}_${inst.time}`] === true
    );

    if (!allTaken) break;
    streak++;
  }

  return streak;
}
