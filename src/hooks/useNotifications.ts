import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Medication, Appointment } from '@/types';

const SW_PATH = '/sw.js';
const CHECK_INTERVAL_MS = 60000; // Check every minute
const SYNC_DEBOUNCE_MS = 3000;

const isIosPwa = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = (navigator as any).standalone === true || 
    window.matchMedia('(display-mode: standalone)').matches;
  return isIos && isStandalone;
};

const isIosDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
};

const isIosNotStandalone = (): boolean => {
  return isIosDevice() && !isIosPwa();
};

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check if already subscribed
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      });
    }
  }, []);

  const subscribe = useCallback(async () => {
    // iOS requires PWA (installed to home screen) for Push
    if (isIosNotStandalone()) {
      alert('כדי לקבל התראות ב-iPhone, יש קודם להתקין את האפליקציה למסך הבית:\n\nלחצ/י על כפתור השיתוף ⬆️ → ״הוסף למסך הבית״');
      return false;
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('הדפדפן לא תומך בהתראות Push.\nב-iPhone נדרש iOS 16.4 ומעלה + התקנה למסך הבית.');
      return false;
    }

    setIsLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        if (perm === 'denied') {
          alert('התראות חסומות בדפדפן.\nכדי להפעיל אותן, יש לפתוח את הגדרות האתר בדפדפן ולהתיר התראות עבור pill-mate.');
        }
        setIsLoading(false);
        return false;
      }

      const registration = await navigator.serviceWorker.register(SW_PATH);
      await navigator.serviceWorker.ready;

      const { data: vapidData, error: vapidError } = await supabase.functions.invoke('push-subscribe', {
        method: 'GET',
      });

      if (vapidError || !vapidData?.publicKey) {
        throw new Error('Failed to get VAPID key');
      }

      const vapidPublicKey = urlBase64ToUint8Array(vapidData.publicKey);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKey.buffer as ArrayBuffer,
      });

      const subJson = subscription.toJSON();

      const { error: saveError } = await supabase.functions.invoke('push-subscribe', {
        method: 'POST',
        body: {
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
        },
      });

      if (saveError) throw saveError;

      setIsSubscribed(true);
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Push subscription error:', error);
      setIsLoading(false);
      return false;
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await supabase.functions.invoke('push-subscribe', {
          method: 'DELETE',
          body: { endpoint },
        });
      }
      // Clear pending reminders when bell is turned off
      await supabase.from('pending_reminders' as any).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      setIsSubscribed(false);
    } catch (error) {
      console.error('Unsubscribe error:', error);
    }
  }, []);

  // Sync reminders to DB so cron can send them even when app is closed
  const syncRemindersToDb = useCallback(async (medications: Medication[], appointments: Appointment[]) => {
    try {
      const now = new Date();
      const reminders: Array<{
        notification_key: string;
        trigger_at: string;
        title: string;
        body: string;
        tag: string;
        type: string;
      }> = [];

      // Process today and tomorrow
      for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
        const date = new Date(now);
        date.setDate(date.getDate() + dayOffset);
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const dayOfWeek = date.getDay();

        // Medications
        for (const med of medications) {
          if (!med.reminderMinutes || med.reminderMinutes <= 0) continue;
          if (dateStr < med.startDate) continue;
          if (med.endDate && dateStr > med.endDate) continue;

          let shouldInclude = false;
          if (med.frequency === 'daily') shouldInclude = true;
          else if (med.frequency === 'weekly' && med.weekDay === dayOfWeek) shouldInclude = true;
          else if (med.frequency === 'once' && dateStr === med.startDate) shouldInclude = true;
          else if (med.frequency === 'every_x_days' && med.intervalDays) {
            const start = new Date(med.startDate + 'T00:00:00');
            const current = new Date(dateStr + 'T00:00:00');
            const diff = Math.round((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            shouldInclude = diff >= 0 && diff % med.intervalDays === 0;
          }

          if (!shouldInclude) continue;

          for (const time of med.times) {
            const [h, m] = time.split(':').map(Number);
            const eventTime = new Date(date);
            eventTime.setHours(h, m, 0, 0);
            const triggerAt = new Date(eventTime.getTime() - med.reminderMinutes * 60000);

            // Skip if already in the past
            if (triggerAt.getTime() < now.getTime() - 120000) continue;

            const key = `med_${med.id}_${time}_${dateStr}`;
            reminders.push({
              notification_key: key,
              trigger_at: triggerAt.toISOString(),
              title: '💊 תזכורת תרופה',
              body: `${med.name}${med.dosage ? ' ' + med.dosage : ''} - ${time}${med.instruction ? '\n' + med.instruction : ''}`,
              tag: `med_${med.id}_${time}`,
              type: 'med',
            });
          }
        }

        // Appointments
        for (const appt of appointments) {
          if (!appt.reminderMinutes || appt.reminderMinutes <= 0) continue;
          if (appt.date !== dateStr) continue;

          const [h, m] = appt.time.split(':').map(Number);
          const eventTime = new Date(date);
          eventTime.setHours(h, m, 0, 0);
          const triggerAt = new Date(eventTime.getTime() - appt.reminderMinutes * 60000);

          if (triggerAt.getTime() < now.getTime() - 120000) continue;

          const key = `appt_${appt.id}_${dateStr}`;
          reminders.push({
            notification_key: key,
            trigger_at: triggerAt.toISOString(),
            title: '🏥 תזכורת תור',
            body: `${appt.type} - ${appt.time}${appt.doctor ? '\nאצל ' + appt.doctor : ''}${appt.location ? '\nב' + appt.location : ''}`,
            tag: `appt_${appt.id}`,
            type: 'appt',
          });
        }
      }

      // Upsert all reminders (ignore conflicts on existing keys)
      if (reminders.length > 0) {
        const { error } = await supabase
          .from('pending_reminders' as any)
          .upsert(reminders as any, { onConflict: 'notification_key', ignoreDuplicates: true });
        if (error) console.error('Sync reminders error:', error);
      }
    } catch (error) {
      console.error('syncRemindersToDb error:', error);
    }
  }, []);

  // Periodic check + sync (debounced)
  const startNotificationChecker = useCallback((getMedications: () => Medication[], getAppointments: () => Appointment[]) => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    const check = async () => {
      if (!isSubscribed) return;
      const meds = getMedications();
      const appts = getAppointments();
      try {
        // Sync to DB for cron-based delivery
        await syncRemindersToDb(meds, appts);
        
        // Also do client-side check as backup
        await supabase.functions.invoke('send-notifications', {
          body: { medications: meds, appointments: appts },
        });
      } catch (error) {
        console.error('Notification check error:', error);
      }
    };

    check();
    intervalRef.current = setInterval(check, CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isSubscribed, syncRemindersToDb]);

  // Debounced sync when data changes
  const debouncedSync = useCallback((medications: Medication[], appointments: Appointment[]) => {
    if (!isSubscribed) return;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      syncRemindersToDb(medications, appointments);
    }, SYNC_DEBOUNCE_MS);
  }, [isSubscribed, syncRemindersToDb]);

  const sendTestNotification = useCallback(async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      alert('הדפדפן לא תומך בהתראות בדיקה מקומיות.');
      return;
    }

    if (permission === 'default') {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        alert('כדי לקבל התראות, יש לאשר אותן בחלונית ההרשאה של הדפדפן.');
        return;
      }
    } else if (permission === 'denied') {
      alert('התראות חסומות בדפדפן.\nפתח/י את הגדרות האתר ואפשר/י התראות עבור pill-mate.');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('🔔 התראת בדיקה', {
        body: 'זוהי התראת בדיקה - אם אתה רואה את זה, ההתראות וה-Service Worker עובדים!',
        icon: '/placeholder.svg',
        badge: '/placeholder.svg',
        dir: 'rtl',
        lang: 'he',
        tag: 'test-local',
        requireInteraction: false,
      });
    } catch (error) {
      console.error('Test notification error:', error);
      alert('שגיאה בשליחת התראת הבדיקה');
    }
  }, [permission]);

  return {
    permission,
    isSubscribed,
    isLoading,
    isIos: isIosDevice(),
    isIosPwa: isIosPwa(),
    needsInstallFirst: isIosNotStandalone(),
    subscribe,
    unsubscribe,
    startNotificationChecker,
    debouncedSync,
    sendTestNotification,
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
