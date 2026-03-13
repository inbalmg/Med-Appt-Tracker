import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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
      // Return VAPID public key, generate if not exists
      const { data: existing } = await supabase
        .from('vapid_keys')
        .select('public_key')
        .limit(1)
        .single();

      if (existing) {
        return new Response(JSON.stringify({ publicKey: existing.public_key }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Generate VAPID keys using Web Crypto API
      const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
      );

      const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
      const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

      const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyRaw)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      // Store both keys
      await supabase.from('vapid_keys').insert({
        public_key: publicKeyBase64,
        private_key: JSON.stringify(privateKeyJwk),
      });

      return new Response(JSON.stringify({ publicKey: publicKeyBase64 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST') {
      const { endpoint, p256dh, auth } = await req.json();

      if (!endpoint || !p256dh || !auth) {
        return new Response(JSON.stringify({ error: 'Missing subscription fields' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Upsert subscription
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({ endpoint, p256dh, auth }, { onConflict: 'endpoint' });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'DELETE') {
      const { endpoint } = await req.json();
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Push subscribe error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
