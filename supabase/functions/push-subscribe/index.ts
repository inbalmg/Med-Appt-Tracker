import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// Subscriptions are per-user, so the caller's identity has to come from the
// verified JWT -- never from the request body, which any caller can forge.
async function getUserId(req: Request, supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    if (req.method === 'GET') {
      // The VAPID keypair is app-wide, not per-user, so this needs no identity.
      const { data: existing } = await supabase
        .from('vapid_keys')
        .select('public_key')
        .limit(1)
        .single();

      if (existing) {
        return json({ publicKey: existing.public_key });
      }

      const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
      );

      const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
      const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

      const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyRaw)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      await supabase.from('vapid_keys').insert({
        public_key: publicKeyBase64,
        private_key: JSON.stringify(privateKeyJwk),
      });

      return json({ publicKey: publicKeyBase64 });
    }

    if (req.method === 'POST') {
      const userId = await getUserId(req, supabase);
      if (!userId) return json({ error: 'Unauthorized' }, 401);

      const { endpoint, p256dh, auth } = await req.json();

      if (!endpoint || !p256dh || !auth) {
        return json({ error: 'Missing subscription fields' }, 400);
      }

      // onConflict on endpoint (not on user_id): if this browser was previously
      // registered to another account, the subscription moves to the current
      // user rather than leaving a stale row that would deliver their reminders.
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({ endpoint, p256dh, auth, user_id: userId }, { onConflict: 'endpoint' });

      if (error) throw error;

      return json({ success: true });
    }

    if (req.method === 'DELETE') {
      const userId = await getUserId(req, supabase);
      if (!userId) return json({ error: 'Unauthorized' }, 401);

      const { endpoint } = await req.json();

      // Scoped to the caller so one user cannot unsubscribe another.
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', endpoint)
        .eq('user_id', userId);

      return json({ success: true });
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Push subscribe error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});
