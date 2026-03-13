import React from 'react';
import { Check, Sun, Moon } from 'lucide-react';
import type { Medication } from '@/types';

interface MedicationCardProps {
  medication: Medication;
  time: string;
  completed: boolean;
  onToggleComplete: () => void;
  onCardClick?: () => void;
}

const getTimeIcon = (time: string) => {
  const hour = parseInt(time.split(':')[0], 10);
  if (hour >= 5 && hour < 17) {
    return <Sun className="w-4 h-4 text-warning" />;
  }
  return <Moon className="w-4 h-4 text-primary" />;
};

const getInstructionColor = (instruction: string) => {
  if (instruction.includes('לפני')) return 'text-warning';
  if (instruction.includes('אחרי')) return 'text-medical';
  return 'text-muted-foreground';
};

const MedicationCard: React.FC<MedicationCardProps> = ({
  medication,
  time,
  completed,
  onToggleComplete,
  onCardClick,
}) => {
  return (
    <div
      dir="rtl"
      className={`bg-card rounded-xl px-3 py-2.5 card-shadow border transition-all duration-200 cursor-pointer active:scale-[0.98] ${completed ? 'opacity-60 border-success/30' : 'border-border'}`}
      onClick={onCardClick}
    >
      <div className="flex items-center gap-3">
        {/* Right zone: name + dosage + instruction */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={`font-semibold text-[15px] text-card-foreground leading-tight ${completed ? 'line-through' : ''}`}>
              {medication.name}
            </h3>
            {medication.dosage && (
              <span className="text-xs text-muted-foreground">{medication.dosage}</span>
            )}
          </div>
          {medication.instruction && (
            <p className={`text-xs mt-0.5 font-medium ${getInstructionColor(medication.instruction)}`}>
              {medication.instruction}
            </p>
          )}
        </div>

        {/* Left zone: time icon + time + checkbox */}
        <div className="flex items-center gap-1.5 shrink-0">
          {getTimeIcon(time)}
          <span className="text-sm font-medium text-muted-foreground">{time}</span>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onToggleComplete(); }}
          className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200
            ${completed
              ? 'bg-success border-success'
              : 'border-primary/40 hover:border-primary hover:bg-primary/10'
            }`}
        >
          {completed && <Check className="w-3.5 h-3.5 text-success-foreground" />}
        </button>
      </div>
    </div>
  );
};

export default MedicationCard;
