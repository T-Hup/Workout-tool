import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  ChevronLeft, Dumbbell, Timer, Target, CheckCircle2, Circle,
  Play, Pause, RotateCcw, ChevronDown, ChevronUp, Calendar,
  Check, Trash2, Award, Plus, Pencil, X, LogOut, User,
  Bot, Copy, Terminal, Sparkles,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

const AiChat = lazy(() => import('./AiChat'));

// ── Types ──────────────────────────────────────────────────────────────────────

interface Exercise {
  id: string;
  name: string;
  reps: string;
  sets: number;
  focus: string;
  muscle_group: string;
  image: string;
  tips: string[];
  workout_key: string;
  sort_order: number;
}

interface SetLog {
  set_number: number;
  weight: string;
  completed: boolean;
}

interface WorkoutLog {
  id: string;
  workout_title: string;
  created_at: string;
  log_exercises: { exercise_name: string; log_sets: SetLog[] }[];
}

type CompletedSets = Record<string, boolean>;
type ExerciseWeights = Record<string, Record<string, string>>;

// ── Defaults seeded for new users ─────────────────────────────────────────────

const DEFAULT_EXERCISES: Omit<Exercise, 'id' | 'sort_order'>[] = [
  {
    name: 'Back Squat', reps: '5 tot 8', sets: 3, focus: 'Bovenbenen en Billen',
    muscle_group: 'quads', workout_key: 'A',
    image: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=600&q=80',
    tips: ['Plaats voeten op schouderbreedte', 'Houd de rug recht', 'Zak tot de heupen onder de knieën zijn'],
  },
  {
    name: 'Dumbbell Bench Press', reps: '8 tot 12', sets: 3, focus: 'Borst en Triceps',
    muscle_group: 'chest', workout_key: 'A',
    image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=600&q=80',
    tips: ['Duw de schouderbladen in het bankje', 'Breng dumbbells gecontroleerd omlaag', 'Strek armen krachtig uit'],
  },
  {
    name: 'Lat Pulldown', reps: '8 tot 12', sets: 3, focus: 'Bovenrug en Breedte',
    muscle_group: 'lats', workout_key: 'A',
    image: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&w=600&q=80',
    tips: ['Trek de stang naar de bovenkant borst', 'Leun heel licht naar achteren', 'Knijp de schouderbladen samen'],
  },
  {
    name: 'Dumbbell Romanian Deadlift', reps: '8 tot 10', sets: 3, focus: 'Hamstrings en Billen',
    muscle_group: 'hamstrings', workout_key: 'A',
    image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=600&q=80',
    tips: ['Duw de heupen maximaal naar achteren', 'Houd de dumbbells dicht bij je benen', 'Lichte buiging in de knieën houden'],
  },
  {
    name: 'Dumbbell Lateral Raises', reps: '12 tot 15', sets: 3, focus: 'Zijkant Schouders',
    muscle_group: 'shoulders', workout_key: 'A',
    image: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=600&q=80',
    tips: ['Leun heel licht voorover', 'Breng dumbbells zijwaarts omhoog', 'Houd je ellebogen iets gebogen'],
  },
  {
    name: 'Plank', reps: '45 tot 60 seconden', sets: 3, focus: 'Core en Buikspieren',
    muscle_group: 'core', workout_key: 'A',
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=600&q=80',
    tips: ['Houd je lichaam in een rechte lijn', 'Span je buik en billen hard aan', 'Kijk naar de grond vlak voor je'],
  },
  {
    name: 'Trap Bar Deadlift', reps: '5 tot 8', sets: 3, focus: 'Heel lichaam en Grip',
    muscle_group: 'fullbody', workout_key: 'B',
    image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=600&q=80',
    tips: ['Stel je voeten in het midden op', 'Houd je borst op en rug recht', 'Duw de grond hard weg om te starten'],
  },
  {
    name: 'Incline Dumbbell Press', reps: '8 tot 12', sets: 3, focus: 'Bovenkant Borst',
    muscle_group: 'chest', workout_key: 'B',
    image: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=600&q=80',
    tips: ['Zet het bankje op dertig graden', 'Breng de gewichten tot borsthoogte', 'Duw omhoog in een lichte boog'],
  },
  {
    name: 'Chest-Supported Row', reps: '8 tot 12', sets: 3, focus: 'Middenrug en Dikte',
    muscle_group: 'lats', workout_key: 'B',
    image: 'https://images.unsplash.com/photo-1605296867304-46d5465a25f1?auto=format&fit=crop&w=600&q=80',
    tips: ['Druk je borst stevig tegen het kussen', 'Trek ellebogen ver naar achteren', 'Laat het gewicht rustig zakken'],
  },
  {
    name: 'Bulgarian Split Squat', reps: '8 tot 10 per been', sets: 3, focus: 'Benen en Balans',
    muscle_group: 'quads', workout_key: 'B',
    image: 'https://images.unsplash.com/photo-1434608519344-49d77a699e1d?auto=format&fit=crop&w=600&q=80',
    tips: ['Plaats een voet achter je op een bankje', 'Zak recht naar beneden', 'Houd je voorste knie stabiel'],
  },
  {
    name: 'Face Pulls', reps: '12 tot 15', sets: 3, focus: 'Achterkant Schouders',
    muscle_group: 'shoulders', workout_key: 'B',
    image: 'https://images.unsplash.com/photo-1593079831268-3381b0db4a77?auto=format&fit=crop&w=600&q=80',
    tips: ['Trek het touw richting je voorhoofd', 'Trek je handen aan het eind uit elkaar', 'Houd de ellebogen hoog'],
  },
  {
    name: "Farmer's Carries", reps: '30 tot 40 meter', sets: 3, focus: 'Gripkracht en Core',
    muscle_group: 'grip', workout_key: 'B',
    image: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=600&q=80',
    tips: ['Pak zware dumbbells of gewichten', 'Loop met actieve, trotse borst', 'Zet kleine, gecontroleerde stappen'],
  },
];

