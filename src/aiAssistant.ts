import Anthropic from '@anthropic-ai/sdk';
import { supabase } from './supabaseClient';

// ── Config ───────────────────────────────────────────────────────────────────
// Verander dit als je een ander Claude-model wilt gebruiken (bijv. "claude-sonnet-4-6"
// voor lagere kosten). Zie https://platform.claude.com/docs/en/about-claude/models
export const AI_MODEL = 'claude-opus-4-8';

const STORAGE_KEY = 'gymtracker_ai_api_key';

// De API-sleutel wordt ALLEEN lokaal in deze browser opgeslagen (localStorage).
// Hij wordt nooit naar onze servers (Supabase) verstuurd — alleen rechtstreeks
// naar Anthropic. Daardoor kan niemand anders hem lezen.
export function getApiKey(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}
export function setApiKey(key: string) {
  localStorage.setItem(STORAGE_KEY, key.trim());
}
export function clearApiKey() {
  localStorage.removeItem(STORAGE_KEY);
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const MUSCLE_GROUPS = ['quads', 'hamstrings', 'chest', 'lats', 'shoulders', 'core', 'grip', 'fullbody'];

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_exercises',
    description: 'Haal alle oefeningen van de gebruiker op, gegroepeerd per trainingsschema (workout_key, bijv. A of B).',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'add_exercise',
    description: 'Voeg een nieuwe oefening toe aan een trainingsschema.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Naam van de oefening, bijv. "Back Squat"' },
        reps: { type: 'string', description: 'Aantal herhalingen, bijv. "8 tot 12"' },
        sets: { type: 'integer', description: 'Aantal sets (1-10)' },
        focus: { type: 'string', description: 'Focus van de oefening, bijv. "Borst en Triceps"' },
        muscle_group: { type: 'string', enum: MUSCLE_GROUPS, description: 'Primaire spiergroep' },
        workout_key: { type: 'string', description: 'Letter van het trainingsschema, bijv. "A" of "B"' },
        tips: { type: 'array', items: { type: 'string' }, description: 'Uitvoeringstips (optioneel)' },
      },
      required: ['name', 'reps', 'sets', 'focus', 'muscle_group', 'workout_key'],
    },
  },
  {
    name: 'update_exercise',
    description: 'Werk een bestaande oefening bij. Gebruik eerst get_exercises om het id te vinden.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Het id van de oefening' },
        name: { type: 'string' },
        reps: { type: 'string' },
        sets: { type: 'integer' },
        focus: { type: 'string' },
        muscle_group: { type: 'string', enum: MUSCLE_GROUPS },
        workout_key: { type: 'string' },
        tips: { type: 'array', items: { type: 'string' } },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_exercise',
    description: 'Verwijder een oefening. Gebruik eerst get_exercises om het id te vinden.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Het id van de oefening' } },
      required: ['id'],
    },
  },
  {
    name: 'get_workout_history',
    description: 'Haal de afgeronde trainingen van de gebruiker op (laatste 50), inclusief gewichten en sets per oefening.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_personal_records',
    description: 'Bereken het zwaarste gewicht (persoonlijk record) per oefening op basis van de trainingsgeschiedenis.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
];

// ── Tool executor (draait client-side via Supabase, beschermd door RLS) ────────

