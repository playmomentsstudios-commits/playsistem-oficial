import { createHandler } from './handler.mjs';
const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
// Dedicated credential is stored only as a hash in the backend. Never frontend.
Deno.serve(createHandler({
  url, serviceKey,
  authenticate: async (token: string): Promise<boolean> => {
    if (!url || !serviceKey) throw new Error('Backend unavailable');
    const result = await fetch(`${url}/rest/v1/rpc/automation_authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({p_token: token}),
    });
    if (!result.ok) throw new Error('Authentication unavailable');
    return await result.json() === true;
  },
}));
