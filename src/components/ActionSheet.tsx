import React from 'react';
import { Edit, Trash2, X } from 'lucide-react';

interface ActionSheetProps {
  title: string;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const ActionSheet: React.FC<ActionSheetProps> = ({ title, onEdit, onDelete, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        dir="rtl"
        className="bg-background w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-4 animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-base text-foreground">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-1.5">
          <button
            onClick={onEdit}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary transition-colors text-start"
          >
            <Edit className="w-4.5 h-4.5 text-primary" />
            <span className="font-medium text-sm text-foreground">עריכה</span>
          </button>
          <button
            onClick={onDelete}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-destructive/10 transition-colors text-start"
          >
            <Trash2 className="w-4.5 h-4.5 text-destructive" />
            <span className="font-medium text-sm text-destructive">ביטול / מחיקה</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActionSheet;