async function executeTool(userId: string, name: string, input: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'get_exercises': {
      const { data, error } = await supabase
        .from('exercises')
        .select('id, name, reps, sets, focus, muscle_group, workout_key, tips, sort_order')
        .eq('user_id', userId)
        .order('workout_key')
        .order('sort_order');
      if (error) return `Fout: ${error.message}`;
      return JSON.stringify(data ?? []);
    }

    case 'add_exercise': {
      const workoutKey = String(input.workout_key);
      const { count } = await supabase
        .from('exercises')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('workout_key', workoutKey);
      const { data, error } = await supabase
        .from('exercises')
        .insert({
          user_id: userId,
          name: input.name,
          reps: input.reps,
          sets: input.sets ?? 3,
          focus: input.focus,
          muscle_group: input.muscle_group,
          workout_key: workoutKey,
          tips: input.tips ?? [],
          image: '',
          sort_order: count ?? 0,
        })
        .select()
        .single();
      if (error) return `Fout: ${error.message}`;
      return `Oefening toegevoegd: ${JSON.stringify(data)}`;
    }

    case 'update_exercise': {
      const { id, ...fields } = input;
      const updates: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined && v !== null) updates[k] = v;
      }
      const { data, error } = await supabase
        .from('exercises')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) return `Fout: ${error.message}`;
      return `Oefening bijgewerkt: ${JSON.stringify(data)}`;
    }

    case 'delete_exercise': {
      const { error } = await supabase
        .from('exercises')
        .delete()
        .eq('id', input.id)
        .eq('user_id', userId);
      if (error) return `Fout: ${error.message}`;
      return 'Oefening verwijderd.';
    }

    case 'get_workout_history': {
      const { data, error } = await supabase
        .from('workout_logs')
        .select('id, workout_title, created_at, log_exercises ( exercise_name, log_sets ( set_number, weight, completed ) )')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) return `Fout: ${error.message}`;
      return JSON.stringify(data ?? []);
    }

    case 'get_personal_records': {
      const { data, error } = await supabase
        .from('workout_logs')
        .select('log_exercises ( exercise_name, log_sets ( weight, completed ) )')
        .eq('user_id', userId);
      if (error) return `Fout: ${error.message}`;
      const prs: Record<string, number> = {};
      for (const log of data ?? []) {
        for (const le of (log.log_exercises ?? []) as { exercise_name: string; log_sets: { weight: string; completed: boolean }[] }[]) {
          for (const s of le.log_sets ?? []) {
            const w = parseFloat(s.weight) || 0;
            if (w > (prs[le.exercise_name] ?? 0)) prs[le.exercise_name] = w;
          }
        }
      }
      return JSON.stringify(prs);
    }

    default:
      return `Onbekende tool: ${name}`;
  }
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Je bent de AI-coach in een gym-tracker app. Je helpt de gebruiker met hun
trainingsschema's en data. Je hebt tools om oefeningen te bekijken, toe te voegen, te wijzigen
en te verwijderen, en om de trainingsgeschiedenis en persoonlijke records op te halen.

Belangrijke richtlijnen:
- Antwoord in het Nederlands, kort en duidelijk.
- Gebruik de tools om echte acties uit te voeren in de app. Verzin geen data — haal het op.
- Voordat je een oefening wijzigt of verwijdert, gebruik get_exercises om het juiste id te vinden.
- Bij het toevoegen van oefeningen: kies een passende spiergroep en geef nuttige uitvoeringstips.
- Als je iets in de app verandert, vat aan het eind kort samen wat je hebt gedaan.
- Bij data-analyse: wees concreet met getallen en geef bruikbare adviezen.`;

// ── Conversation runner (manual agentic loop) ─────────────────────────────────

export type ChatTurn =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string }
  | { role: 'action'; text: string };

export interface RunResult {
  apiMessages: Anthropic.MessageParam[];
  dataChanged: boolean;
}

const MUTATING_TOOLS = new Set(['add_exercise', 'update_exercise', 'delete_exercise']);
const TOOL_LABELS: Record<string, string> = {
  get_exercises: 'Oefeningen ophalen…',
  add_exercise: 'Oefening toevoegen…',
  update_exercise: 'Oefening bijwerken…',
  delete_exercise: 'Oefening verwijderen…',
  get_workout_history: 'Trainingsgeschiedenis ophalen…',
  get_personal_records: 'Persoonlijke records berekenen…',
};

/**
 * Voert één gebruikersbeurt uit: stuurt de conversatie naar Claude, voert tool-calls
 * uit tegen Supabase, en herhaalt tot Claude klaar is. `onTurn` wordt aangeroepen voor
 * elke zichtbare stap zodat de UI live kan updaten.
 */
export async function runConversation(
  apiKey: string,
  userId: string,
  history: Anthropic.MessageParam[],
  userText: string,
  onTurn: (turn: ChatTurn) => void,
): Promise<RunResult> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const messages: Anthropic.MessageParam[] = [...history, { role: 'user', content: userText }];
  onTurn({ role: 'user', text: userText });

  let dataChanged = false;

  for (let i = 0; i < 12; i++) {
    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });

    // Append de volledige assistant-content (incl. tool_use blocks) terug.
    messages.push({ role: 'assistant', content: response.content });

    // Toon tekst en registreer tool-acties.
    for (const block of response.content) {
      if (block.type === 'text' && block.text.trim()) {
        onTurn({ role: 'assistant', text: block.text });
      } else if (block.type === 'tool_use') {
        onTurn({ role: 'action', text: TOOL_LABELS[block.name] ?? block.name });
      }
    }

    if (response.stop_reason === 'refusal') {
      onTurn({ role: 'assistant', text: 'Dit verzoek kan ik niet uitvoeren.' });
      break;
    }

    if (response.stop_reason !== 'tool_use') break;

    // Voer alle tool-calls uit en stuur de resultaten terug in één user-bericht.
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        if (MUTATING_TOOLS.has(block.name)) dataChanged = true;
        const result = await executeTool(userId, block.name, block.input as Record<string, unknown>);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
      }
    }
    messages.push({ role: 'user', content: toolResults });
  }

  return { apiMessages: messages, dataChanged };
}
