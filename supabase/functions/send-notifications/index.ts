import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ---- Web Push encryption using Web Crypto API (RFC 8291 / aes128gcm) ----

function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const len = arrays.reduce((a, b) => a + b.length, 0);
  const result = new Uint8Array(len);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const saltBuffer = (salt.length ? salt : new Uint8Array(32)).buffer as ArrayBuffer;
  const prkKey = await crypto.subtle.importKey('raw', saltBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, ikm.buffer as ArrayBuffer));
  
  const infoWithCounter = concat(info, new Uint8Array([1]));
  const hmacKey = await crypto.subtle.importKey('raw', prk.buffer as ArrayBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const result = new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, infoWithCounter.buffer as ArrayBuffer));
  return result.slice(0, length);
}

async function encryptPayload(
  clientPublicKeyB64: string,
  clientAuthB64: string,
  payload: Uint8Array
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const te = new TextEncoder();
  
  const clientPublicKeyBytes = base64UrlToBytes(clientPublicKeyB64);
  const clientAuthBytes = base64UrlToBytes(clientAuthB64);
  
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
  
  const serverPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeyPair.publicKey));
  
  const clientPublicKey = await crypto.subtle.importKey(
    'raw', clientPublicKeyBytes.buffer as ArrayBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false, []
  );
  
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientPublicKey },
    serverKeyPair.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);
  
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  const authInfo = concat(te.encode('WebPush: info\0'), clientPublicKeyBytes, serverPublicKeyRaw);
  const ikm = await hkdf(clientAuthBytes, sharedSecret, authInfo, 32);
  
  const cekInfo = concat(te.encode('Content-Encoding: aes128gcm\0'));
  const nonceInfo = concat(te.encode('Content-Encoding: nonce\0'));
  
  const contentKey = await hkdf(salt, ikm, cekInfo, 16);
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);
  
  const paddedPayload = concat(payload, new Uint8Array([2]));
  
  const aesKey = await crypto.subtle.importKey('raw', contentKey.buffer as ArrayBuffer, { name: 'AES-GCM' }, false, ['encrypt']);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce.buffer as ArrayBuffer }, aesKey, paddedPayload.buffer as ArrayBuffer)
  );
  
  const rs = 4096;
  const header = new Uint8Array(86);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, rs, false);
  header[20] = 65;
  header.set(serverPublicKeyRaw, 21);
  
  const ciphertext = concat(header, encrypted);
  
  return { ciphertext, salt, serverPublicKey: serverPublicKeyRaw };
}

function derToRaw(der: Uint8Array): Uint8Array {
  if (der[0] !== 0x30) throw new Error('Invalid DER signature');
  let offset = 2;
  
  if (der[offset] !== 0x02) throw new Error('Invalid DER r');
  offset++;
  const rLen = der[offset]; offset++;
  const rBytes = der.slice(offset, offset + rLen);
  offset += rLen;
  
  if (der[offset] !== 0x02) throw new Error('Invalid DER s');
  offset++;
  const sLen = der[offset]; offset++;
  const sBytes = der.slice(offset, offset + sLen);
  
  const raw = new Uint8Array(64);
  raw.set(rBytes.length > 32 ? rBytes.slice(rBytes.length - 32) : rBytes, 32 - Math.min(rBytes.length, 32));
  raw.set(sBytes.length > 32 ? sBytes.slice(sBytes.length - 32) : sBytes, 64 - Math.min(sBytes.length, 32));
  
  return raw;
}

async function createVapidAuth(endpoint: string, vapidPublicKey: string, vapidPrivateKeyJwk: any): Promise<string> {
  const privateKey = await crypto.subtle.importKey(
    'jwk', vapidPrivateKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  );
  
  const audience = new URL(endpoint).origin;
  const now = Math.floor(Date.now() / 1000);
  
  const headerB64 = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payloadB64 = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: now + 86400,
    sub: 'mailto:notifications@pill-mate.app',
  })));
  
  const unsignedToken = `${headerB64}.${payloadB64}`;
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privateKey,
      new TextEncoder().encode(unsignedToken)
    )
  );
  
  const rawSig = sig.length === 64 ? sig : derToRaw(sig);
  const sigB64 = bytesToBase64Url(rawSig);
  
  return `vapid t=${unsignedToken}.${sigB64}, k=${vapidPublicKey}`;
}

async function sendWebPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKeyJwk: any
): Promise<void> {
  const payloadBytes = new TextEncoder().encode(payload);
  
  const { ciphertext } = await encryptPayload(sub.p256dh, sub.auth, payloadBytes);
  const authorization = await createVapidAuth(sub.endpoint, vapidPublicKey, vapidPrivateKeyJwk);
  
  const response = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': authorization,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'TTL': '86400',
    },
    body: ciphertext.buffer as ArrayBuffer,
  });
  
  const responseText = await response.text();
  console.log(`Push response: ${response.status} ${responseText.substring(0, 200)}`);
  
  if (!response.ok) {
    throw new Error(`Push failed [${response.status}]: ${responseText}`);
  }
}

