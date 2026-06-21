import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import express, { Request, Response } from 'express';
import { z } from 'zod';

const SUPABASE_URL = 'https://bzfdisecqlkfqujvkyvi.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6ZmRpc2VjcWxrZnF1anZreXZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNDAzMjQsImV4cCI6MjA5NzYxNjMyNH0.GqZhWs1dU9f30pdipFZ1ae0Q1uF6F5Jq-TBhC1BbzLM';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const PORT = parseInt(process.env.PORT ?? '3000', 10);

// Service client — only for looking up user_id from api_key
const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function getUserIdFromApiKey(apiKey: string): Promise<string | null> {
  const { data } = await adminClient
    .from('user_api_keys')
    .select('user_id')
    .eq('api_key', apiKey)
    .single();
  return data?.user_id ?? null;
}

function makeUserClient(userId: string): SupabaseClient {
  // Use anon key but inject user_id claim via service role sign — simpler: just filter by user_id
  // We use the admin client but always scope queries to userId (RLS-equivalent)
  return adminClient;
}

function buildServer(userId: string): McpServer {
  const db = makeUserClient(userId);
  const server = new McpServer({ name: 'workout-tool', version: '1.0.0' });

  // ── get_exercises ─────────────────────────────────────────────────────────
  server.tool(
    'get_exercises',
    'Haal alle oefeningen op voor een trainingsschema',
    { workout_key: z.string().optional().describe('Schema letter, bijv. "A" of "B". Leeg = alles.') },
    async ({ workout_key }) => {
      let query = db.from('exercises').select('*').eq('user_id', userId).order('sort_order');
      if (workout_key) query = query.eq('workout_key', workout_key);
      const { data, error } = await query;
      if (error) return { content: [{ type: 'text', text: `Fout: ${error.message}` }] };
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  // ── add_exercise ──────────────────────────────────────────────────────────
  server.tool(
    'add_exercise',
    'Voeg een nieuwe oefening toe aan een trainingsschema',
    {
      name: z.string().describe('Naam van de oefening'),
      reps: z.string().describe('Herhalingen, bijv. "8 tot 12"'),
      sets: z.number().int().min(1).default(3).describe('Aantal sets'),
      focus: z.string().describe('Spiergroep omschrijving, bijv. "Borst en Triceps"'),
      muscle_group: z.enum(['quads','hamstrings','chest','lats','shoulders','core','grip','fullbody']),
      workout_key: z.string().describe('Schema letter, bijv. "A"'),
      tips: z.array(z.string()).optional().describe('Uitvoeringstips'),
      image: z.string().optional().describe('URL naar afbeelding'),
    },
    async (args) => {
      const { data: existing } = await db
        .from('exercises')
        .select('id')
        .eq('user_id', userId)
        .eq('workout_key', args.workout_key);
      const sort_order = existing?.length ?? 0;

      const { data, error } = await db
        .from('exercises')
        .insert({ ...args, user_id: userId, sort_order, tips: args.tips ?? [], image: args.image ?? '' })
        .select()
        .single();

      if (error) return { content: [{ type: 'text', text: `Fout: ${error.message}` }] };
      return { content: [{ type: 'text', text: `Oefening toegevoegd: ${JSON.stringify(data, null, 2)}` }] };
    },
  );

  // ── update_exercise ───────────────────────────────────────────────────────
  server.tool(
    'update_exercise',
    'Pas een bestaande oefening aan',
    {
      id: z.string().uuid().describe('ID van de oefening'),
      name: z.string().optional(),
      reps: z.string().optional(),
      sets: z.number().int().min(1).optional(),
      focus: z.string().optional(),
      muscle_group: z.enum(['quads','hamstrings','chest','lats','shoulders','core','grip','fullbody']).optional(),
      workout_key: z.string().optional(),
      tips: z.array(z.string()).optional(),
      image: z.string().optional(),
    },
    async ({ id, ...fields }) => {
      const updates = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
      const { data, error } = await db
        .from('exercises')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) return { content: [{ type: 'text', text: `Fout: ${error.message}` }] };
      return { content: [{ type: 'text', text: `Bijgewerkt: ${JSON.stringify(data, null, 2)}` }] };
    },
  );

  // ── delete_exercise ───────────────────────────────────────────────────────
  server.tool(
    'delete_exercise',
    'Verwijder een oefening',
    { id: z.string().uuid().describe('ID van de oefening') },
    async ({ id }) => {
      const { error } = await db
        .from('exercises')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      if (error) return { content: [{ type: 'text', text: `Fout: ${error.message}` }] };
      return { content: [{ type: 'text', text: 'Oefening verwijderd.' }] };
    },
  );

  // ── get_workout_history ───────────────────────────────────────────────────
  server.tool(
    'get_workout_history',
    'Haal trainingsgeschiedenis op met gewichten per set',
    { limit: z.number().int().min(1).max(50).default(10).describe('Aantal trainingen') },
    async ({ limit }) => {
      const { data, error } = await db
        .from('workout_logs')
        .select(`
          id, workout_title, created_at,
          log_exercises ( exercise_name, sort_order,
            log_sets ( set_number, weight, completed )
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) return { content: [{ type: 'text', text: `Fout: ${error.message}` }] };
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  // ── get_personal_records ──────────────────────────────────────────────────
  server.tool(
    'get_personal_records',
    'Geeft het hoogste gewicht per oefening over alle trainingen',
    {},
    async () => {
      const { data, error } = await db
        .from('workout_logs')
        .select(`
          log_exercises ( exercise_name,
            log_sets ( weight )
          )
        `)
        .eq('user_id', userId);

      if (error) return { content: [{ type: 'text', text: `Fout: ${error.message}` }] };

      const records: Record<string, number> = {};
      for (const log of data ?? []) {
        for (const ex of log.log_exercises ?? []) {
          const best = Math.max(...(ex.log_sets ?? []).map((s: { weight: string }) => parseFloat(s.weight) || 0));
          if (best > (records[ex.exercise_name] ?? 0)) records[ex.exercise_name] = best;
        }
      }

      const sorted = Object.entries(records)
        .sort((a, b) => b[1] - a[1])
        .map(([name, weight]) => `${name}: ${weight} kg`);

      return { content: [{ type: 'text', text: sorted.join('\n') || 'Nog geen trainingen gelogd.' }] };
    },
  );

  return server;
}

// ── HTTP server ───────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.all('/mcp', async (req: Request, res: Response) => {
  const apiKey =
    req.headers['x-api-key'] as string |
    (req.query.key as string) |
    undefined;

  if (!apiKey) {
    res.status(401).json({ error: 'API key vereist. Stuur X-Api-Key header of ?key= parameter.' });
    return;
  }

  const userId = await getUserIdFromApiKey(apiKey);
  if (!userId) {
    res.status(401).json({ error: 'Ongeldige API key.' });
    return;
  }

  const server = buildServer(userId);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  res.on('close', () => { server.close(); });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Workout MCP server draait op poort ${PORT}`);
  if (!SERVICE_ROLE_KEY) console.warn('WAARSCHUWING: SUPABASE_SERVICE_ROLE_KEY is niet ingesteld!');
});
