/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Send, Check, Sparkles, Music, Mic2, History, Copy } from 'lucide-react';

// Proxy call to Gemini
const callGemini = async (model: string, contents: any, config?: any, systemInstruction?: string) => {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, contents, config, systemInstruction })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to call Gemini API');
  }

  // Extract text from the response structure
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('No text returned from Gemini');
  }
  return text;
};

interface Verse {
  author: string;
  role: 'Ryan' | 'Michael';
  text: string;
  rawInput: string;
}

interface VerseOption {
  vibe: string;
  text: string;
}

const TURNS = [
  { author: 'Ryan', role: 'Ryan' as const, color: 'amber' },
  { author: 'Michael', role: 'Michael' as const, color: 'rose' },
  { author: 'Ryan', role: 'Ryan' as const, color: 'amber' },
  { author: 'Michael', role: 'Michael' as const, color: 'rose' },
];

function ErrorFallback({ error }: { error: Error }) {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-10 text-center">
      <div className="max-w-md bg-bg-alt border border-rose-dim p-8">
        <h2 className="text-rose-primary text-xl mb-4 font-display">Connection Required</h2>
        <p className="text-text-mid text-sm mb-6 font-serif italic">
          {error.message.includes("GEMINI_API_KEY") 
            ? "The AI connection is missing its key. On Cloudflare, ensure GEMINI_API_KEY is set in your Pages dashboard under 'Environment Variables' for BOTH 'Production' and 'Preview' environments."
            : error.message}
        </p>
        <div className="text-[10px] text-text-dim font-mono mb-6 space-y-2 text-left bg-bg p-4 border border-border-dim">
          <p>1. Go to Cloudflare Dashboard</p>
          <p>2. Pages → Your Project → Settings</p>
          <p>3. Environment Variables → Add Variable</p>
          <p>4. Name: <span className="text-amber-primary">GEMINI_API_KEY</span></p>
          <p>5. Save and <span className="text-amber-primary">Redeploy</span></p>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="font-mono text-[10px] tracking-[3px] uppercase px-6 py-3 border border-rose-dim text-rose-primary hover:bg-rose-primary/10 transition-all"
        >
          Check Again
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [error, setError] = useState<Error | null>(null);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [options, setOptions] = useState<VerseOption[] | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [finalAnalysis, setFinalAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [verses, options, finalAnalysis]);

  if (error) {
    return <ErrorFallback error={error} />;
  }

  const copyToClipboard = () => {
    const fullText = verses.map(v => `${v.author}:\n${v.text}`).join('\n\n') + 
      (finalAnalysis ? `\n\nANALYSIS:\n${finalAnalysis}` : '');
    
    navigator.clipboard.writeText(fullText).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const generateOptions = async () => {
    if (!input.trim()) return;
    setIsGenerating(true);
    setOptions(null);
    setSelectedOption(null);

    const turnInfo = TURNS[currentTurn];
    const prompt = `Write 3 boom-bap verse options for ${turnInfo.author} based on this raw thought: "${input}". 
    The vibe should be gritty, soulful, and atmospheric, reflecting the "Build While Bleeding" aesthetic.
    Return the options as a JSON array of objects, each with "vibe" (a short descriptive label) and "text" (the verse lines).`;

    try {
      const text = await callGemini(
        "gemini-3-flash-preview",
        prompt,
        {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              options: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    vibe: { type: "STRING" },
                    text: { type: "STRING" }
                  },
                  required: ["vibe", "text"]
                }
              }
            },
            required: ["options"]
          }
        }
      );

      const data = JSON.parse(text || '{"options": []}');
      setOptions(data.options);
    } catch (err) {
      console.error("Error generating options:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsGenerating(false);
    }
  };

  const lockVerse = () => {
    if (selectedOption === null || !options) return;

    const chosen = options[selectedOption];
    const newVerse: Verse = {
      author: TURNS[currentTurn].author,
      role: TURNS[currentTurn].role,
      text: chosen.text,
      rawInput: input
    };

    setVerses([...verses, newVerse]);
    setOptions(null);
    setSelectedOption(null);
    setInput('');
    setCurrentTurn(currentTurn + 1);
  };

  const generateFinalAnalysis = async () => {
    setIsAnalyzing(true);
    const songText = verses.map(v => `${v.author}: ${v.text}`).join('\n\n');
    const prompt = `Analyze these collaborative verses between Ryan and Michael for a song titled "You, me and this Cherokee". 
    Find the hidden narrative, the emotional core, and suggest a hook or title for the overall piece. 
    Keep the tone poetic, insightful, and slightly gritty.`;

    try {
      const text = await callGemini("gemini-3-flash-preview", prompt);
      setFinalAnalysis(text || "The song remains a mystery.");
    } catch (err) {
      console.error("Error generating analysis:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const isComplete = currentTurn >= TURNS.length;

  return (
    <div className="min-h-screen relative">
      <div className="noise-overlay" />
      
      <div className="max-w-2xl mx-auto px-5 pb-24 pt-14 relative z-10">
        <header className="text-center mb-12 relative pb-10">
          <div className="font-mono text-[9px] tracking-[5px] text-amber-dim uppercase mb-5 opacity-80">
            Build While Bleeding · a co-creation
          </div>
          <h1 className="text-4xl md:text-5xl leading-none tracking-tight text-text-primary mb-2">
            You, me <span className="italic font-light text-text-mid text-[0.75em]">&amp;</span> <span className="block text-amber-primary">this Cherokee</span>
          </h1>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-px bg-gradient-to-r from-transparent via-amber-dim to-transparent" />
        </header>

        {/* Progress Track */}
        <div className="flex items-start mb-10 px-2">
          {TURNS.map((turn, i) => (
            <div key={i} className="flex-1 text-center relative">
              <div 
                className={`w-8 h-8 rounded-full border border-border-dim bg-bg flex items-center justify-center font-mono text-[10px] relative z-10 transition-all duration-500 mx-auto
                  ${i === currentTurn ? 'ring-4 ring-amber-dim/30 border-amber-primary shadow-[0_0_16px_rgba(212,146,42,0.3)]' : ''}
                  ${i < currentTurn ? 'bg-amber-dim border-amber-dim text-bg' : 'text-text-dim'}
                `}
              >
                {turn.author[0]}
              </div>
              {i < TURNS.length - 1 && (
                <div className="absolute top-4 left-[60%] w-[80%] h-px bg-gradient-to-r from-border-warm to-border-dim" />
              )}
            </div>
          ))}
          <div className="flex-1 text-center relative">
            <div className={`w-8 h-8 rounded-full border border-border-dim bg-bg flex items-center justify-center font-mono text-[10px] relative z-10 transition-all duration-500 mx-auto
              ${isComplete ? 'bg-amber-dim border-amber-dim text-bg shadow-[0_0_16px_rgba(212,146,42,0.3)]' : 'text-text-dim'}
            `}>
              ✦
            </div>
          </div>
        </div>

        {/* Verses Container */}
        <div className="space-y-6 mb-10">
          <AnimatePresence>
            {verses.map((verse, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-bg-alt border border-border-dim overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-border-dim flex items-center justify-between">
                  <span className={`font-mono text-[8px] tracking-[4px] uppercase px-2 py-1 border
                    ${verse.role === 'Ryan' ? 'text-amber-primary border-amber-dim bg-amber-primary/10' : 'text-rose-primary border-rose-dim bg-rose-primary/10'}
                  `}>
                    {verse.author}
                  </span>
                  <div className="text-[10px] text-text-dim font-mono">VERSE {i + 1}</div>
                </div>
                <div className="p-6 whitespace-pre-wrap leading-relaxed text-text-primary">
                  {verse.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Input Section */}
        {!isComplete && !options && !isGenerating && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-bg-alt border border-border-warm relative overflow-hidden"
          >
            <textarea 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Just say it. Don't try to make it a song..."
              className="w-full bg-transparent border-none outline-none resize-none italic text-base leading-relaxed text-text-primary p-6 min-h-[140px]"
            />
            <div className="px-5 py-4 border-t border-border-dim flex justify-between items-center bg-bg/50">
              <div className="text-[10px] font-mono text-text-dim uppercase tracking-wider">
                {TURNS[currentTurn].author}'s Turn
              </div>
              <button 
                onClick={generateOptions}
                disabled={!input.trim()}
                className={`font-mono text-[9px] tracking-[3px] uppercase px-6 py-3 border cursor-pointer transition-all
                  ${TURNS[currentTurn].color === 'amber' ? 'border-amber-dim text-amber-primary hover:bg-amber-primary/10' : 'border-rose-dim text-rose-primary hover:bg-rose-primary/10'}
                  disabled:opacity-30 disabled:cursor-not-allowed
                `}
              >
                Make It →
              </button>
            </div>
          </motion.div>
        )}

        {/* Loading State */}
        {isGenerating && (
          <div className="p-7 flex items-center gap-4 bg-bg-alt border border-border-dim mb-4">
            <Loader2 className="w-4 h-4 animate-spin text-amber-primary" />
            <div className="font-mono text-[9px] tracking-[3px] text-text-dim uppercase">
              Writing three versions...
            </div>
          </div>
        )}

        {/* Options Panel */}
        {options && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-bg-alt border border-border-warm mb-4"
          >
            <div className="divide-y divide-border-dim">
              {options.map((opt, i) => (
                <div 
                  key={i}
                  onClick={() => setSelectedOption(i)}
                  className={`p-6 cursor-pointer transition-colors group relative
                    ${selectedOption === i ? 'bg-amber-primary/5' : 'hover:bg-white/5'}
                  `}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-mono text-[8px] text-amber-primary uppercase tracking-widest">{opt.vibe}</div>
                    {selectedOption === i && <Check className="w-3 h-3 text-amber-primary" />}
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-text-primary opacity-90 group-hover:opacity-100">
                    {opt.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-border-dim flex justify-end bg-bg/50">
              <button 
                onClick={lockVerse}
                disabled={selectedOption === null}
                className={`font-mono text-[9px] tracking-[3px] uppercase px-6 py-3 border transition-all
                  ${TURNS[currentTurn].color === 'amber' ? 'border-amber-dim text-amber-primary' : 'border-rose-dim text-rose-primary'}
                  ${selectedOption !== null ? 'opacity-100' : 'opacity-30 cursor-not-allowed'}
                `}
              >
                Lock It In →
              </button>
            </div>
          </motion.div>
        )}

        {/* Final Step */}
        {isComplete && !finalAnalysis && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8"
          >
            <button 
              onClick={generateFinalAnalysis}
              disabled={isAnalyzing}
              className="w-full font-mono text-[10px] tracking-[4px] uppercase p-6 border border-amber-dim text-amber-primary hover:bg-amber-primary/5 transition-all flex items-center justify-center gap-3"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Finding the song...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Find the song inside these verses
                </>
              )}
            </button>
          </motion.div>
        )}

        {/* Analysis Result */}
        {finalAnalysis && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 p-8 bg-bg-alt border border-amber-dim/50 relative"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Music className="w-12 h-12" />
            </div>
            <h2 className="text-xl text-amber-primary mb-6 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                The Analysis
              </span>
              <button 
                onClick={copyToClipboard}
                className={`font-mono text-[8px] tracking-[2px] uppercase px-3 py-2 border transition-all flex items-center gap-2
                  ${isCopied ? 'border-amber-primary text-amber-primary bg-amber-primary/10' : 'border-border-dim text-text-dim hover:text-amber-primary hover:border-amber-dim'}
                `}
              >
                {isCopied ? (
                  <>
                    <Check className="w-3 h-3" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copy Song
                  </>
                )}
              </button>
            </h2>
            <div className="prose prose-invert max-w-none text-text-mid leading-relaxed italic">
              {finalAnalysis.split('\n').map((line, i) => (
                <p key={i} className="mb-4">{line}</p>
              ))}
            </div>
            <div className="mt-8 pt-6 border-t border-border-dim flex justify-center">
              <button 
                onClick={() => window.location.reload()}
                className="font-mono text-[8px] tracking-[3px] text-text-dim uppercase hover:text-amber-primary transition-colors flex items-center gap-2"
              >
                <History className="w-3 h-3" />
                Start a new session
              </button>
            </div>
          </motion.div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Background Elements */}
      <div className="fixed bottom-0 left-0 w-full h-32 bg-gradient-to-t from-bg to-transparent pointer-events-none z-0" />
    </div>
  );
}
