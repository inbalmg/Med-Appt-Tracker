import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { computeAdherence } from '@/lib/adherence';
import type { CompletionRecord, Medication } from '@/types';

// Fixed clock: doses at 08:00 are already due, doses at 20:00 are not.
const NOW = new Date('2026-07-15T12:00:00');

const med = (over: Partial<Medication> = {}): Medication => ({
  id: 'm1',
  name: 'Nexium',
  times: ['08:00'],
  frequency: 'daily',
  startDate: '2026-07-01',
  notes: '',
  reminderMinutes: 15,
  ...over,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('computeAdherence', () => {
  it('reports no data when there are no medications', () => {
    const stats = computeAdherence([], {}, 30);
    expect(stats.hasData).toBe(false);
    expect(stats.total).toBe(0);
    expect(stats.overallPct).toBe(0);
    expect(stats.perMedication).toEqual([]);
  });

  it('counts a taken dose', () => {
    // Completion keys are `${medicationId}_${time}`.
    const completions: CompletionRecord = { '2026-07-15': { 'm1_08:00': true } };

    const stats = computeAdherence([med()], completions, 1);
    expect(stats.total).toBe(1);
    expect(stats.taken).toBe(1);
    expect(stats.overallPct).toBe(100);
  });

  it('counts a missed dose against the rate', () => {
    const stats = computeAdherence([med()], {}, 1);
    expect(stats.total).toBe(1);
    expect(stats.taken).toBe(0);
    expect(stats.overallPct).toBe(0);
  });

  it('excludes doses later today that are not yet due', () => {
    // 20:00 has not arrived at the fixed 12:00 clock, so it must not count
    // as missed -- otherwise the rate sinks every morning.
    const stats = computeAdherence([med({ times: ['08:00', '20:00'] })], {}, 1);
    expect(stats.total).toBe(1);
  });

  it('excludes a medication whose endDate has passed', () => {
    const stats = computeAdherence([med({ endDate: '2026-07-10' })], {}, 1);
    expect(stats.total).toBe(0);
    expect(stats.hasData).toBe(false);
  });

  it('excludes days before the medication started', () => {
    // Window covers 5 days, but the med only starts on the last two.
    const stats = computeAdherence([med({ startDate: '2026-07-14' })], {}, 5);
    expect(stats.total).toBe(2);
  });

  it('honours weekly frequency', () => {
    // 2026-07-15 is a Wednesday (day 3).
    const wednesday = computeAdherence([med({ frequency: 'weekly', weekDay: 3 })], {}, 1);
    expect(wednesday.total).toBe(1);

    const thursday = computeAdherence([med({ frequency: 'weekly', weekDay: 4 })], {}, 1);
    expect(thursday.total).toBe(0);
  });

  it('honours every_x_days frequency', () => {
    // Starts 2026-07-01, every 2 days -> the 15th is 14 days on, so due.
    const due = computeAdherence([med({ frequency: 'every_x_days', intervalDays: 2 })], {}, 1);
    expect(due.total).toBe(1);

    // Every 4 days -> 14 is not a multiple of 4, so not due.
    const notDue = computeAdherence([med({ frequency: 'every_x_days', intervalDays: 4 })], {}, 1);
    expect(notDue.total).toBe(0);
  });

  it('drops medications with nothing scheduled in the window from the breakdown', () => {
    const active = med({ id: 'active' });
    const ended = med({ id: 'ended', endDate: '2026-07-10' });

    const stats = computeAdherence([active, ended], {}, 1);
    expect(stats.perMedication.map(m => m.medication.id)).toEqual(['active']);
  });

  it('sorts the breakdown worst-first', () => {
    const good = med({ id: 'good' });
    const bad = med({ id: 'bad' });
    const completions: CompletionRecord = { '2026-07-15': { 'good_08:00': true } };

    const stats = computeAdherence([good, bad], completions, 1);
    expect(stats.perMedication.map(m => m.medication.id)).toEqual(['bad', 'good']);
  });

  it('builds one perDay entry per requested day, oldest first', () => {
    const stats = computeAdherence([med()], {}, 7);
    expect(stats.perDay).toHaveLength(7);
    expect(stats.perDay[0].date).toBe('2026-07-09');
    expect(stats.perDay[6].date).toBe('2026-07-15');
  });
});

describe('currentStreak', () => {
  it('is zero when today has a missed dose', () => {
    const stats = computeAdherence([med()], {}, 30);
    expect(stats.currentStreak).toBe(0);
  });

  it('counts consecutive fully-adhered days', () => {
    const completions: CompletionRecord = {
      '2026-07-15': { 'm1_08:00': true },
      '2026-07-14': { 'm1_08:00': true },
      '2026-07-13': { 'm1_08:00': true },
      // 07-12 missed -> streak stops at 3
    };
    const stats = computeAdherence([med()], completions, 30);
    expect(stats.currentStreak).toBe(3);
  });

  it('does not break on doses still ahead today', () => {
    const completions: CompletionRecord = {
      '2026-07-15': { 'm1_08:00': true }, // 20:00 not yet due
      '2026-07-14': { 'm1_08:00': true, 'm1_20:00': true },
      '2026-07-13': {},
    };
    const stats = computeAdherence([med({ times: ['08:00', '20:00'] })], completions, 30);
    expect(stats.currentStreak).toBe(2);
  });

  it('skips days with nothing scheduled instead of breaking on them', () => {
    // Weekly on Wednesday: 07-15 and 07-08 are due, the days between are not.
    const completions: CompletionRecord = {
      '2026-07-15': { 'm1_08:00': true },
      '2026-07-08': { 'm1_08:00': true },
    };
    const stats = computeAdherence([med({ frequency: 'weekly', weekDay: 3 })], completions, 30);
    expect(stats.currentStreak).toBe(2);
  });
});