const MUSCLE_GROUPS = [
  { value: 'quads', label: 'Quads' },
  { value: 'hamstrings', label: 'Hamstrings' },
  { value: 'chest', label: 'Borst' },
  { value: 'lats', label: 'Rug (breed)' },
  { value: 'shoulders', label: 'Schouders' },
  { value: 'core', label: 'Core' },
  { value: 'grip', label: 'Grip / Onderarm' },
  { value: 'fullbody', label: 'Heel lichaam' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── MuscleMap ──────────────────────────────────────────────────────────────────

const ACTIVE = '#f97316';
const BASE = '#475569';

function MuscleMap({ highlight }: { highlight: string }) {
  const on = (groups: string[]) => (groups.includes(highlight) ? ACTIVE : BASE);
  return (
    <div className="flex justify-center gap-8 bg-slate-900 p-4 rounded-3xl">
      <div className="flex flex-col items-center">
        <span className="text-[10px] text-slate-400 font-bold mb-2">VOORKANT</span>
        <svg viewBox="0 0 100 220" className="w-20 h-40">
          <circle cx="50" cy="20" r="12" fill={BASE} />
          <rect x="47" y="32" width="6" height="8" fill={BASE} />
          <path d="M25,45 Q50,40 75,45 L70,55 L30,55 Z" fill={on(['shoulders', 'fullbody'])} />
          <path d="M30,55 Q50,55 70,55 L68,80 L32,80 Z" fill={on(['chest'])} />
          <rect x="34" y="80" width="32" height="35" fill={on(['core', 'fullbody'])} />
          <path d="M25,45 L15,100 L22,100 L30,55 Z" fill={on(['grip'])} />
          <path d="M75,45 L85,100 L78,100 L70,55 Z" fill={on(['grip'])} />
          <path d="M34,115 L28,165 L46,165 L48,115 Z" fill={on(['quads', 'fullbody'])} />
          <path d="M66,115 L72,165 L54,165 L52,115 Z" fill={on(['quads', 'fullbody'])} />
          <path d="M28,165 L32,210 L44,210 L46,165 Z" fill={BASE} />
          <path d="M72,165 L68,210 L56,210 L54,165 Z" fill={BASE} />
        </svg>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-[10px] text-slate-400 font-bold mb-2">ACHTERKANT</span>
        <svg viewBox="0 0 100 220" className="w-20 h-40">
          <circle cx="50" cy="20" r="12" fill={BASE} />
          <rect x="47" y="32" width="6" height="8" fill={BASE} />
          <path d="M25,45 Q50,40 75,45 L70,55 L30,55 Z" fill={on(['shoulders', 'fullbody'])} />
          <path d="M30,55 Q50,55 70,55 L65,90 L35,90 Z" fill={on(['lats', 'fullbody'])} />
          <rect x="35" y="90" width="30" height="25" fill={on(['lats', 'fullbody'])} />
          <path d="M33,115 Q50,120 67,115 L64,135 Q50,140 36,135 Z" fill={on(['hamstrings', 'quads', 'fullbody'])} />
          <path d="M34,135 L30,175 L46,175 L48,135 Z" fill={on(['hamstrings', 'fullbody'])} />
          <path d="M66,135 L70,175 L54,175 L52,135 Z" fill={on(['hamstrings', 'fullbody'])} />
          <path d="M30,175 L33,210 L44,210 L46,175 Z" fill={BASE} />
          <path d="M70,175 L67,210 L56,210 L54,175 Z" fill={BASE} />
        </svg>
      </div>
    </div>
  );
}

// ── Toast ──────────────────────────────────────────────────────────────────────

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed top-6 left-4 right-4 z-50 bg-slate-900 border border-slate-700 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-slide-in">
      <div className="p-1 bg-blue-500/10 rounded-lg shrink-0">
        <Check className="text-blue-400 w-5 h-5" />
      </div>
      <span className="text-xs font-bold text-white">{message}</span>
    </div>
  );
}

// ── Auth Screen ────────────────────────────────────────────────────────────────

