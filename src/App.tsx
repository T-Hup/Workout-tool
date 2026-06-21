import { useState, useEffect } from 'react';
import {
  ChevronLeft,
  Dumbbell,
  Timer,
  Target,
  CheckCircle2,
  Circle,
  Play,
  Pause,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Calendar,
  Check,
  Trash2,
  Award,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Exercise {
  id: string;
  name: string;
  reps: string;
  sets: number;
  focus: string;
  muscleGroup: string;
  image: string;
  tips: string[];
}

interface WorkoutPlan {
  title: string;
  exercises: Exercise[];
}

interface SetLog {
  set: number;
  weight: string;
  completed: boolean;
}

interface ExerciseLog {
  name: string;
  sets: SetLog[];
}

interface WorkoutLog {
  id: string;
  date: string;
  workoutTitle: string;
  exercises: ExerciseLog[];
}

type CompletedSets = Record<string, boolean>;
type ExerciseWeights = Record<string, Record<string, string>>;
type SavedWeights = Record<string, string>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function loadStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// ── Workout Data ──────────────────────────────────────────────────────────────

const workoutData: Record<string, WorkoutPlan> = {
  A: {
    title: 'Training A',
    exercises: [
      {
        id: 'a1',
        name: 'Back Squat',
        reps: '5 tot 8',
        sets: 3,
        focus: 'Bovenbenen en Billen',
        muscleGroup: 'quads',
        image: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=600&q=80',
        tips: [
          'Plaats voeten op schouderbreedte',
          'Houd de rug recht',
          'Zak tot de heupen onder de knieën zijn',
        ],
      },
      {
        id: 'a2',
        name: 'Dumbbell Bench Press',
        reps: '8 tot 12',
        sets: 3,
        focus: 'Borst en Triceps',
        muscleGroup: 'chest',
        image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=600&q=80',
        tips: [
          'Duw de schouderbladen in het bankje',
          'Breng dumbbells gecontroleerd omlaag',
          'Strek armen krachtig uit',
        ],
      },
      {
        id: 'a3',
        name: 'Lat Pulldown',
        reps: '8 tot 12',
        sets: 3,
        focus: 'Bovenrug en Breedte',
        muscleGroup: 'lats',
        image: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&w=600&q=80',
        tips: [
          'Trek de stang naar de bovenkant borst',
          'Leun heel licht naar achteren',
          'Knijp de schouderbladen samen',
        ],
      },
      {
        id: 'a4',
        name: 'Dumbbell Romanian Deadlift',
        reps: '8 tot 10',
        sets: 3,
        focus: 'Hamstrings en Billen',
        muscleGroup: 'hamstrings',
        image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=600&q=80',
        tips: [
          'Duw de heupen maximaal naar achteren',
          'Houd de dumbbells dicht bij je benen',
          'Lichte buiging in de knieën houden',
        ],
      },
      {
        id: 'a5',
        name: 'Dumbbell Lateral Raises',
        reps: '12 tot 15',
        sets: 3,
        focus: 'Zijkant Schouders',
        muscleGroup: 'shoulders',
        image: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=600&q=80',
        tips: [
          'Leun heel licht voorover',
          'Breng dumbbells zijwaarts omhoog',
          'Houd je ellebogen iets gebogen',
        ],
      },
      {
        id: 'a6',
        name: 'Plank',
        reps: '45 tot 60 seconden',
        sets: 3,
        focus: 'Core en Buikspieren',
        muscleGroup: 'core',
        image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=600&q=80',
        tips: [
          'Houd je lichaam in een rechte lijn',
          'Span je buik en billen hard aan',
          'Kijk naar de grond vlak voor je',
        ],
      },
    ],
  },
  B: {
    title: 'Training B',
    exercises: [
      {
        id: 'b1',
        name: 'Trap Bar Deadlift',
        reps: '5 tot 8',
        sets: 3,
        focus: 'Hele lichaam en Grip',
        muscleGroup: 'fullbody',
        image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=600&q=80',
        tips: [
          'Stel je voeten in het midden op',
          'Houd je borst op en rug recht',
          'Duw de grond hard weg om te starten',
        ],
      },
      {
        id: 'b2',
        name: 'Incline Dumbbell Press',
        reps: '8 tot 12',
        sets: 3,
        focus: 'Bovenkant Borst',
        muscleGroup: 'chest',
        image: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=600&q=80',
        tips: [
          'Zet het bankje op dertig graden',
          'Breng de gewichten tot borsthoogte',
          'Duw omhoog in een lichte boog',
        ],
      },
      {
        id: 'b3',
        name: 'Chest-Supported Row',
        reps: '8 tot 12',
        sets: 3,
        focus: 'Middenrug en Dikte',
        muscleGroup: 'lats',
        image: 'https://images.unsplash.com/photo-1605296867304-46d5465a25f1?auto=format&fit=crop&w=600&q=80',
        tips: [
          'Druk je borst stevig tegen het kussen',
          'Trek ellebogen ver naar achteren',
          'Laat het gewicht rustig zakken',
        ],
      },
      {
        id: 'b4',
        name: 'Bulgarian Split Squat',
        reps: '8 tot 10 per been',
        sets: 3,
        focus: 'Benen en Balans',
        muscleGroup: 'quads',
        image: 'https://images.unsplash.com/photo-1434608519344-49d77a699e1d?auto=format&fit=crop&w=600&q=80',
        tips: [
          'Plaats een voet achter je op een bankje',
          'Zak recht naar beneden',
          'Houd je voorste knie stabiel',
        ],
      },
      {
        id: 'b5',
        name: 'Face Pulls',
        reps: '12 tot 15',
        sets: 3,
        focus: 'Achterkant Schouders',
        muscleGroup: 'shoulders',
        image: 'https://images.unsplash.com/photo-1593079831268-3381b0db4a77?auto=format&fit=crop&w=600&q=80',
        tips: [
          'Trek het touw richting je voorhoofd',
          'Trek je handen aan het eind uit elkaar',
          'Houd de ellebogen hoog',
        ],
      },
      {
        id: 'b6',
        name: "Farmer's Carries",
        reps: '30 tot 40 meter',
        sets: 3,
        focus: 'Gripkracht en Core',
        muscleGroup: 'grip',
        image: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=600&q=80',
        tips: [
          'Pak zware dumbbells of gewichten',
          'Loop met actieve, trotse borst',
          'Zet kleine, gecontroleerde stappen',
        ],
      },
    ],
  },
};

// ── MuscleMap ─────────────────────────────────────────────────────────────────

const ACTIVE = '#f97316';
const BASE = '#475569';

function MuscleMap({ highlight }: { highlight: string }) {
  const on = (groups: string[]) => (groups.includes(highlight) ? ACTIVE : BASE);

  return (
    <div className="flex justify-center gap-8 bg-slate-900 p-4 rounded-3xl">
      {/* Front */}
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

      {/* Back */}
      <div className="flex flex-col items-center">
        <span className="text-[10px] text-slate-400 font-bold mb-2">ACHTERKANT</span>
        <svg viewBox="0 0 100 220" className="w-20 h-40">
          <circle cx="50" cy="20" r="12" fill={BASE} />
          <rect x="47" y="32" width="6" height="8" fill={BASE} />
          <path d="M25,45 Q50,40 75,45 L70,55 L30,55 Z" fill={on(['shoulders', 'fullbody'])} />
          <path d="M30,55 Q50,55 70,55 L65,90 L35,90 Z" fill={on(['lats', 'fullbody'])} />
          <rect x="35" y="90" width="30" height="25" fill={on(['lats', 'fullbody'])} />
          <path
            d="M33,115 Q50,120 67,115 L64,135 Q50,140 36,135 Z"
            fill={on(['hamstrings', 'quads', 'fullbody'])}
          />
          <path d="M34,135 L30,175 L46,175 L48,135 Z" fill={on(['hamstrings', 'fullbody'])} />
          <path d="M66,135 L70,175 L54,175 L52,135 Z" fill={on(['hamstrings', 'fullbody'])} />
          <path d="M30,175 L33,210 L44,210 L46,175 Z" fill={BASE} />
          <path d="M70,175 L67,210 L56,210 L54,175 Z" fill={BASE} />
        </svg>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [selectedWorkout, setSelectedWorkout] = useState<string | null>(
    () => localStorage.getItem('activeWorkout'),
  );
  const [completedSets, setCompletedSets] = useState<CompletedSets>(
    () => loadStorage<CompletedSets>('completedSets', {}),
  );
  const [exerciseWeights, setExerciseWeights] = useState<ExerciseWeights>(
    () => loadStorage<ExerciseWeights>('exerciseWeights', {}),
  );
  const [savedWeights, setSavedWeights] = useState<SavedWeights>(
    () => loadStorage<SavedWeights>('savedWeights', {}),
  );
  const [history, setHistory] = useState<WorkoutLog[]>(
    () => loadStorage<WorkoutLog[]>('workoutHistory', []),
  );

  const [expandedExercise, setExpandedExercise] = useState<Exercise | null>(null);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [toast, setToast] = useState('');

  const [timerTime, setTimerTime] = useState(90);
  const [timerActive, setTimerActive] = useState(false);

  // Persist state to localStorage on change
  useEffect(() => {
    localStorage.setItem('completedSets', JSON.stringify(completedSets));
  }, [completedSets]);

  useEffect(() => {
    localStorage.setItem('exerciseWeights', JSON.stringify(exerciseWeights));
  }, [exerciseWeights]);

  useEffect(() => {
    localStorage.setItem('savedWeights', JSON.stringify(savedWeights));
  }, [savedWeights]);

  useEffect(() => {
    localStorage.setItem('workoutHistory', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (selectedWorkout) {
      localStorage.setItem('activeWorkout', selectedWorkout);
    } else {
      localStorage.removeItem('activeWorkout');
    }
  }, [selectedWorkout]);

  // Countdown timer
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerActive, timerTime]);

  function triggerToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }

  function getProgress(): number {
    if (!selectedWorkout) return 0;
    const exercises = workoutData[selectedWorkout].exercises;
    const total = exercises.reduce((acc, ex) => acc + ex.sets, 0);
    const done = exercises.reduce((acc, ex) => {
      for (let i = 0; i < ex.sets; i++) {
        if (completedSets[`${ex.id}-${i}`]) acc++;
      }
      return acc;
    }, 0);
    return Math.round((done / total) * 100);
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
      const prevExercise = prev[exerciseId] ?? {};
      const prevFirstWeight = prevExercise['0'] ?? '';
      const updated: Record<string, string> = { ...prevExercise, [setIndex.toString()]: value };

      // Auto-fill subsequent sets when editing set 1
      if (setIndex === 0) {
        for (let i = 1; i < 3; i++) {
          const cur = prevExercise[i.toString()] ?? '';
          if (cur === '' || cur === prevFirstWeight) {
            updated[i.toString()] = value;
          }
        }
      }
      return { ...prev, [exerciseId]: updated };
    });

    if (setIndex === 0) {
      setSavedWeights((prev) => ({ ...prev, [exerciseId]: value }));
    }
  }

  function getWeightForSet(exerciseId: string, setIndex: number): string {
    return exerciseWeights[exerciseId]?.[setIndex.toString()] ?? savedWeights[exerciseId] ?? '';
  }

  function finishWorkout() {
    if (!selectedWorkout) return;
    const plan = workoutData[selectedWorkout];

    const log: WorkoutLog = {
      id: crypto.randomUUID(),
      date: new Date().toLocaleDateString('nl-NL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      workoutTitle: plan.title,
      exercises: plan.exercises.map((ex) => ({
        name: ex.name,
        sets: Array.from({ length: ex.sets }, (_v, i) => ({
          set: i + 1,
          weight: exerciseWeights[ex.id]?.[i.toString()] ?? savedWeights[ex.id] ?? '0',
          completed: !!completedSets[`${ex.id}-${i}`],
        })),
      })),
    };

    setHistory((prev) => [log, ...prev]);

    // Clear active session weights for this workout, keep other workouts' weights
    setExerciseWeights((prev) => {
      const cleared = { ...prev };
      plan.exercises.forEach((ex) => {
        cleared[ex.id] = { '0': '', '1': '', '2': '' };
      });
      return cleared;
    });

    setCompletedSets({});
    setSelectedWorkout(null);
    setExpandedExercise(null);
    setTimerActive(false);
    setShowFinishModal(false);
    triggerToast('Training succesvol opgeslagen!');
  }

  function clearHistory() {
    setHistory([]);
    setShowClearModal(false);
    triggerToast('Geschiedenis gewist.');
  }

  const progress = getProgress();

  // ── Home Screen ─────────────────────────────────────────────────────────────

  if (!selectedWorkout) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6 font-sans">
        <div className="max-w-md mx-auto w-full space-y-8 py-4">

          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="bg-blue-600/20 p-3 rounded-2xl">
              <Dumbbell className="text-blue-500 w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Gym Tracker</h1>
              <p className="text-xs text-slate-400">Jouw progressie, altijd bewaard</p>
            </div>
          </div>

          {/* Start Training */}
          <div>
            <h2 className="text-lg font-black mb-3 flex items-center gap-2">
              <Target size={18} className="text-blue-500" />
              Start nieuwe training
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setSelectedWorkout('A')}
                className="bg-blue-600 active:bg-blue-700 p-5 rounded-3xl text-left shadow-lg transition-transform active:scale-95 flex flex-col justify-between h-36 border border-blue-400/20"
              >
                <Dumbbell size={28} className="text-white" />
                <div>
                  <div className="text-xl font-black">Training A</div>
                  <div className="text-xs text-blue-200">Focus op Quads en Borst</div>
                </div>
              </button>
              <button
                onClick={() => setSelectedWorkout('B')}
                className="bg-emerald-600 active:bg-emerald-700 p-5 rounded-3xl text-left shadow-lg transition-transform active:scale-95 flex flex-col justify-between h-36 border border-emerald-400/20"
              >
                <Target size={28} className="text-white" />
                <div>
                  <div className="text-xl font-black">Training B</div>
                  <div className="text-xs text-emerald-200">Focus op Posterior Chain</div>
                </div>
              </button>
            </div>
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
                  className="text-xs text-rose-500 font-bold flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-rose-950/20 border border-rose-500/10 active:scale-95 transition-transform"
                >
                  <Trash2 size={13} />
                  Wis Logboek
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
                      <span className="font-black text-sm text-blue-400">{log.workoutTitle}</span>
                      <span className="text-[10px] text-slate-500 font-medium">{log.date}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {log.exercises.map((ex, idx) => {
                        const best = ex.sets.reduce(
                          (max, s) => Math.max(max, parseFloat(s.weight) || 0),
                          0,
                        );
                        return (
                          <div
                            key={idx}
                            className="flex justify-between bg-slate-950/50 p-1.5 rounded-lg border border-slate-800/50"
                          >
                            <span className="truncate mr-1 text-slate-400">{ex.name}</span>
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
        </div>

        {/* Clear History Modal */}
        {showClearModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-sm w-full space-y-4">
              <h3 className="text-lg font-black">Weet je het zeker?</h3>
              <p className="text-sm text-slate-400">
                Hiermee wis je al je opgeslagen trainingen definitief. Dit kan niet ongedaan worden gemaakt.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowClearModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 p-3 rounded-2xl text-xs font-bold transition-transform active:scale-95"
                >
                  Annuleren
                </button>
                <button
                  onClick={clearHistory}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 p-3 rounded-2xl text-xs font-bold text-white transition-transform active:scale-95"
                >
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

  // ── Workout Screen ──────────────────────────────────────────────────────────

  const workout = workoutData[selectedWorkout];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-36 font-sans">

      {/* Sticky Header */}
      <div className="sticky top-0 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-4 z-20 flex items-center justify-between">
        <button
          onClick={() => setSelectedWorkout(null)}
          className="p-3 rounded-2xl bg-slate-800 active:bg-slate-700"
        >
          <ChevronLeft size={24} className="text-white" />
        </button>
        <h1 className="text-xl font-black text-white">{workout.title}</h1>
        <div className="px-3 py-1 bg-blue-900/50 border border-blue-500/30 rounded-full font-black text-blue-400 text-sm">
          {progress}% Klaar
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-800 h-2">
        <div
          className="bg-gradient-to-r from-blue-500 to-emerald-500 h-2 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Muscle Map (shown when an exercise is expanded) */}
      {expandedExercise && (
        <div className="bg-slate-900 p-4 border-b border-slate-800">
          <div className="max-w-md mx-auto">
            <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider text-center">
              Actieve spierzone:{' '}
              <span className="text-orange-400">{expandedExercise.name}</span>
            </p>
            <MuscleMap highlight={expandedExercise.muscleGroup} />
          </div>
        </div>
      )}

      {/* Exercise List */}
      <div className="max-w-md mx-auto p-4 space-y-4">
        {workout.exercises.map((exercise) => {
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
              {/* Card Header — tap to expand */}
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
                  {isExpanded ? (
                    <ChevronUp size={20} className="text-slate-400" />
                  ) : (
                    <ChevronDown size={20} className="text-slate-400" />
                  )}
                </div>
              </div>

              {/* Expanded: image + tips */}
              {isExpanded && (
                <div className="border-t border-slate-800 p-4 space-y-4">
                  <div className="relative w-full h-48 rounded-2xl overflow-hidden bg-slate-800">
                    <img
                      src={exercise.image}
                      alt={exercise.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=600&q=80';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                  </div>
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
                </div>
              )}

              {/* Sets row */}
              <div className="p-4 border-t border-slate-800/60 space-y-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Huidige Sets
                </p>
                {Array.from({ length: exercise.sets }, (_v, i) => {
                  const isChecked = !!completedSets[`${exercise.id}-${i}`];
                  return (
                    <div
                      key={i}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-colors ${
                        isChecked
                          ? 'bg-emerald-950/30 border-emerald-500/30'
                          : 'bg-slate-900/80 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-black text-slate-400 w-12">
                          Set {i + 1}
                        </span>
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
                        {isChecked ? (
                          <CheckCircle2 size={32} className="text-emerald-500" />
                        ) : (
                          <Circle size={32} className="text-slate-600" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Finish Button */}
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
          <div className="bg-slate-800 p-2.5 rounded-2xl text-blue-400">
            <Timer size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">RUSTTIMER</p>
            <p className="text-2xl font-black tracking-tight tabular-nums text-white">
              {formatTime(timerTime)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setTimerTime(60); setTimerActive(true); }}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl"
          >
            1 min
          </button>
          <button
            onClick={() => { setTimerTime(90); setTimerActive(true); }}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl"
          >
            1.5 min
          </button>
          <button
            onClick={() => setTimerActive((a) => !a)}
            className={`p-3 rounded-2xl active:scale-95 transition-all text-white ${
              timerActive ? 'bg-amber-600' : 'bg-blue-600'
            }`}
            aria-label={timerActive ? 'Pauzeer timer' : 'Start timer'}
          >
            {timerActive ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button
            onClick={() => { setTimerTime(90); setTimerActive(false); }}
            className="p-3 bg-slate-800 text-slate-300 rounded-2xl active:scale-95"
            aria-label="Reset timer"
          >
            <RotateCcw size={20} />
          </button>
        </div>
      </div>

      {/* Finish Workout Modal */}
      {showFinishModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-sm w-full space-y-4">
            <h3 className="text-lg font-black text-white">Workout afronden?</h3>
            <p className="text-sm text-slate-400">
              Je gewichten en voltooide sets worden opgeslagen in je trainingsgeschiedenis. De sessie
              wordt daarna gereset voor de volgende keer.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowFinishModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 p-3 rounded-2xl text-xs font-bold transition-transform active:scale-95"
              >
                Doorgaan
              </button>
              <button
                onClick={finishWorkout}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 p-3 rounded-2xl text-xs font-bold text-white transition-transform active:scale-95"
              >
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

// ── Toast ─────────────────────────────────────────────────────────────────────

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