// ---- Main handler ----

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const isCron = body.source === 'cron';

    console.log(`[send-notifications] mode=${isCron ? 'cron' : 'client'}`);

    const { data: vapidData } = await supabase
      .from('vapid_keys')
      .select('*')
      .limit(1)
      .single();

    if (!vapidData) {
      console.error('No VAPID keys found');
      return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: subscriptions } = await supabase.from('push_subscriptions').select('*');

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No subscriptions');
      return new Response(JSON.stringify({ sent: 0, message: 'No subscriptions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Subscriptions: ${subscriptions.length}`);

    let notifications: { key: string; title: string; body: string; tag: string; type: string }[] = [];

    if (isCron) {
      const now = new Date().toISOString();
      const { data: dueReminders, error: remError } = await supabase
        .from('pending_reminders')
        .select('*')
        .eq('sent', false)
        .lte('trigger_at', now);

      if (remError) throw remError;

      if (!dueReminders || dueReminders.length === 0) {
        return new Response(JSON.stringify({ sent: 0, message: 'No reminders due' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Due reminders: ${dueReminders.length}`);
      notifications = dueReminders.map(r => ({ key: r.notification_key, title: r.title, body: r.body, tag: r.tag, type: r.type }));
      const ids = dueReminders.map(r => r.id);
      await supabase.from('pending_reminders').update({ sent: true }).in('id', ids);

    } else if (body.medications || body.appointments) {
      const { medications, appointments } = body;
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      if (medications) {
        for (const med of medications) {
          if (!med.reminderMinutes || med.reminderMinutes <= 0) continue;
          if (todayStr < med.startDate) continue;
          if (med.endDate && todayStr > med.endDate) continue;
          for (const time of med.times) {
            const [h, m] = time.split(':').map(Number);
            const eventTime = new Date(now); eventTime.setHours(h, m, 0, 0);
            const reminderTime = new Date(eventTime.getTime() - med.reminderMinutes * 60000);
            const diffMs = now.getTime() - reminderTime.getTime();
            if (diffMs >= 0 && diffMs <= 120000) {
              notifications.push({
                key: `med_${med.id}_${time}_${todayStr}`,
                title: `💊 תזכורת תרופה`,
                body: `${med.name}${med.dosage ? ' ' + med.dosage : ''} - ${time}${med.instruction ? '\n' + med.instruction : ''}`,
                tag: `med_${med.id}_${time}`,
                type: 'med',
              });
            }
          }
        }
      }

      if (appointments) {
        for (const appt of appointments) {
          if (!appt.reminderMinutes || appt.reminderMinutes <= 0) continue;
          if (appt.date !== todayStr) continue;
          const [h, m] = appt.time.split(':').map(Number);
          const eventTime = new Date(now); eventTime.setHours(h, m, 0, 0);
          const reminderTime = new Date(eventTime.getTime() - appt.reminderMinutes * 60000);
          const diffMs = now.getTime() - reminderTime.getTime();
          if (diffMs >= 0 && diffMs <= 120000) {
            notifications.push({
              key: `appt_${appt.id}_${todayStr}`,
              title: `🏥 תזכורת תור`,
              body: `${appt.type} - ${appt.time}${appt.doctor ? '\nאצל ' + appt.doctor : ''}${appt.location ? '\nב' + appt.location : ''}`,
              tag: `appt_${appt.id}`,
              type: 'appt',
            });
          }
        }
      }
    } else {
      return new Response(JSON.stringify({ sent: 0, message: 'No events' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Dedup for client mode
    if (notifications.length > 0 && !isCron) {
      const keys = notifications.map(n => n.key);
      const { data: existing } = await supabase.from('notification_log').select('notification_key').in('notification_key', keys);
      const sentKeys = new Set(existing?.map(e => e.notification_key) || []);
      notifications = notifications.filter(n => !sentKeys.has(n.key));
    }

    console.log(`Notifications to send: ${notifications.length}`);

    const vapidPrivateJwk = JSON.parse(vapidData.private_key);
    let sentCount = 0;
    const failedEndpoints: string[] = [];

    for (const notification of notifications) {
      const notifPayload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        tag: notification.tag,
        icon: '/placeholder.svg',
        type: notification.type,
        data: { type: notification.type },
      });

      for (const sub of subscriptions) {
        try {
          console.log(`Sending to ${sub.endpoint.substring(0, 80)}...`);
          await sendWebPush(sub, notifPayload, vapidData.public_key, vapidPrivateJwk);
          sentCount++;
        } catch (error: unknown) {
          const msg = (error as Error).message;
          console.error(`Push error: ${msg}`);
          if (msg.includes('410') || msg.includes('404')) {
            failedEndpoints.push(sub.endpoint);
          }
        }
      }

      if (!isCron) {
        await supabase.from('notification_log').upsert({ notification_key: notification.key });
      }
    }

    if (failedEndpoints.length > 0) {
      await supabase.from('push_subscriptions').delete().in('endpoint', failedEndpoints);
    }

    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
    await supabase.from('notification_log').delete().lt('sent_at', twoDaysAgo);
    await supabase.from('pending_reminders').delete().eq('sent', true).lt('trigger_at', twoDaysAgo);

    console.log(`Result: sent=${sentCount}, checked=${notifications.length}`);

    return new Response(JSON.stringify({ sent: sentCount, checked: notifications.length, mode: isCron ? 'cron' : 'client' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Send notifications error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