function AuthScreen({ onAuth }: { onAuth: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else onAuth();
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setDone(true);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="max-w-sm w-full space-y-8">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600/20 p-3 rounded-2xl">
            <Dumbbell className="text-blue-500 w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Gym Tracker</h1>
            <p className="text-xs text-slate-400">Jouw progressie, altijd bewaard</p>
          </div>
        </div>

        {done ? (
          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-5 text-sm text-emerald-300">
            Check je e-mail voor een bevestigingslink, dan kun je inloggen.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <h2 className="text-lg font-black">
              {mode === 'login' ? 'Inloggen' : 'Account aanmaken'}
            </h2>
            <input
              type="email"
              placeholder="E-mailadres"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
            />
            <input
              type="password"
              placeholder="Wachtwoord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
            />
            {error && <p className="text-xs text-rose-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 active:bg-blue-700 p-4 rounded-2xl font-black text-sm disabled:opacity-50"
            >
              {loading ? 'Laden…' : mode === 'login' ? 'Inloggen' : 'Account aanmaken'}
            </button>
            <button
              type="button"
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
              className="w-full text-xs text-slate-400 underline"
            >
              {mode === 'login' ? 'Nog geen account? Registreren' : 'Al een account? Inloggen'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Exercise Form Modal ────────────────────────────────────────────────────────

interface ExerciseFormProps {
  exercise?: Exercise;
  workoutKey: string;
  onSave: (ex: Partial<Exercise>) => Promise<void>;
  onClose: () => void;
}

function ExerciseForm({ exercise, workoutKey, onSave, onClose }: ExerciseFormProps) {
  const [name, setName] = useState(exercise?.name ?? '');
  const [reps, setReps] = useState(exercise?.reps ?? '');
  const [sets, setSets] = useState(String(exercise?.sets ?? 3));
  const [focus, setFocus] = useState(exercise?.focus ?? '');
  const [muscleGroup, setMuscleGroup] = useState(exercise?.muscle_group ?? 'quads');
  const [image, setImage] = useState(exercise?.image ?? '');
  const [tipsRaw, setTipsRaw] = useState((exercise?.tips ?? []).join('\n'));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim() || !reps.trim() || !focus.trim()) return;
    setSaving(true);
    await onSave({
      name: name.trim(),
      reps: reps.trim(),
      sets: parseInt(sets) || 3,
      focus: focus.trim(),
      muscle_group: muscleGroup,
      image: image.trim(),
      tips: tipsRaw.split('\n').map((t) => t.trim()).filter(Boolean),
      workout_key: workoutKey,
    });
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-black">{exercise ? 'Oefening bewerken' : 'Oefening toevoegen'}</h3>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-800"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          <input
            placeholder="Naam *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
          />
          <input
            placeholder="Herhalingen (bijv. 8 tot 12) *"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
          />
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Aantal sets</label>
              <input
                type="number"
                min="1"
                max="10"
                value={sets}
                onChange={(e) => setSets(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Spiergroep</label>
              <select
                value={muscleGroup}
                onChange={(e) => setMuscleGroup(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
              >
                {MUSCLE_GROUPS.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </div>
          </div>
          <input
            placeholder="Focus (bijv. Borst en Triceps) *"
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
          />
          <input
            placeholder="Afbeelding URL (optioneel)"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
          />
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Tips (één per regel)</label>
            <textarea
              rows={3}
              value={tipsRaw}
              onChange={(e) => setTipsRaw(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-800 p-3 rounded-2xl text-xs font-bold"
          >
            Annuleren
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || !reps.trim() || !focus.trim()}
            className="flex-1 bg-blue-600 p-3 rounded-2xl text-xs font-bold disabled:opacity-40"
          >
            {saving ? 'Opslaan…' : 'Opslaan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [history, setHistory] = useState<WorkoutLog[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  const [selectedWorkout, setSelectedWorkout] = useState<string | null>(null);
  const [completedSets, setCompletedSets] = useState<CompletedSets>({});
  const [exerciseWeights, setExerciseWeights] = useState<ExerciseWeights>({});
  const [savedWeights, setSavedWeights] = useState<Record<string, string>>({});

  const [expandedExercise, setExpandedExercise] = useState<Exercise | null>(null);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [showAiChat, setShowAiChat] = useState(false);
  const [showMcpGuide, setShowMcpGuide] = useState(false);
  const [mcpApiKey, setMcpApiKey] = useState<string | null>(null);
  const [mcpKeyLoading, setMcpKeyLoading] = useState(false);
  const [mcpCopied, setMcpCopied] = useState<string | null>(null);
  const [exerciseForm, setExerciseForm] = useState<{ open: boolean; exercise?: Exercise; workoutKey: string }>({
    open: false, workoutKey: 'A',
  });
  const [deleteConfirm, setDeleteConfirm] = useState<Exercise | null>(null);

  const [toast, setToast] = useState('');
  const [timerTime, setTimerTime] = useState(90);
  const [timerActive, setTimerActive] = useState(false);

  // ── Auth ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    // Fallback: show auth screen after 5s regardless of network state
    const timeout = setTimeout(() => setAuthLoading(false), 5000);
    supabase.auth.getSession()
      .then(({ data }) => {
        clearTimeout(timeout);
        setSession(data.session);
        setAuthLoading(false);
      })
      .catch(() => {
        clearTimeout(timeout);
        setAuthLoading(false);
      });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => { subscription.unsubscribe(); clearTimeout(timeout); };
  }, []);

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadData = useCallback(async (userId: string) => {
    setDataLoading(true);
    const [exRes, logRes] = await Promise.all([
      supabase.from('exercises').select('*').eq('user_id', userId).order('sort_order'),
      supabase.from('workout_logs').select(`
        id, workout_title, created_at,
        log_exercises ( exercise_name, sort_order, log_sets ( set_number, weight, completed ) )
      `).eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
    ]);
    if (exRes.data) setExercises(exRes.data as Exercise[]);
    if (logRes.data) setHistory(logRes.data as WorkoutLog[]);
    setDataLoading(false);
  }, []);

  // Seed default exercises for brand-new users
  const seedDefaults = useCallback(async (userId: string) => {
    const rows = DEFAULT_EXERCISES.map((ex, i) => ({ ...ex, user_id: userId, sort_order: i }));
    const { data } = await supabase.from('exercises').insert(rows).select();
    if (data) setExercises(data as Exercise[]);
  }, []);

  useEffect(() => {
    if (!session) return;
    loadData(session.user.id).then(() => {
      // After load, if no exercises exist seed defaults
      supabase
        .from('exercises')
        .select('id')
        .eq('user_id', session.user.id)
        .limit(1)
        .then(({ data }) => {
          if (data && data.length === 0) seedDefaults(session.user.id);
        });
    });
  }, [session, loadData, seedDefaults]);

  // ── Timer ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!timerActive) return;
    if (timerTime <= 0) {
      setTimerActive(false);
      triggerToast('Tijd is om! Start je volgende set.');
      navigator.vibrate?.([200, 100, 200]);
      return;
    }
    const id = setInterval(() => setTimerTime((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [timerActive, timerTime]);

  function triggerToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }

  // ── Workout helpers ─────────────────────────────────────────────────────────

  function workoutExercises(key: string) {
    return exercises.filter((e) => e.workout_key === key);
  }

  function getProgress(): number {
    if (!selectedWorkout) return 0;
    const exs = workoutExercises(selectedWorkout);
    const total = exs.reduce((a, e) => a + e.sets, 0);
    const done = exs.reduce((a, e) => {
      for (let i = 0; i < e.sets; i++) if (completedSets[`${e.id}-${i}`]) a++;
      return a;
    }, 0);
    return total === 0 ? 0 : Math.round((done / total) * 100);
  }

  function toggleSet(exerciseId: string, setIndex: number) {
    const key = `${exerciseId}-${setIndex}`;
    const wasChecked = completedSets[key];
    setCompletedSets((prev) => ({ ...prev, [key]: !wasChecked }));
    if (!wasChecked) {
      setTimerTime(90);
      setTimerActive(true);
      triggerToast('Rusttimer gestart. Neem 90 seconden pauze.');
    }
  }

  function handleWeightChange(exerciseId: string, setIndex: number, value: string) {
    setExerciseWeights((prev) => {
      const prevEx = prev[exerciseId] ?? {};
      const prevFirst = prevEx['0'] ?? '';
      const updated = { ...prevEx, [setIndex.toString()]: value };
      if (setIndex === 0) {
        for (let i = 1; i < 10; i++) {
          const cur = prevEx[i.toString()] ?? '';
          if (cur === '' || cur === prevFirst) updated[i.toString()] = value;
        }
      }
      return { ...prev, [exerciseId]: updated };
    });
    if (setIndex === 0) setSavedWeights((p) => ({ ...p, [exerciseId]: value }));
  }

  function getWeightForSet(exerciseId: string, setIndex: number): string {
    return exerciseWeights[exerciseId]?.[setIndex.toString()] ?? savedWeights[exerciseId] ?? '';
  }

  // ── Finish workout ──────────────────────────────────────────────────────────

  async function finishWorkout() {
    if (!selectedWorkout || !session) return;
    const exs = workoutExercises(selectedWorkout);
    const title = selectedWorkout === 'A' ? 'Training A' : selectedWorkout === 'B' ? 'Training B' : `Training ${selectedWorkout}`;

    const { data: logData, error } = await supabase
      .from('workout_logs')
      .insert({ user_id: session.user.id, workout_title: title })
      .select('id')
      .single();
    if (error || !logData) { triggerToast('Fout bij opslaan.'); return; }

    const logExercises = exs.map((ex, idx) => ({
      exercise_name: ex.name,
      sort_order: idx,
      sets: Array.from({ length: ex.sets }, (_v, i) => ({
        set_number: i + 1,
        weight: exerciseWeights[ex.id]?.[i.toString()] ?? savedWeights[ex.id] ?? '0',
        completed: !!completedSets[`${ex.id}-${i}`],
      })),
    }));

    for (const le of logExercises) {
      const { data: leData } = await supabase
        .from('log_exercises')
        .insert({ log_id: logData.id, exercise_name: le.exercise_name, sort_order: le.sort_order })
        .select('id')
        .single();
      if (leData) {
        await supabase.from('log_sets').insert(
          le.sets.map((s) => ({ log_exercise_id: leData.id, ...s }))
        );
      }
    }

    await loadData(session.user.id);
    setCompletedSets({});
    setExerciseWeights({});
    setSelectedWorkout(null);
    setExpandedExercise(null);
    setTimerActive(false);
    setShowFinishModal(false);
    triggerToast('Training succesvol opgeslagen!');
  }

  // ── Clear history ───────────────────────────────────────────────────────────

  async function clearHistory() {
    if (!session) return;
    await supabase.from('workout_logs').delete().eq('user_id', session.user.id);
    setHistory([]);
    setShowClearModal(false);
    triggerToast('Geschiedenis gewist.');
  }

  // ── MCP API key ─────────────────────────────────────────────────────────────

  async function fetchMcpApiKey() {
    if (mcpApiKey) return;
    setMcpKeyLoading(true);
    const { data, error } = await supabase.rpc('get_or_create_api_key');
    if (!error && data) setMcpApiKey(data as string);
    setMcpKeyLoading(false);
  }

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      setMcpCopied(label);
      setTimeout(() => setMcpCopied(null), 2000);
    });
  }

  // ── Exercise CRUD ───────────────────────────────────────────────────────────

  async function saveExercise(ex: Partial<Exercise>) {
    if (!session) return;
    if (exerciseForm.exercise) {
      // Update
      const { data } = await supabase
        .from('exercises')
        .update(ex)
        .eq('id', exerciseForm.exercise.id)
        .select()
        .single();
      if (data) setExercises((prev) => prev.map((e) => (e.id === data.id ? data as Exercise : e)));
    } else {
      // Insert
      const sortOrder = exercises.filter((e) => e.workout_key === ex.workout_key).length;
      const { data } = await supabase
        .from('exercises')
        .insert({ ...ex, user_id: session.user.id, sort_order: sortOrder })
        .select()
        .single();
      if (data) setExercises((prev) => [...prev, data as Exercise]);
    }
  }

  async function deleteExercise(ex: Exercise) {
    await supabase.from('exercises').delete().eq('id', ex.id);
    setExercises((prev) => prev.filter((e) => e.id !== ex.id));
    setDeleteConfirm(null);
    triggerToast(`${ex.name} verwijderd.`);
  }

  // ── Render: loading / auth ──────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <Dumbbell className="text-blue-500 w-10 h-10 animate-pulse" />
        <p className="text-slate-500 text-sm">Laden…</p>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen onAuth={() => {}} />;
  }

  // ── Render: manage exercises ────────────────────────────────────────────────

  if (showManage) {
    const keys = [...new Set(exercises.map((e) => e.workout_key))].sort();
    return (
      <div className="min-h-screen bg-slate-950 text-white pb-8 font-sans">
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-4 z-20 flex items-center justify-between">
          <button
            onClick={() => setShowManage(false)}
            className="p-3 rounded-2xl bg-slate-800"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-black">Oefeningen beheren</h1>
          <div className="w-12" />
        </div>

        <div className="max-w-md mx-auto p-4 space-y-6">
          {['A', 'B', ...keys.filter((k) => k !== 'A' && k !== 'B')].map((key) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-black text-slate-300">Training {key}</h2>
                <button
                  onClick={() => setExerciseForm({ open: true, workoutKey: key })}
                  className="flex items-center gap-1.5 text-xs font-bold text-blue-400 bg-blue-950/40 px-3 py-1.5 rounded-xl border border-blue-500/20"
                >
                  <Plus size={14} /> Toevoegen
                </button>
              </div>
              <div className="space-y-2">
                {exercises.filter((e) => e.workout_key === key).map((ex) => (
                  <div key={ex.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm truncate">{ex.name}</p>
                      <p className="text-xs text-slate-400">{ex.reps} · {ex.sets} sets</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <button
                        onClick={() => setExerciseForm({ open: true, exercise: ex, workoutKey: ex.workout_key })}
                        className="p-2 bg-slate-800 rounded-xl"
                      >
                        <Pencil size={15} className="text-slate-300" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(ex)}
                        className="p-2 bg-rose-950/30 rounded-xl border border-rose-500/10"
                      >
                        <Trash2 size={15} className="text-rose-400" />
                      </button>
                    </div>
                  </div>
                ))}
                {exercises.filter((e) => e.workout_key === key).length === 0 && (
                  <p className="text-xs text-slate-500 py-2 pl-1">Geen oefeningen. Voeg er een toe.</p>
                )}
              </div>
            </div>
          ))}

          {/* Add exercises for a new training key */}
          <button
            onClick={() => {
              const key = prompt('Letter voor nieuw schema (bijv. C):')?.toUpperCase().trim();
              if (key && /^[A-Z]$/.test(key)) setExerciseForm({ open: true, workoutKey: key });
            }}
            className="w-full border border-dashed border-slate-700 text-slate-400 text-xs font-bold py-3 rounded-2xl flex items-center justify-center gap-2"
          >
            <Plus size={14} /> Nieuw trainingsschema
          </button>
        </div>

        {exerciseForm.open && (
          <ExerciseForm
            exercise={exerciseForm.exercise}
            workoutKey={exerciseForm.workoutKey}
            onSave={saveExercise}
            onClose={() => setExerciseForm({ open: false, workoutKey: 'A' })}
          />
        )}

        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-sm w-full space-y-4">
              <h3 className="text-lg font-black">Oefening verwijderen?</h3>
              <p className="text-sm text-slate-400">
                <strong className="text-white">{deleteConfirm.name}</strong> wordt permanent verwijderd.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 bg-slate-800 p-3 rounded-2xl text-xs font-bold">
                  Annuleren
                </button>
                <button onClick={() => deleteExercise(deleteConfirm)} className="flex-1 bg-rose-600 p-3 rounded-2xl text-xs font-bold text-white">
                  Verwijderen
                </button>
              </div>
            </div>
          </div>
        )}

        {toast && <Toast message={toast} />}
      </div>
    );
  }

  // ── Render: AI chat ────────────────────────────────────────────────────────

  if (showAiChat) {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Bot className="text-blue-500 w-10 h-10 animate-pulse" />
        </div>
      }>
        <AiChat
          userId={session.user.id}
          onClose={() => setShowAiChat(false)}
          onDataChanged={() => loadData(session.user.id)}
        />
      </Suspense>
    );
  }

  // ── Render: MCP guide ──────────────────────────────────────────────────────

  if (showMcpGuide) {
    const mcpUrl = mcpApiKey
      ? `https://bzfdisecqlkfqujvkyvi.supabase.co/functions/v1/workout-mcp?key=${mcpApiKey}`
      : null;
    const cliCommand = mcpUrl
      ? `claude mcp add --scope user --transport http gym-tracker "${mcpUrl}"`
      : null;

    return (
      <div className="min-h-screen bg-slate-950 text-white pb-8 font-sans">
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-4 z-20 flex items-center justify-between">
          <button onClick={() => setShowMcpGuide(false)} className="p-3 rounded-2xl bg-slate-800">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-black">Koppelen met Claude</h1>
          <div className="w-12" />
        </div>

        <div className="max-w-md mx-auto p-4 space-y-6">

          {/* Intro */}
          <div className="bg-blue-950/30 border border-blue-500/20 rounded-3xl p-5 space-y-2">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600/20 p-2.5 rounded-2xl">
                <Bot className="text-blue-400 w-6 h-6" />
              </div>
              <div>
                <h2 className="font-black text-base">Claude MCP</h2>
                <p className="text-xs text-slate-400">Laat Claude je trainingsdata lezen en beheren</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Via MCP (Model Context Protocol) kan Claude rechtstreeks met jouw gym data praten.
              Je kunt vragen stellen als <em className="text-blue-300">"wat zijn mijn persoonlijke records?"</em> of
              <em className="text-blue-300"> "stel een nieuw schema in"</em>.
            </p>
          </div>

          {/* Step 1 - Get API key */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-300 flex items-center gap-2">
              <span className="bg-blue-600 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shrink-0">1</span>
              Jouw persoonlijke MCP-URL
            </h3>

            {!mcpApiKey && !mcpKeyLoading && (
              <button
                onClick={fetchMcpApiKey}
                className="w-full bg-blue-600 active:bg-blue-700 p-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2"
              >
                <Bot size={16} /> API-sleutel genereren
              </button>
            )}

            {mcpKeyLoading && (
              <div className="w-full bg-slate-900 border border-slate-800 p-3.5 rounded-2xl text-sm text-slate-400 text-center">
                Laden…
              </div>
            )}

            {mcpUrl && (
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-2">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">MCP Server URL</p>
                <p className="text-xs text-slate-300 break-all font-mono leading-relaxed">{mcpUrl}</p>
                <button
                  onClick={() => copyText(mcpUrl, 'url')}
                  className="flex items-center gap-2 text-xs font-bold text-blue-400 mt-1"
                >
                  <Copy size={13} />
                  {mcpCopied === 'url' ? 'Gekopieerd!' : 'Kopieer URL'}
                </button>
              </div>
            )}
          </div>

          {/* Step 2 - Claude Desktop */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-300 flex items-center gap-2">
              <span className="bg-blue-600 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shrink-0">2a</span>
              Claude Desktop app
            </h3>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 text-xs text-slate-300">
              <p>Open <strong className="text-white">Instellingen → Ontwikkelaar → MCP Servers bewerken</strong> en voeg dit toe:</p>
              <div className="bg-slate-950 rounded-xl p-3 font-mono text-[11px] text-slate-300 leading-relaxed">
                {`{\n  "mcpServers": {\n    "gym-tracker": {\n      "type": "http",\n      "url": "`}
                <span className="text-blue-400">{mcpUrl ?? 'JOUW_MCP_URL'}</span>
                {`"\n    }\n  }\n}`}
              </div>
              {mcpUrl && (
                <button
                  onClick={() => copyText(
                    `{\n  "mcpServers": {\n    "gym-tracker": {\n      "type": "http",\n      "url": "${mcpUrl}"\n    }\n  }\n}`,
                    'desktop'
                  )}
                  className="flex items-center gap-2 font-bold text-blue-400"
                >
                  <Copy size={13} />
                  {mcpCopied === 'desktop' ? 'Gekopieerd!' : 'Kopieer config'}
                </button>
              )}
            </div>
          </div>

          {/* Step 2b - Claude Code CLI */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-300 flex items-center gap-2">
              <span className="bg-blue-600 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shrink-0">2b</span>
              Claude Code (CLI)
            </h3>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 text-xs text-slate-300">
              <p>Voer dit commando uit in je terminal:</p>
              <div className="bg-slate-950 rounded-xl p-3 font-mono text-[11px] text-slate-300 leading-relaxed break-all flex items-start gap-2">
                <Terminal size={12} className="text-slate-500 mt-0.5 shrink-0" />
                <span>{cliCommand ?? `claude mcp add --scope user --transport http gym-tracker "JOUW_MCP_URL"`}</span>
              </div>
              {cliCommand && (
                <button
                  onClick={() => copyText(cliCommand, 'cli')}
                  className="flex items-center gap-2 font-bold text-blue-400"
                >
                  <Copy size={13} />
                  {mcpCopied === 'cli' ? 'Gekopieerd!' : 'Kopieer commando'}
                </button>
              )}
            </div>
          </div>

          {/* Step 3 - Usage */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-300 flex items-center gap-2">
              <span className="bg-emerald-600 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shrink-0">3</span>
              Wat kun je vragen?
            </h3>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
              {[
                'Wat zijn mijn persoonlijke records per oefening?',
                'Maak een nieuw trainingsschema voor me',
                'Analyseer mijn progressie van de afgelopen maand',
                'Voeg een nieuwe oefening toe aan Training A',
                'Verwijder Face Pulls uit mijn schema',
              ].map((q) => (
                <div key={q} className="flex items-start gap-2 text-xs text-slate-300">
                  <span className="text-blue-500 shrink-0 mt-0.5">›</span>
                  <span className="italic">"{q}"</span>
                </div>
              ))}
            </div>
          </div>

          {/* Security note */}
          <div className="bg-amber-950/20 border border-amber-500/20 rounded-2xl p-4 text-xs text-amber-300/80 leading-relaxed">
            <strong className="text-amber-300">Let op:</strong> Deel je MCP-URL niet met anderen — de sleutel geeft toegang tot jouw trainingsdata.
          </div>
        </div>
      </div>
    );
  }

  // ── Render: home ────────────────────────────────────────────────────────────

  if (!selectedWorkout) {
    const workoutKeys = [...new Set(exercises.map((e) => e.workout_key))].sort();
    const colors = ['bg-blue-600 border-blue-400/20', 'bg-emerald-600 border-emerald-400/20', 'bg-purple-600 border-purple-400/20', 'bg-orange-600 border-orange-400/20'];

    return (
      <div className="min-h-screen bg-slate-950 text-white p-6 font-sans">
        <div className="max-w-md mx-auto w-full space-y-8 py-4">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600/20 p-3 rounded-2xl">
                <Dumbbell className="text-blue-500 w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight">Gym Tracker</h1>
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <User size={10} /> {session.user.email}
                </p>
              </div>
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              className="p-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400"
              title="Uitloggen"
            >
              <LogOut size={18} />
            </button>
          </div>

          {/* Start Training */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-black flex items-center gap-2">
                <Target size={18} className="text-blue-500" />
                Start nieuwe training
              </h2>
              <button
                onClick={() => setShowManage(true)}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl"
              >
                <Pencil size={13} /> Beheren
              </button>
            </div>
            {dataLoading ? (
              <div className="h-36 bg-slate-900 rounded-3xl animate-pulse" />
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {workoutKeys.map((key, idx) => (
                  <button
                    key={key}
                    onClick={() => setSelectedWorkout(key)}
                    className={`${colors[idx % colors.length]} active:opacity-80 p-5 rounded-3xl text-left shadow-lg transition-transform active:scale-95 flex flex-col justify-between h-36 border`}
                  >
                    <Dumbbell size={28} className="text-white" />
                    <div>
                      <div className="text-xl font-black">Training {key}</div>
                      <div className="text-xs text-white/70">{workoutExercises(key).length} oefeningen</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* History */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black flex items-center gap-2">
                <Calendar size={18} className="text-orange-500" />
                Laatste prestaties
              </h2>
              {history.length > 0 && (
                <button
                  onClick={() => setShowClearModal(true)}
                  className="text-xs text-rose-500 font-bold flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-rose-950/20 border border-rose-500/10"
                >
                  <Trash2 size={13} /> Wis Logboek
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-8 text-center text-slate-500 text-sm">
                Nog geen afgeronde trainingen. Voltooi een training om je logboek op te bouwen.
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {history.map((log) => (
                  <div key={log.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-black text-sm text-blue-400">{log.workout_title}</span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        {new Date(log.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {log.log_exercises?.map((le, idx) => {
                        const best = le.log_sets?.reduce((max, s) => Math.max(max, parseFloat(s.weight) || 0), 0) ?? 0;
                        return (
                          <div key={idx} className="flex justify-between bg-slate-950/50 p-1.5 rounded-lg border border-slate-800/50">
                            <span className="truncate mr-1 text-slate-400">{le.exercise_name}</span>
                            <span className="font-bold text-white shrink-0">{best} kg</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI coach button */}
          <button
            onClick={() => setShowAiChat(true)}
            className="w-full flex items-center gap-3 bg-gradient-to-r from-blue-950/50 to-slate-900/60 border border-blue-500/30 p-4 rounded-3xl text-left"
          >
            <div className="bg-blue-600/20 p-2.5 rounded-2xl shrink-0">
              <Sparkles className="text-blue-400 w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="font-black text-sm text-white">AI-coach in de app</p>
              <p className="text-xs text-slate-400 truncate">Laat de AI je oefeningen beheren & data analyseren</p>
            </div>
            <ChevronLeft size={18} className="text-slate-500 rotate-180 shrink-0 ml-auto" />
          </button>

          {/* Claude MCP button */}
          <button
            onClick={() => { setShowMcpGuide(true); fetchMcpApiKey(); }}
            className="w-full flex items-center gap-3 bg-slate-900/60 border border-slate-800 p-4 rounded-3xl text-left"
          >
            <div className="bg-blue-600/20 p-2.5 rounded-2xl shrink-0">
              <Bot className="text-blue-400 w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="font-black text-sm text-white">Koppelen met Claude (MCP)</p>
              <p className="text-xs text-slate-400 truncate">Gebruik je data in Claude Desktop of CLI</p>
            </div>
            <ChevronLeft size={18} className="text-slate-500 rotate-180 shrink-0 ml-auto" />
          </button>

        </div>

        {showClearModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-sm w-full space-y-4">
              <h3 className="text-lg font-black">Weet je het zeker?</h3>
              <p className="text-sm text-slate-400">
                Hiermee wis je al je opgeslagen trainingen definitief.
              </p>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowClearModal(false)} className="flex-1 bg-slate-800 p-3 rounded-2xl text-xs font-bold">
                  Annuleren
                </button>
                <button onClick={clearHistory} className="flex-1 bg-rose-600 p-3 rounded-2xl text-xs font-bold text-white">
                  Definitief Wissen
                </button>
              </div>
            </div>
          </div>
        )}

        {toast && <Toast message={toast} />}
      </div>
    );
  }

  // ── Render: workout screen ──────────────────────────────────────────────────

  const exs = workoutExercises(selectedWorkout);
  const progress = getProgress();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-36 font-sans">

      <div className="sticky top-0 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-4 z-20 flex items-center justify-between">
        <button onClick={() => setSelectedWorkout(null)} className="p-3 rounded-2xl bg-slate-800">
          <ChevronLeft size={24} className="text-white" />
        </button>
        <h1 className="text-xl font-black text-white">Training {selectedWorkout}</h1>
        <div className="px-3 py-1 bg-blue-900/50 border border-blue-500/30 rounded-full font-black text-blue-400 text-sm">
          {progress}% Klaar
        </div>
      </div>

      <div className="w-full bg-slate-800 h-2">
        <div
          className="bg-gradient-to-r from-blue-500 to-emerald-500 h-2 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {expandedExercise && (
        <div className="bg-slate-900 p-4 border-b border-slate-800">
          <div className="max-w-md mx-auto">
            <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider text-center">
              Actieve spierzone: <span className="text-orange-400">{expandedExercise.name}</span>
            </p>
            <MuscleMap highlight={expandedExercise.muscle_group} />
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto p-4 space-y-4">
        {exs.map((exercise) => {
          const isExpanded = expandedExercise?.id === exercise.id;
          const setsCompleted = Array.from({ length: exercise.sets }, (_v, i) =>
            completedSets[`${exercise.id}-${i}`],
          ).filter(Boolean).length;
          const isDone = setsCompleted === exercise.sets;

          return (
            <div
              key={exercise.id}
              className={`rounded-3xl border transition-all ${
                isDone
                  ? 'border-emerald-500/50 bg-emerald-950/20'
                  : isExpanded
                  ? 'border-blue-500 bg-slate-900'
                  : 'border-slate-800 bg-slate-900/60'
              }`}
            >
              <div
                onClick={() => setExpandedExercise(isExpanded ? null : exercise)}
                className="p-4 flex justify-between items-center cursor-pointer select-none"
              >
                <div className="flex-1 min-w-0 pr-2">
                  <span className="text-xs font-bold text-slate-400 px-2 py-0.5 bg-slate-800 rounded-full uppercase mb-1 inline-block">
                    {exercise.focus}
                  </span>
                  <h2 className="text-lg font-black truncate">{exercise.name}</h2>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-bold text-blue-400 bg-blue-950/80 px-2.5 py-1 rounded-xl">
                    {exercise.reps}
                  </span>
                  {isExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-slate-800 p-4 space-y-4">
                  {exercise.image && (
                    <div className="relative w-full h-48 rounded-2xl overflow-hidden bg-slate-800">
                      <img
                        src={exercise.image}
                        alt={exercise.name}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                    </div>
                  )}
                  {exercise.tips.length > 0 && (
                    <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
                      <ul className="space-y-1.5 text-sm text-slate-300">
                        {exercise.tips.map((tip, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-blue-500 font-bold shrink-0">•</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="p-4 border-t border-slate-800/60 space-y-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Huidige Sets</p>
                {Array.from({ length: exercise.sets }, (_v, i) => {
                  const isChecked = !!completedSets[`${exercise.id}-${i}`];
                  return (
                    <div
                      key={i}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-colors ${
                        isChecked ? 'bg-emerald-950/30 border-emerald-500/30' : 'bg-slate-900/80 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-black text-slate-400 w-12">Set {i + 1}</span>
                        <div className="flex items-center bg-slate-950 border border-slate-700/80 rounded-xl px-2.5 py-1 focus-within:border-blue-500 transition-colors w-24">
                          <input
                            type="number"
                            inputMode="decimal"
                            placeholder="0"
                            value={getWeightForSet(exercise.id, i)}
                            onChange={(e) => handleWeightChange(exercise.id, i, e.target.value)}
                            className="w-full bg-transparent text-white font-black text-center focus:outline-none text-sm"
                          />
                          <span className="text-[10px] font-bold text-slate-500 ml-1">kg</span>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleSet(exercise.id, i)}
                        className="p-1.5 active:scale-90 transition-transform"
                        aria-label={isChecked ? 'Set verwijderen' : 'Set voltooien'}
                      >
                        {isChecked
                          ? <CheckCircle2 size={32} className="text-emerald-500" />
                          : <Circle size={32} className="text-slate-600" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="pt-4">
          <button
            onClick={() => setShowFinishModal(true)}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 active:from-emerald-600 active:to-teal-600 p-5 rounded-3xl text-center font-black text-lg shadow-xl shadow-emerald-950/30 tracking-wide transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Award size={22} />
            Training Afronden
          </button>
        </div>
      </div>

      {/* Floating Rest Timer */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 p-4 z-30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-slate-800 p-2.5 rounded-2xl text-blue-400"><Timer size={24} /></div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">RUSTTIMER</p>
            <p className="text-2xl font-black tracking-tight tabular-nums text-white">{formatTime(timerTime)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setTimerTime(60); setTimerActive(true); }} className="px-3 py-2 bg-slate-800 text-xs font-bold rounded-xl">1 min</button>
          <button onClick={() => { setTimerTime(90); setTimerActive(true); }} className="px-3 py-2 bg-slate-800 text-xs font-bold rounded-xl">1.5 min</button>
          <button
            onClick={() => setTimerActive((a) => !a)}
            className={`p-3 rounded-2xl active:scale-95 transition-all text-white ${timerActive ? 'bg-amber-600' : 'bg-blue-600'}`}
          >
            {timerActive ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button onClick={() => { setTimerTime(90); setTimerActive(false); }} className="p-3 bg-slate-800 text-slate-300 rounded-2xl">
            <RotateCcw size={20} />
          </button>
        </div>
      </div>

      {showFinishModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-sm w-full space-y-4">
            <h3 className="text-lg font-black text-white">Workout afronden?</h3>
            <p className="text-sm text-slate-400">
              Je gewichten en voltooide sets worden opgeslagen in je trainingsgeschiedenis.
            </p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowFinishModal(false)} className="flex-1 bg-slate-800 p-3 rounded-2xl text-xs font-bold">
                Doorgaan
              </button>
              <button onClick={finishWorkout} className="flex-1 bg-emerald-600 p-3 rounded-2xl text-xs font-bold text-white">
                Opslaan & Klaar
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
