import React from 'react';
import { Stethoscope, Clock, MapPin, CheckCircle2 } from 'lucide-react';
import type { Appointment } from '@/types';

interface AppointmentCardProps {
  appointment: Appointment;
  canMarkArrival: boolean;
  arrived: boolean;
  onMarkArrival: () => void;
  onCardClick?: () => void;
}

const AppointmentCard: React.FC<AppointmentCardProps> = ({
  appointment,
  canMarkArrival,
  arrived,
  onMarkArrival,
  onCardClick,
}) => {
  return (
    <div dir="rtl" className="bg-card rounded-2xl p-4 card-shadow border border-medical/20 cursor-pointer active:scale-[0.98] transition-transform" onClick={onCardClick}>
      <div className="flex items-start gap-3">
        {/* Right zone: appointment details */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base text-card-foreground mb-1">
            {appointment.type}
          </h3>

          <div className="text-sm text-muted-foreground mb-1">
            <span className="font-medium text-card-foreground">{appointment.doctor}</span>
          </div>

          <div className="flex items-center gap-1.5 text-muted-foreground text-sm mb-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{appointment.time}</span>
          </div>

          {appointment.location && (
            <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
              <MapPin className="w-3.5 h-3.5" />
              <span>{appointment.location}</span>
            </div>
          )}

          {appointment.notes && (
            <p className="text-xs text-muted-foreground mt-2 bg-secondary rounded-lg px-2.5 py-1.5">
              {appointment.notes}
            </p>
          )}
        </div>

        {/* Left zone: icon + arrival button */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="w-10 h-10 rounded-xl medical-gradient flex items-center justify-center">
            <Stethoscope className="w-5 h-5 text-primary-foreground" />
          </div>
          {canMarkArrival && (
            <button
              onClick={(e) => { e.stopPropagation(); onMarkArrival(); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all
                ${arrived
                  ? 'bg-success text-success-foreground'
                  : 'bg-medical/10 text-medical hover:bg-medical/20'
                }`}
            >
              {arrived ? (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> הגעתי
                </span>
              ) : 'סמן הגעה'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppointmentCard;
