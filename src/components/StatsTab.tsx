import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { format, parseISO } from 'date-fns';
import { ChartColumn, Flame, TrendingUp } from 'lucide-react';
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart';
import { computeAdherence } from '@/lib/adherence';
import type { CompletionRecord, Medication } from '@/types';

interface StatsTabProps {
  medications: Medication[];
  completions: CompletionRecord;
}

const RANGES = [
  { days: 7, label: '7 ימים' },
  { days: 30, label: '30 יום' },
  { days: 90, label: '3 חודשים' },
] as const;

const chartConfig = {
  pct: { label: 'היענות', color: 'hsl(var(--medical))' },
} satisfies ChartConfig;

// Green when adhering well, amber when slipping, red when it needs attention.
const rateColor = (pct: number) => {
  if (pct >= 80) return 'text-success';
  if (pct >= 50) return 'text-warning';
  return 'text-destructive';
};

const rateBarColor = (pct: number) => {
  if (pct >= 80) return 'bg-success';
  if (pct >= 50) return 'bg-warning';
  return 'bg-destructive';
};

const StatsTab: React.FC<StatsTabProps> = ({ medications, completions }) => {
  const [days, setDays] = useState<number>(30);

  const stats = useMemo(
    () => computeAdherence(medications, completions, days),
    [medications, completions, days]
  );

  const chartData = useMemo(
    () =>
      stats.perDay.map(d => ({
        date: d.date,
        label: format(parseISO(d.date), 'd/M'),
        pct: d.pct,
        taken: d.taken,
        total: d.total,
      })),
    [stats.perDay]
  );

  if (!stats.hasData) {
    return (
      <div dir="rtl" className="bg-card rounded-xl border border-border p-8 text-center">
        <ChartColumn className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-medium text-foreground mb-1">אין עדיין נתוני היענות</p>
        <p className="text-xs text-muted-foreground">
          הוסיפו תרופות וסמנו אותן כנלקחו — הסטטיסטיקות יופיעו כאן
        </p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-3">
      {/* Range picker */}
      <div className="flex gap-1.5">
        {RANGES.map(r => (
          <button
            key={r.days}
            onClick={() => setDays(r.days)}
            className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${
              days === r.days
                ? 'bg-medical text-medical-foreground border-medical'
                : 'bg-card text-muted-foreground border-border hover:bg-muted'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 card-shadow">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">היענות כוללת</span>
          </div>
          <div className={`text-3xl font-bold ${rateColor(stats.overallPct)}`}>
            {stats.overallPct}%
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {stats.taken} מתוך {stats.total} מנות
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4 card-shadow">
          <div className="flex items-center gap-1.5 mb-1">
            <Flame className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">רצף נוכחי</span>
          </div>
          <div className="text-3xl font-bold text-foreground">{stats.currentStreak}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {stats.currentStreak === 1 ? 'יום מלא ברציפות' : 'ימים מלאים ברציפות'}
          </div>
        </div>
      </div>

      {/* Daily trend */}
      <div className="bg-card rounded-xl border border-border p-4 card-shadow">
        <h3 className="text-sm font-medium text-foreground mb-3">היענות יומית</h3>
        <ChartContainer config={chartConfig} className="aspect-[16/7] w-full">
          <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            {/* reversed: the app is dir="rtl", so time must run right-to-left */}
            <XAxis
              dataKey="label"
              reversed
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis
              orientation="right"
              domain={[0, 100]}
              ticks={[0, 50, 100]}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `${v}%`}
            />
            <ChartTooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as (typeof chartData)[number];
                return (
                  <div dir="rtl" className="bg-popover border border-border rounded-lg px-2.5 py-1.5 text-xs shadow-md">
                    <div className="font-medium text-popover-foreground">
                      {format(parseISO(d.date), 'd/M/yyyy')}
                    </div>
                    <div className="text-muted-foreground">
                      {d.taken} מתוך {d.total} — {d.pct}%
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="pct" fill="var(--color-pct)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </div>

      {/* Per-medication breakdown, worst first */}
      <div className="bg-card rounded-xl border border-border p-4 card-shadow">
        <h3 className="text-sm font-medium text-foreground mb-3">לפי תרופה</h3>
        <div className="space-y-3">
          {stats.perMedication.map(m => (
            <div key={m.medication.id}>
              <div className="flex items-baseline justify-between mb-1 gap-2">
                <span className="text-sm text-foreground truncate">
                  {m.medication.name}
                  {m.medication.dosage && (
                    <span className="text-muted-foreground text-xs"> {m.medication.dosage}</span>
                  )}
                </span>
                <span className={`text-sm font-semibold shrink-0 ${rateColor(m.pct)}`}>
                  {m.pct}%
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${rateBarColor(m.pct)}`}
                  style={{ width: `${m.pct}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {m.taken} מתוך {m.total} מנות
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StatsTab;
