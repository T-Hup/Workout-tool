import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, Bot, Send, KeyRound, Trash2, Sparkles, Wrench, AlertTriangle } from 'lucide-react';
import type Anthropic from '@anthropic-ai/sdk';
import {
  getApiKey, setApiKey, clearApiKey, runConversation, AI_MODEL,
  type ChatTurn,
} from './aiAssistant';

interface AiChatProps {
  userId: string;
  onClose: () => void;
  onDataChanged: () => void;
}

const SUGGESTIONS = [
  'Wat zijn mijn persoonlijke records?',
  'Analyseer mijn progressie',
  'Voeg een nieuwe oefening toe aan Training A',
  'Maak een nieuw trainingsschema voor mijn benen',
];

export default function AiChat({ userId, onClose, onDataChanged }: AiChatProps) {
  const [hasKey, setHasKey] = useState(!!getApiKey());
  const [keyInput, setKeyInput] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const apiMessages = useRef<Anthropic.MessageParam[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, busy]);

  function saveKey() {
    if (!keyInput.trim().startsWith('sk-ant-')) {
      setError('Een Anthropic API-sleutel begint met "sk-ant-".');
      return;
    }
    setApiKey(keyInput);
    setKeyInput('');
    setError('');
    setHasKey(true);
  }

  function removeKey() {
    clearApiKey();
    setHasKey(false);
    setTurns([]);
    apiMessages.current = [];
  }

  async function send(text: string) {
    const key = getApiKey();
    if (!key || !text.trim() || busy) return;
    setInput('');
    setError('');
    setBusy(true);
    try {
      const result = await runConversation(
        key,
        userId,
        apiMessages.current,
        text.trim(),
        (turn) => setTurns((prev) => [...prev, turn]),
      );
      apiMessages.current = result.apiMessages;
      if (result.dataChanged) onDataChanged();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Onbekende fout';
      setError(
        msg.includes('401') || msg.toLowerCase().includes('authentication')
          ? 'Je API-sleutel werkt niet. Controleer of hij geldig is.'
          : `Er ging iets mis: ${msg}`,
      );
    } finally {
      setBusy(false);
    }
  }

  // ── API key setup screen ────────────────────────────────────────────────────

  if (!hasKey) {
    return (
      <div className="min-h-screen bg-slate-950 text-white pb-8 font-sans">
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-4 z-20 flex items-center justify-between">
          <button onClick={onClose} className="p-3 rounded-2xl bg-slate-800"><ChevronLeft size={24} /></button>
          <h1 className="text-xl font-black">AI-coach instellen</h1>
          <div className="w-12" />
        </div>

        <div className="max-w-md mx-auto p-4 space-y-6">
          <div className="bg-blue-950/30 border border-blue-500/20 rounded-3xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600/20 p-2.5 rounded-2xl"><Sparkles className="text-blue-400 w-6 h-6" /></div>
              <div>
                <h2 className="font-black text-base">AI in de app</h2>
                <p className="text-xs text-slate-400">Praat met Claude — direct in de app</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Met je eigen Anthropic API-sleutel kun je rechtstreeks in de app met de AI praten.
              De AI kan <strong className="text-white">echt acties uitvoeren</strong>: oefeningen
              toevoegen, wijzigen en verwijderen, en je trainingsdata analyseren.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-300 flex items-center gap-2">
              <KeyRound size={15} className="text-blue-400" /> Je Anthropic API-sleutel
            </h3>
            <input
              type="password"
              autoComplete="off"
              placeholder="sk-ant-..."
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-blue-500"
            />
            {error && <p className="text-xs text-rose-400">{error}</p>}
            <button
              onClick={saveKey}
              disabled={!keyInput.trim()}
              className="w-full bg-blue-600 active:bg-blue-700 p-3.5 rounded-2xl font-black text-sm disabled:opacity-40"
            >
              Opslaan en starten
            </button>
            <p className="text-xs text-slate-500 leading-relaxed">
              Nog geen sleutel? Maak er een aan op{' '}
              <span className="text-blue-400">console.anthropic.com</span> → API Keys.
            </p>
          </div>

          <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-4 flex gap-3">
            <div className="shrink-0 text-emerald-400 mt-0.5"><KeyRound size={16} /></div>
            <p className="text-xs text-emerald-300/90 leading-relaxed">
              <strong className="text-emerald-300">Veilig opgeslagen:</strong> je sleutel blijft
              alleen op dit apparaat (in je browser) en wordt nooit naar onze servers gestuurd —
              alleen rechtstreeks naar Anthropic. Niemand anders kan hem lezen.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Chat screen ─────────────────────────────────────────────────────────────

  return (
    <div className="h-screen bg-slate-950 text-white flex flex-col font-sans">
      <div className="sticky top-0 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-4 z-20 flex items-center justify-between shrink-0">
        <button onClick={onClose} className="p-3 rounded-2xl bg-slate-800"><ChevronLeft size={24} /></button>
        <div className="text-center">
          <h1 className="text-lg font-black flex items-center gap-2"><Bot size={18} className="text-blue-400" /> AI-coach</h1>
          <p className="text-[10px] text-slate-500">{AI_MODEL}</p>
        </div>
        <button onClick={removeKey} title="API-sleutel verwijderen" className="p-3 rounded-2xl bg-slate-800 text-slate-400">
          <Trash2 size={18} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 max-w-md mx-auto w-full">
        {turns.length === 0 && (
          <div className="space-y-4 pt-6">
            <div className="text-center text-slate-400 text-sm">
              <Bot size={40} className="mx-auto text-blue-500/50 mb-3" />
              Stel een vraag of geef een opdracht. De AI kan oefeningen beheren en je data analyseren.
            </div>
            <div className="space-y-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="w-full text-left text-xs text-slate-300 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 active:bg-slate-800"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn, i) => {
          if (turn.role === 'user') {
            return (
              <div key={i} className="flex justify-end">
                <div className="bg-blue-600 rounded-2xl rounded-br-md px-4 py-2.5 text-sm max-w-[85%] whitespace-pre-wrap">
                  {turn.text}
                </div>
              </div>
            );
          }
          if (turn.role === 'action') {
            return (
              <div key={i} className="flex items-center gap-2 text-xs text-slate-500 pl-1">
                <Wrench size={12} /> {turn.text}
              </div>
            );
          }
          return (
            <div key={i} className="flex justify-start">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm max-w-[85%] whitespace-pre-wrap">
                {turn.text}
              </div>
            </div>
          );
        })}

        {busy && (
          <div className="flex items-center gap-2 text-xs text-slate-500 pl-1">
            <Bot size={14} className="animate-pulse text-blue-400" /> Aan het denken…
          </div>
        )}

        {error && (
          <div className="bg-rose-950/30 border border-rose-500/20 rounded-2xl p-3 text-xs text-rose-300 flex gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {error}
          </div>
        )}
      </div>

      <div className="border-t border-slate-800 p-3 shrink-0">
        <div className="max-w-md mx-auto flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(input); }}
            disabled={busy}
            placeholder="Typ een bericht…"
            className="flex-1 bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <button
            onClick={() => send(input)}
            disabled={busy || !input.trim()}
            className="bg-blue-600 active:bg-blue-700 p-3 rounded-2xl disabled:opacity-40 shrink-0"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
