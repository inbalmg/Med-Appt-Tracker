import React from 'react';
import { Download, Share, X } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

const InstallBanner = () => {
  const { canInstall, showIosPrompt, isIosSafari, install, dismissIos } = useInstallPrompt();

  if (!canInstall) return null;

  // iOS: show manual instructions
  if (showIosPrompt) {
    return (
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md animate-in slide-in-from-bottom-4 fade-in duration-300">
        <div className="bg-primary text-primary-foreground rounded-2xl px-4 py-3 shadow-lg">
          <div className="flex items-center gap-3">
            <Download className="w-5 h-5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">התקן את האפליקציה</p>
            </div>
            <button
              onClick={dismissIos}
              className="p-1 rounded-full hover:bg-primary-foreground/20 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-2 text-xs leading-relaxed opacity-90 space-y-1">
            {isIosSafari ? (
              <>
                <p className="flex items-center gap-1.5">
                  <span>1. לחצ/י על כפתור השיתוף</span>
                  <Share className="w-3.5 h-3.5 inline" />
                  <span>בתחתית המסך</span>
                </p>
                <p>2. גללו למטה ובחרו ״הוסף למסך הבית״</p>
                <p>3. לחצו ״הוסף״ בפינה הימנית העליונה</p>
              </>
            ) : (
              <>
                <p>כדי להתקין, פתח/י את האתר ב-<strong>Safari</strong>:</p>
                <p className="flex items-center gap-1.5">
                  1. לחצ/י על כפתור השיתוף <Share className="w-3.5 h-3.5 inline" />
                </p>
                <p>2. בחרו ״הוסף למסך הבית״</p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Android / Desktop: use native prompt
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-primary text-primary-foreground rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg">
        <Download className="w-5 h-5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">התקן את האפליקציה</p>
          <p className="text-xs opacity-80">גישה מהירה ממסך הבית</p>
        </div>
        <button
          onClick={install}
          className="bg-primary-foreground text-primary text-sm font-bold px-4 py-1.5 rounded-xl shrink-0 hover:opacity-90 transition-opacity"
        >
          התקן
        </button>
        <button
          onClick={() => {}}
          className="p-1 rounded-full hover:bg-primary-foreground/20 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default InstallBanner;
