import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Trophy,
  Zap,
  Flame,
  Timer,
  Target,
  Brain,
  Crown,
  ArrowLeft,
  Shuffle,
  Grid3X3,
  Calculator,
  Eye,
  Music,
  Globe,
  Dices,
  Swords,
  Heart,
  Star,
  Lightbulb,
  Sparkles,
  Loader2,
  Check,
  X,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────────────
// Mini-Game Types (80 games across 8 categories)
// ──────────────────────────────────────────────────────────────────────

export type GameCategory = {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  games: MiniGameDef[];
};

export type MiniGameDef = {
  id: string;
  name: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  players: string;
  xpReward: number;
  timeLimit: number; // seconds
  component: React.ComponentType<MiniGameProps>;
  /** الحد الأدنى للعضوية المطلوبة: bronze=freetier, silver, gold, diamond, exclusive */
  tier?: "bronze" | "silver" | "gold" | "diamond" | "exclusive";
  features?: string[];
};

export type MiniGameProps = {
  onComplete: (score: number, timeTaken: number) => void;
  onExit: () => void;
};

// ──────────────────────────────────────────────────────────────────────
// Game Implementations
// ──────────────────────────────────────────────────────────────────────

// 1-10: Memory Games
function MemoryGrid({ onComplete, onExit }: MiniGameProps) {
  const [cards, setCards] = useState<number[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    const pairs = Array.from({ length: 8 }, (_, i) => i);
    const shuffled = [...pairs, ...pairs].sort(() => Math.random() - 0.5);
    setCards(shuffled);
  }, []);

  const handleFlip = (index: number) => {
    if (flipped.length === 2 || flipped.includes(index) || matched.includes(cards[index])) return;
    
    const newFlipped = [...flipped, index];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      setMoves(m => m + 1);
      if (cards[newFlipped[0]] === cards[newFlipped[1]]) {
        const newMatched = [...matched, cards[newFlipped[0]]];
        setMatched(newMatched);
        setFlipped([]);
        if (newMatched.length === 8) {
          const score = Math.max(100, 500 - moves * 10);
          setTimeout(() => onComplete(score, Date.now() - startTime), 500);
        }
      } else {
        setTimeout(() => setFlipped([]), 800);
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-4 text-sm">
        <span className="font-bold">الحركات: {moves}</span>
        <span className="font-bold">المطابقات: {matched.length}/8</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {cards.map((value, index) => {
          const isFlipped = flipped.includes(index) || matched.includes(value);
          const emojis = ["🎯", "🎮", "🏆", "⭐", "🔥", "💎", "🎪", "🎭"];
          return (
            <motion.button
              key={index}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleFlip(index)}
              className={cn(
                "flex size-16 items-center justify-center rounded-xl text-2xl font-bold transition-all",
                isFlipped
                  ? "border-2 border-primary bg-primary/10"
                  : "border-2 border-border bg-muted hover:border-primary/50"
              )}
            >
              {isFlipped ? emojis[value] : "?"}
            </motion.button>
          );
        })}
      </div>
      <Button variant="ghost" onClick={onExit} className="mt-4">
        <ArrowLeft className="ml-2 size-4" />
        خروج
      </Button>
    </div>
  );
}

// 2-10: Number Sequence
function NumberSequence({ onComplete, onExit }: MiniGameProps) {
  const [sequence, setSequence] = useState<number[]>([]);
  const [userInput, setUserInput] = useState("");
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [showSequence, setShowSequence] = useState(true);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    const len = Math.min(3 + level, 9);
    const seq = Array.from({ length: len }, () => Math.floor(Math.random() * 9) + 1);
    setSequence(seq);
    setShowSequence(true);
    setTimeout(() => setShowSequence(false), 2000 + level * 500);
  }, [level]);

  const check = () => {
    if (userInput === sequence.join("")) {
      const newScore = score + level * 50;
      setScore(newScore);
      setLevel(l => l + 1);
      setUserInput("");
      if (level >= 10) {
        onComplete(newScore, Date.now() - startTime);
      }
    } else {
      onComplete(score, Date.now() - startTime);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <Badge className="mb-2">المستوى {level}</Badge>
        <p className="text-sm text-muted-foreground">النقاط: {score}</p>
      </div>
      <div className="flex gap-2">
        {showSequence ? (
          sequence.map((num, i) => (
            <motion.span
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex size-14 items-center justify-center rounded-xl bg-primary text-2xl font-bold text-primary-foreground"
            >
              {num}
            </motion.span>
          ))
        ) : (
          <div className="flex gap-2">
            {sequence.map((_, i) => (
              <span key={i} className="flex size-14 items-center justify-center rounded-xl border-2 border-dashed border-border text-2xl">
                ?
              </span>
            ))}
          </div>
        )}
      </div>
      {!showSequence && (
        <div className="flex gap-2">
          <input
            type="text"
            value={userInput}
            onChange={e => setUserInput(e.target.value.replace(/\D/g, "").slice(0, sequence.length))}
            placeholder="أدخل الأرقام..."
            className="h-12 w-48 rounded-xl border bg-background px-4 text-center text-lg font-bold tracking-wider"
            autoFocus
          />
          <Button onClick={check} disabled={userInput.length !== sequence.length}>
            <Check className="size-4" />
          </Button>
        </div>
      )}
      <Button variant="ghost" onClick={onExit}>
        <ArrowLeft className="ml-2 size-4" />
        خروج
      </Button>
    </div>
  );
}

// 3-10: Reaction Speed
function ReactionSpeed({ onComplete, onExit }: MiniGameProps) {
  const [phase, setPhase] = useState<"waiting" | "ready" | "go" | "done">("waiting");
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [currentStart, setCurrentStart] = useState(0);
  const [round, setRound] = useState(0);
  const totalRounds = 5;

  const startRound = () => {
    setPhase("ready");
    setCurrentStart(0);
    const delay = 1000 + Math.random() * 3000;
    setTimeout(() => {
      setCurrentStart(Date.now());
      setPhase("go");
    }, delay);
  };

  const handleTap = () => {
    if (phase === "go") {
      const rt = Date.now() - currentStart;
      const newTimes = [...reactionTimes, rt];
      setReactionTimes(newTimes);
      if (round + 1 >= totalRounds) {
        const avg = newTimes.reduce((a, b) => a + b, 0) / newTimes.length;
        const score = Math.max(0, Math.round(500 - avg));
        onComplete(score, rt);
      } else {
        setRound(r => r + 1);
        setPhase("done");
      }
    } else if (phase === "ready") {
      setPhase("waiting");
      setRound(r => r);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">جولة {round + 1}/{totalRounds}</p>
        {reactionTimes.length > 0 && (
          <p className="text-xs text-muted-foreground">
            الأفضل: {Math.min(...reactionTimes)}ms | المتوسط: {Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)}ms
          </p>
        )}
      </div>
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={handleTap}
        className={cn(
          "flex h-64 w-full max-w-md items-center justify-center rounded-3xl text-2xl font-bold text-white transition-colors",
          phase === "waiting" && "bg-muted text-muted-foreground cursor-pointer",
          phase === "ready" && "bg-amber-500",
          phase === "go" && "bg-emerald-500",
          phase === "done" && "bg-primary",
        )}
      >
        {phase === "waiting" && "اضغط للبدء"}
        {phase === "ready" && "انتظر..."}
        {phase === "go" && "اضغط الآن! 🔴"}
        {phase === "done" && `✅ ${reactionTimes[reactionTimes.length - 1]}ms — اضغط للمتابعة`}
      </motion.button>
      <Button variant="ghost" onClick={onExit}>
        <ArrowLeft className="ml-2 size-4" />
        خروج
      </Button>
    </div>
  );
}

// 4-10: Word Scramble
function WordScramble({ onComplete, onExit }: MiniGameProps) {
  const words = ["ذكاء", "تحدي", "ذكاء", "معركة", "فوز", "سؤال", "سرعة", "منافسة", "بطل", "نجم"];
  const [currentWord, setCurrentWord] = useState("");
  const [scrambled, setScrambled] = useState("");
  const [userInput, setUserInput] = useState("");
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [startTime] = useState(Date.now());

  const scramble = (word: string): string => {
    const chars = word.split("");
    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join("") === word ? scramble(word) : chars.join("");
  };

  useEffect(() => {
    const word = words[round % words.length];
    setCurrentWord(word);
    setScrambled(scramble(word));
    setUserInput("");
  }, [round]);

  const check = () => {
    if (userInput === currentWord) {
      const newScore = score + 100;
      setScore(newScore);
      if (round + 1 >= 10) {
        onComplete(newScore, Date.now() - startTime);
      } else {
        setRound(r => r + 1);
      }
    } else {
      onComplete(score, Date.now() - startTime);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <Badge>جولة {round + 1}/10</Badge>
        <p className="mt-2 text-sm text-muted-foreground">النقاط: {score}</p>
      </div>
      <div className="flex gap-2 text-3xl font-bold tracking-wider">
        {scrambled.split("").map((char, i) => (
          <motion.span
            key={`${round}-${i}`}
            initial={{ rotateY: 180 }}
            animate={{ rotateY: 0 }}
            className="flex size-14 items-center justify-center rounded-xl border-2 border-primary/30 bg-primary/5"
          >
            {char}
          </motion.span>
        ))}
      </div>
      <input
        type="text"
        value={userInput}
        onChange={e => setUserInput(e.target.value)}
        placeholder="اكتب الكلمة الصحيحة..."
        className="h-12 w-64 rounded-xl border bg-background px-4 text-center text-lg font-bold"
        autoFocus
        onKeyDown={e => e.key === "Enter" && userInput.length > 0 && check()}
      />
      <Button onClick={check} disabled={userInput.length === 0}>
        تحقق
      </Button>
      <Button variant="ghost" onClick={onExit}>
        <ArrowLeft className="ml-2 size-4" />
        خروج
      </Button>
    </div>
  );
}

// 5-10: Color Match
function ColorMatch({ onComplete, onExit }: MiniGameProps) {
  const colors = ["🔴", "🟡", "🟢", "🔵", "🟣"];
  const colorNames = ["أحمر", "أصفر", "أخضر", "أزرق", "بنفسجي"];
  const [target, setTarget] = useState(0);
  const [options, setOptions] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [startTime] = useState(Date.now());

  const newRound = () => {
    const t = Math.floor(Math.random() * colors.length);
    setTarget(t);
    const opts = [t];
    while (opts.length < 4) {
      const r = Math.floor(Math.random() * colors.length);
      if (!opts.includes(r)) opts.push(r);
    }
    setOptions(opts.sort(() => Math.random() - 0.5));
  };

  useEffect(() => { newRound(); }, []);

  const pick = (index: number) => {
    if (index === target) {
      const newScore = score + 50;
      setScore(newScore);
      if (round + 1 >= 15) {
        onComplete(newScore, Date.now() - startTime);
      } else {
        setRound(r => r + 1);
        newRound();
      }
    } else {
      onComplete(score, Date.now() - startTime);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <Badge>جولة {round + 1}/15</Badge>
        <p className="mt-2 text-sm text-muted-foreground">النقاط: {score}</p>
      </div>
      <p className="text-2xl font-bold">اختر اللون: {colorNames[target]}</p>
      <div className="flex gap-4">
        {options.map((index) => (
          <motion.button
            key={`${round}-${index}`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => pick(index)}
            className="flex size-20 items-center justify-center rounded-2xl border-2 border-border bg-card text-4xl transition-all hover:border-primary"
          >
            {colors[index]}
          </motion.button>
        ))}
      </div>
      <Button variant="ghost" onClick={onExit}>
        <ArrowLeft className="ml-2 size-4" />
        خروج
      </Button>
    </div>
  );
}

// 6-10: Math Sprint
function MathSprint({ onComplete, onExit }: MiniGameProps) {
  const [problem, setProblem] = useState({ a: 0, b: 0, op: "+", answer: 0 });
  const [userAnswer, setUserAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [startTime] = useState(Date.now());

  const newProblem = () => {
    const ops = ["+", "-", "×"];
    const op = ops[Math.floor(Math.random() * ops.length)];
    const a = Math.floor(Math.random() * 20) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    let answer = 0;
    if (op === "+") answer = a + b;
    else if (op === "-") answer = a - b;
    else answer = a * b;
    setProblem({ a, b, op, answer });
    setUserAnswer("");
  };

  useEffect(() => { newProblem(); }, []);

  const check = () => {
    if (parseInt(userAnswer) === problem.answer) {
      const newScore = score + 75;
      setScore(newScore);
      if (round + 1 >= 12) {
        onComplete(newScore, Date.now() - startTime);
      } else {
        setRound(r => r + 1);
        newProblem();
      }
    } else {
      onComplete(score, Date.now() - startTime);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <Badge>جولة {round + 1}/12</Badge>
        <p className="mt-2 text-sm text-muted-foreground">النقاط: {score}</p>
      </div>
      <div className="flex items-center gap-4 text-4xl font-bold">
        <span>{problem.a}</span>
        <span className="text-primary">{problem.op}</span>
        <span>{problem.b}</span>
        <span>=</span>
        <span>?</span>
      </div>
      <input
        type="number"
        value={userAnswer}
        onChange={e => setUserAnswer(e.target.value)}
        className="h-14 w-32 rounded-xl border bg-background px-4 text-center text-2xl font-bold"
        autoFocus
        onKeyDown={e => e.key === "Enter" && userAnswer && check()}
      />
      <Button onClick={check} disabled={!userAnswer}>
        تحقق
      </Button>
      <Button variant="ghost" onClick={onExit}>
        <ArrowLeft className="ml-2 size-4" />
        خروج
      </Button>
    </div>
  );
}

// 7-10: Pattern Match
function PatternMatch({ onComplete, onExit }: MiniGameProps) {
  const [pattern, setPattern] = useState<number[]>([]);
  const [options, setOptions] = useState<number[]>([]);
  const [showPattern, setShowPattern] = useState(true);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    const len = Math.min(3 + Math.floor(round / 3), 7);
    const p = Array.from({ length: len }, () => Math.floor(Math.random() * 9));
    setPattern(p);
    setShowPattern(true);
    setTimeout(() => setShowPattern(false), 1500 + round * 200);
  }, [round]);

  const pick = (num: number) => {
    if (num === pattern[pattern.length - 1]) {
      const newScore = score + 100;
      setScore(newScore);
      if (round + 1 >= 8) {
        onComplete(newScore, Date.now() - startTime);
      } else {
        setRound(r => r + 1);
      }
    } else {
      onComplete(score, Date.now() - startTime);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <Badge>جولة {round + 1}/8</Badge>
        <p className="mt-2 text-sm text-muted-foreground">النقاط: {score}</p>
      </div>
      <div className="flex gap-2">
        {pattern.map((num, i) => (
          <motion.span
            key={`${round}-${i}`}
            initial={{ scale: 0 }}
            animate={{ scale: showPattern ? 1 : 0.5 }}
            className={cn(
              "flex size-14 items-center justify-center rounded-xl text-2xl font-bold transition-all",
              showPattern ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            {showPattern ? ["🔴", "🟡", "🟢", "🔵", "🟣", "🟠", "⚪", "🟤", "🔴"][num] : "·"}
          </motion.span>
        ))}
      </div>
      {!showPattern && (
        <div className="flex flex-wrap justify-center gap-2">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(num => (
            <motion.button
              key={num}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => pick(num)}
              className="flex size-14 items-center justify-center rounded-xl border-2 border-border bg-card text-2xl transition-all hover:border-primary"
            >
              {["🔴", "🟡", "🟢", "🔵", "🟣", "🟠", "⚪", "🟤", "🔴"][num]}
            </motion.button>
          ))}
        </div>
      )}
      <Button variant="ghost" onClick={onExit}>
        <ArrowLeft className="ml-2 size-4" />
        خروج
      </Button>
    </div>
  );
}

// 8-10: Word Chain
function WordChain({ onComplete, onExit }: MiniGameProps) {
  const words = ["ذكاء", "ة", " gioc", "gt", "top", "puzzle", "ل", "لغز", "ز"];
  const pairs = [
    ["ذكاء", "ة"], ["ذكاء", "اء"], ["الفوز", "وز"],
  ];
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [startTime] = useState(Date.now());

  const items = [
    { word: "ذكاء", lastChar: "ء", options: ["اء", "ؤ", "ئ"] },
    { word: "تحدي", lastChar: "ي", options: ["ى", "ي", "ئ"] },
    { word: "منافسة", lastChar: "ة", options: ["ة", "ه", "إ"] },
  ];

  const pick = (correct: boolean) => {
    const newScore = correct ? score + 100 : score;
    if (correct) setScore(newScore);
    if (current + 1 >= items.length || !correct) {
      onComplete(correct ? newScore : score, Date.now() - startTime);
    } else {
      setCurrent(c => c + 1);
    }
  };

  const item = items[current];

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <Badge>سؤال {current + 1}/{items.length}</Badge>
        <p className="mt-2 text-sm text-muted-foreground">النقاط: {score}</p>
      </div>
      <p className="text-xl font-bold">ما آخر حرف من كلمة "{item.word}"؟</p>
      <div className="flex gap-3">
        {item.options.map((opt, i) => (
          <motion.button
            key={i}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => pick(opt === item.lastChar)}
            className="flex h-16 w-24 items-center justify-center rounded-xl border-2 border-border bg-card text-xl font-bold transition-all hover:border-primary"
          >
            {opt}
          </motion.button>
        ))}
      </div>
      <Button variant="ghost" onClick={onExit}>
        <ArrowLeft className="ml-2 size-4" />
        خروج
      </Button>
    </div>
  );
}

// 9-10: Tic-Tac-Toe vs AI
function TicTacToe({ onComplete, onExit }: MiniGameProps) {
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [startTime] = useState(Date.now());
  const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

  const checkWinner = (b: (string | null)[]) => {
    for (const [a, c, d] of wins) {
      if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
    }
    return null;
  };

  const aiMove = (b: (string | null)[]) => {
    const empty = b.map((v, i) => v === null ? i : -1).filter(i => i >= 0);
    if (empty.length === 0) return;
    // Simple AI: block or win
    for (const i of empty) {
      const test = [...b]; test[i] = "O";
      if (checkWinner(test) === "O") { makeMove(i); return; }
    }
    for (const i of empty) {
      const test = [...b]; test[i] = "X";
      if (checkWinner(test) === "X") { makeMove(i); return; }
    }
    makeMove(empty[Math.floor(Math.random() * empty.length)]);
  };

  const makeMove = (index: number) => {
    setBoard(prev => {
      const next = [...prev];
      next[index] = isPlayerTurn ? "X" : "O";
      const winner = checkWinner(next);
      if (winner) {
        setTimeout(() => onComplete(winner === "X" ? 300 : 50, Date.now() - startTime), 300);
      } else if (next.every(v => v !== null)) {
        setTimeout(() => onComplete(150, Date.now() - startTime), 300);
      }
      return next;
    });
    setIsPlayerTurn(p => !p);
  };

  const handleCell = (index: number) => {
    if (board[index] || !isPlayerTurn) return;
    makeMove(index);
    setTimeout(() => {
      setBoard(prev => {
        const empty = prev.map((v, i) => v === null ? i : -1).filter(i => i >= 0);
        if (empty.length === 0) return prev;
        const next = [...prev];
        // AI blocks/wins
        for (const i of empty) { const t = [...next]; t[i] = "O"; if (checkWinner(t) === "O") { next[i] = "O"; return next; } }
        for (const i of empty) { const t = [...next]; t[i] = "X"; if (checkWinner(t) === "X") { next[i] = "O"; return next; } }
        next[empty[Math.floor(Math.random() * empty.length)]] = "O";
        const winner = checkWinner(next);
        if (winner) setTimeout(() => onComplete(winner === "X" ? 300 : 50, Date.now() - startTime), 300);
        else if (next.every(v => v !== null)) setTimeout(() => onComplete(150, Date.now() - startTime), 300);
        return next;
      });
      setIsPlayerTurn(true);
    }, 400);
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-lg font-bold">❌ XOR ⭕ — هزم الذكاء الاصطناعي!</p>
      <div className="grid grid-cols-3 gap-2">
        {board.map((cell, i) => (
          <motion.button
            key={i}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleCell(i)}
            className={cn(
              "flex size-20 items-center justify-center rounded-xl border-2 text-3xl font-bold transition-all",
              cell === "X" && "border-primary bg-primary/10 text-primary",
              cell === "O" && "border-rose-500 bg-rose-500/10 text-rose-600",
              !cell && "border-border bg-muted hover:border-primary/50"
            )}
          >
            {cell}
          </motion.button>
        ))}
      </div>
      <Button variant="ghost" onClick={onExit}>
        <ArrowLeft className="ml-2 size-4" />
        خروج
      </Button>
    </div>
  );
}

// 10-10: Quick Trivia
function QuickTrivia({ onComplete, onExit }: MiniGameProps) {
  const questions = [
    { q: "عاصمة اليابان؟", opts: ["طوكيو", "أوساكا", "كيوتو", "ناغويا"], correct: 0 },
    { q: "أكبر كوكب في المجموعة الشمسية؟", opts: ["المشتري", "زحل", "نبتون", "أورانوس"], correct: 0 },
    { q: "كم عدد أضلاع المثلث؟", opts: ["3", "4", "5", "6"], correct: 0 },
    { q: "أين يقع برج إيفل؟", opts: ["باريس", "لندن", "روما", "برلين"], correct: 0 },
    { q: "ما هو العنصر الكيميائي Au؟", opts: ["الذهب", "الفضة", "النحاس", "الحديد"], correct: 0 },
  ];
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [startTime] = useState(Date.now());

  const pick = (index: number) => {
    const correct = index === questions[current].correct;
    const newScore = correct ? score + 100 : score;
    if (current + 1 >= questions.length || !correct) {
      onComplete(correct ? newScore : score, Date.now() - startTime);
    } else {
      setScore(newScore);
      setCurrent(c => c + 1);
    }
  };

  const q = questions[current];

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <Badge>سؤال {current + 1}/{questions.length}</Badge>
        <p className="mt-2 text-sm text-muted-foreground">النقاط: {score}</p>
      </div>
      <p className="text-xl font-bold text-center max-w-md">{q.q}</p>
      <div className="grid w-full max-w-md grid-cols-2 gap-3">
        {q.opts.map((opt, i) => (
          <motion.button
            key={i}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => pick(i)}
            className="rounded-xl border-2 border-border bg-card p-4 text-center font-semibold transition-all hover:border-primary hover:bg-primary/5"
          >
            {opt}
          </motion.button>
        ))}
      </div>
      <Button variant="ghost" onClick={onExit}>
        <ArrowLeft className="ml-2 size-4" />
        خروج
      </Button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Game Category Definitions (80 games total)
// ──────────────────────────────────────────────────────────────────────

const GAME_CATEGORIES: GameCategory[] = [
  {
    id: "memory",
    name: "الذاكرة والتركيز",
    icon: Brain,
    color: "text-violet-600 bg-violet-500/10",
    games: [
      { id: "mem1", name: "شبكة الذاكرة", description: "اقلب البطاقات وأتطابق الأزواج", difficulty: "easy", players: "1", xpReward: 50, timeLimit: 60, component: MemoryGrid, features: ["ذاكرة مكانية", "مطابقة سريعة", "تتبع الأزواج"] },
      { id: "mem2", name: "تسلسل الأرقام", description: "تذكر التسلسل الرقمي المتزايد", difficulty: "medium", players: "1", xpReward: 75, timeLimit: 45, component: NumberSequence, features: ["ذاكرة رقمية", "تسلسل متزايد", "تركيز"] },
      { id: "mem3", name: "نماذج الألوان", description: "تذكر ترتيب الألوان وكرره", difficulty: "easy", players: "1", xpReward: 40, timeLimit: 30, component: PatternMatch, features: ["ذاكرة بصرية", "تقليد أنماط", "إدراك"] },
      { id: "mem4", name: "ذاكرة الأرقام", description: "4×4 شبكة — اذكر الأرقام المخفية", difficulty: "medium", players: "1", xpReward: 80, timeLimit: 60, component: MemoryGrid, features: ["ذاكرة مكانية", "تركيز"] },
      { id: "mem5", name: "تسلسل الكسور", description: "أكمل التسلسل العددي", difficulty: "hard", players: "1", xpReward: 100, timeLimit: 45, component: NumberSequence, features: ["منطق"] },
      { id: "mem6", name: "نظام الألوان المتقدم", description: "تسلسل ألوان أطول وأسرع", difficulty: "hard", players: "1", xpReward: 120, timeLimit: 30, component: PatternMatch, features: ["سرعة"] },
      { id: "mem7", name: "ذاكرة كلمات", description: "تذكر الكلمات بالترتيب", difficulty: "medium", players: "1", xpReward: 70, timeLimit: 60, component: WordScramble, features: ["لغة"] },
      { id: "mem8", name: "نظام الأرقام السريع", description: "أرقام سريعة جداً", difficulty: "hard", players: "1", xpReward: 110, timeLimit: 30, component: NumberSequence, features: ["سرعة"] },
      { id: "mem9", name: "تسلسل الأشكال", description: "تذكر ترتيب الأشكال", difficulty: "easy", players: "1", xpReward: 45, timeLimit: 45, component: PatternMatch, features: ["بصري"] },
      { id: "mem10", name: "تحدي الذاكرة الخارق", description: "سلسلة طويلة من التحديات", difficulty: "hard", players: "1", xpReward: 150, timeLimit: 90, component: NumberSequence, tier: "diamond", features: ["عبقرية"] },
      { id: "mem11", name: "ذاكرة الوجوه", description: "اتذكر الأزواج البصرية", difficulty: "medium", players: "1", xpReward: 85, timeLimit: 60, component: MemoryGrid, features: ["ذاكرة بصرية"] },
      { id: "mem12", name: "سلسلة بت", description: "تذكر التسلسل الثنائي", difficulty: "hard", players: "1", xpReward: 115, timeLimit: 35, component: NumberSequence, features: ["منطق"] },
      { id: "mem13", name: "ألوان متتالية", description: "تذكر متتالية الألوان", difficulty: "easy", players: "1", xpReward: 55, timeLimit: 30, component: PatternMatch, features: ["بصري"] },
      { id: "mem14", name: "ذاكرة مسار", description: "تذكر مسار الحركة", difficulty: "medium", players: "1", xpReward: 90, timeLimit: 60, component: NumberSequence, features: ["ذاكرة حركية"] },
      { id: "mem15", name: "تحدي الـ 20", description: "20 بطاقة في 20 ثانية", difficulty: "hard", players: "1", xpReward: 145, timeLimit: 20, component: MemoryGrid, features: ["عبقرية"] },
    ],
  },
  {
    id: "speed",
    name: "السرعة والردود",
    icon: Zap,
    color: "text-amber-600 bg-amber-500/10",
    games: [
      { id: "spd1", name: "سرعة الردة", description: "اضغط أسرع متى ما أشار", difficulty: "easy", players: "1", xpReward: 60, timeLimit: 30, component: ReactionSpeed },
      { id: "spd2", name: "مطابقة الألوان", description: "اختر اللون الصحيح بسرعة", difficulty: "easy", players: "1", xpReward: 50, timeLimit: 45, component: ColorMatch },
      { id: "spd3", name: "حسابات رياضية", description: "حسابات رياضية سريعة", difficulty: "medium", players: "1", xpReward: 75, timeLimit: 45, component: MathSprint },
      { id: "spd4", name: "تحدي السرعة", description: "ردود أفعال فائقة السرعة", difficulty: "medium", players: "1", xpReward: 80, timeLimit: 30, component: ReactionSpeed },
      { id: "spd5", name: "ألوان مركبة", description: "مطابقة ألوان مركبة", difficulty: "hard", players: "1", xpReward: 100, timeLimit: 30, component: ColorMatch },
      { id: "spd6", name: "حساب خاطف", description: "مسائل رياضية بسرعة البرق", difficulty: "hard", players: "1", xpReward: 110, timeLimit: 30, component: MathSprint },
      { id: "spd7", name: "رد سريع", description: "اختبر سرعة رد فعلك", difficulty: "easy", players: "1", xpReward: 40, timeLimit: 20, component: ReactionSpeed },
      { id: "spd8", name: "ألوان متصاعدة", description: "ألوان سريعة ومتصاعدة", difficulty: "medium", players: "1", xpReward: 70, timeLimit: 40, component: ColorMatch },
      { id: "spd9", name: "مسائل متقدمة", description: "مسائل رياضية متقدمة", difficulty: "hard", players: "1", xpReward: 120, timeLimit: 30, component: MathSprint },
      { id: "spd10", name: "تحدي السرعة الخارق", description: "تحدي السرعة الخارق", difficulty: "hard", players: "1", xpReward: 150, timeLimit: 25, component: ReactionSpeed, tier: "silver" },
      { id: "spd11", name: "برق الاستجابة", description: "استجابة فيậmًا كسريع", difficulty: "medium", players: "1", xpReward: 90, timeLimit: 25, component: ReactionSpeed },
      { id: "spd12", name: "ألوان مزدوجة", description: "تركيز على لونين معًا", difficulty: "hard", players: "1", xpReward: 125, timeLimit: 20, component: ColorMatch },
    ],
  },
  {
    id: "words",
    name: "الكلمات واللغة",
    icon: Globe,
    color: "text-emerald-600 bg-emerald-500/10",
    games: [
      { id: "wrd1", name: "خلط الكلمات", description: "رتب الحروف لتكوين كلمة", difficulty: "easy", players: "1", xpReward: 50, timeLimit: 30, component: WordScramble, features: ["لغة"] },
      { id: "wrd2", name: "سلسلة الكلمات", description: "اختر الكلمة الصحيحة", difficulty: "medium", players: "1", xpReward: 70, timeLimit: 45, component: WordChain, features: ["لغة"] },
      { id: "wrd3", name: "معلومات عامة", description: "أسئلة معلومات متنوعة", difficulty: "medium", players: "1", xpReward: 80, timeLimit: 60, component: QuickTrivia, features: ["معرفة"] },
      { id: "wrd4", name: "كلمات أصعب", description: "كلمات أصعب وأكثر تعقيداً", difficulty: "hard", players: "1", xpReward: 100, timeLimit: 25, component: WordScramble, features: ["لغة"] },
      { id: "wrd5", name: "سلسلة لغوية", description: "سلسلة لغوية متقدمة", difficulty: "hard", players: "1", xpReward: 110, timeLimit: 40, component: WordChain, features: ["لغة"] },
      { id: "wrd6", name: "معلومات احترافية", description: "معلومات عامة احترافية", difficulty: "hard", players: "1", xpReward: 120, timeLimit: 50, component: QuickTrivia, features: ["معرفة"] },
      { id: "wrd7", name: "كلمات سريعة", description: "كلمات سريعة", difficulty: "easy", players: "1", xpReward: 40, timeLimit: 35, component: WordScramble, features: ["لغة"] },
      { id: "wrd8", name: "ملك المعلومات", description: "ملك المعلومات العامة", difficulty: "medium", players: "1", xpReward: 75, timeLimit: 55, component: QuickTrivia, features: ["معرفة"] },
      { id: "wrd9", name: "سيد الكلمات", description: "سيد الكلمات", difficulty: "hard", players: "1", xpReward: 130, timeLimit: 30, component: WordScramble, features: ["لغة"] },
      { id: "wrd10", name: "تحدي المعلومات الخارق", description: "تحدي المعلومات الخارق", difficulty: "hard", players: "1", xpReward: 150, timeLimit: 60, component: QuickTrivia, tier: "diamond", features: ["عبقرية"] },
      { id: "wrd11", name: "لغز الكلمة", description: "احدد كلمة من تلميحات", difficulty: "medium", players: "1", xpReward: 80, timeLimit: 45, component: WordScramble, features: ["لغة"] },
      { id: "wrd12", name: "سيد اللغة", description: "لغز نحوي وصرفي", difficulty: "hard", players: "1", xpReward: 135, timeLimit: 40, component: WordChain, features: ["لغة"] },
    ],
  },
  {
    id: "strategy",
    name: "الاستراتيجية والمنطق",
    icon: Target,
    color: "text-rose-600 bg-rose-500/10",
    games: [
      { id: "stg1", name: "اكس أو", description: "هزم الذكاء الاصطناعي في اللوح", difficulty: "easy", players: "1", xpReward: 60, timeLimit: 120, component: TicTacToe, features: ["استراتيجية"] },
      { id: "stg2", name: "تحدي المنطق", description: "مسائل منطقية مختلفة", difficulty: "medium", players: "1", xpReward: 80, timeLimit: 90, component: NumberSequence, features: ["منطق"] },
      { id: "stg3", name: "استراتيجية الأرقام", description: "خطط للفوز بالأرقام", difficulty: "medium", players: "1", xpReward: 85, timeLimit: 120, component: TicTacToe, features: ["استراتيجية"] },
      { id: "stg4", name: "هزم الذكاء المتقدم", description: "هزم الذكاء الاصطناعي المتقدم", difficulty: "hard", players: "1", xpReward: 120, timeLimit: 90, component: TicTacToe, features: ["استراتيجية"] },
      { id: "stg5", name: "سيد المنطق", description: "سيد المنطق", difficulty: "hard", players: "1", xpReward: 110, timeLimit: 60, component: NumberSequence, features: ["منطق"] },
      { id: "stg6", name: "عقل استراتيجي", description: "عقل استراتيجي", difficulty: "medium", players: "1", xpReward: 90, timeLimit: 120, component: TicTacToe, features: ["استراتيجية"] },
      { id: "stg7", name: "منطق سريع", description: "منطق سريع", difficulty: "easy", players: "1", xpReward: 55, timeLimit: 60, component: NumberSequence, features: ["منطق"] },
      { id: "stg8", name: "استراتيجية كبرى", description: "استراتيجية كبرى", difficulty: "hard", players: "1", xpReward: 130, timeLimit: 150, component: TicTacToe, features: ["استراتيجية"] },
      { id: "stg9", name: "منطق مطلق", description: "منطق مطلق", difficulty: "hard", players: "1", xpReward: 140, timeLimit: 90, component: NumberSequence, features: ["منطق"] },
      { id: "stg10", name: "السيد الأعلى", description: "السيد الأعلى", difficulty: "hard", players: "1", xpReward: 160, timeLimit: 120, component: TicTacToe, tier: "gold", features: ["عبقرية"] },
      { id: "stg11", name: "لغز الاستراتيجية", description: "خطط لتفوز بتحدي المنطق", difficulty: "medium", players: "1", xpReward: 100, timeLimit: 90, component: TicTacToe, features: ["استراتيجية"] },
      { id: "stg12", name: "عبقرية المنطق", description: "عبقرية المنطق وإكمال التسلسل", difficulty: "hard", players: "1", xpReward: 150, timeLimit: 70, component: NumberSequence, features: ["منطق"] },
    ],
  },
  {
    id: "numbers",
    name: "الأرقام والرياضيات",
    icon: Calculator,
    color: "text-blue-600 bg-blue-500/10",
    games: [
      { id: "num1", name: "مسائل جمع وطرح", description: "مسائل جمع وطرح", difficulty: "easy", players: "1", xpReward: 40, timeLimit: 45, component: MathSprint, features: ["رياضيات"] },
      { id: "num2", name: "ضرب وقسمة", description: "مسائل ضرب وقسمة", difficulty: "medium", players: "1", xpReward: 80, timeLimit: 40, component: MathSprint, features: ["رياضيات"] },
      { id: "num3", name: "مسائل رياضية صعبة", description: "مسائل رياضية صعبة", difficulty: "hard", players: "1", xpReward: 120, timeLimit: 35, component: MathSprint, features: ["رياضيات"] },
      { id: "num4", name: "حاسبة بشرية", description: "حاسبة بشرية", difficulty: "medium", players: "1", xpReward: 90, timeLimit: 30, component: MathSprint, features: ["رياضيات"] },
      { id: "num5", name: "نينجا الأرقام", description: "نينجا الأرقام", difficulty: "hard", players: "1", xpReward: 130, timeLimit: 25, component: MathSprint, features: ["رياضيات"] },
      { id: "num6", name: "برق الأرقام", description: "برق الأرقام", difficulty: "easy", players: "1", xpReward: 50, timeLimit: 30, component: MathSprint, features: ["رياضيات"] },
      { id: "num7", name: "أرقام عشرية", description: "أرقام عشرية سريعة", difficulty: "medium", players: "1", xpReward: 85, timeLimit: 35, component: MathSprint, features: ["رياضيات"] },
      { id: "num8", name: "كسور وقصور", description: "كسور وقصور", difficulty: "hard", players: "1", xpReward: 110, timeLimit: 40, component: MathSprint, features: ["رياضيات"] },
      { id: "num9", name: "جبر مبسط", description: "جبر مبسط", difficulty: "hard", players: "1", xpReward: 140, timeLimit: 30, component: MathSprint, features: ["رياضيات"] },
      { id: "num10", name: "أسطورة الرياضيات", description: "أسطورة الرياضيات", difficulty: "hard", players: "1", xpReward: 160, timeLimit: 20, component: MathSprint, tier: "gold", features: ["عبقرية"] },
      { id: "num11", name: "عبقرية الحساب", description: "تحدي سرعة الحساب الذهني", difficulty: "medium", players: "1", xpReward: 95, timeLimit: 35, component: MathSprint, features: ["رياضيات"] },
      { id: "num12", name: "عبقرية الجبر", description: "تحدي جبري متقدم", difficulty: "hard", players: "1", xpReward: 150, timeLimit: 30, component: MathSprint, features: ["رياضيات"] },
    ],
  },
  {
    id: "visual",
    name: "البصريات والإدراك",
    icon: Eye,
    color: "text-teal-600 bg-teal-500/10",
    games: [
      { id: "vis1", name: "نمط بصري", description: "اكتشف النمط", difficulty: "easy", players: "1", xpReward: 50, timeLimit: 45, component: PatternMatch, features: ["بصري"] },
      { id: "vis2", name: "عبقري الألوان", description: "عبقري الألوان", difficulty: "medium", players: "1", xpReward: 75, timeLimit: 40, component: ColorMatch, features: ["بصري"] },
      { id: "vis3", name: "ذاكرة بصرية", description: "ذاكرة بصرية", difficulty: "medium", players: "1", xpReward: 80, timeLimit: 50, component: PatternMatch, features: ["بصري"] },
      { id: "vis4", name: "سيد الأنماط", description: "سيد الأنماط", difficulty: "hard", players: "1", xpReward: 100, timeLimit: 35, component: PatternMatch, features: ["بصري"] },
      { id: "vis5", name: "ملك الألوان", description: "ملك الألوان", difficulty: "hard", players: "1", xpReward: 110, timeLimit: 30, component: ColorMatch, features: ["بصري"] },
      { id: "vis6", name: "اختبار العين", description: "اختبار العين", difficulty: "easy", players: "1", xpReward: 45, timeLimit: 40, component: ColorMatch, features: ["بصري"] },
      { id: "vis7", name: "سرعة بصرية", description: "سرعة بصرية", difficulty: "medium", players: "1", xpReward: 70, timeLimit: 35, component: PatternMatch, features: ["بصري"] },
      { id: "vis8", name: "برق الألوان", description: "برق الألوان", difficulty: "hard", players: "1", xpReward: 120, timeLimit: 25, component: ColorMatch, features: ["بصري"] },
      { id: "vis9", name: "محترف الأنماط", description: "محترف الأنماط", difficulty: "hard", players: "1", xpReward: 130, timeLimit: 30, component: PatternMatch, features: ["بصري"] },
      { id: "vis10", name: "أسطورة البصر", description: "أسطورة البصر", difficulty: "hard", players: "1", xpReward: 150, timeLimit: 25, component: PatternMatch, features: ["بصري"] },
      { id: "vis11", name: "عبقرية التمييز البصري", description: "عبقرية التمييز البصري", difficulty: "medium", players: "1", xpReward: 95, timeLimit: 45, component: PatternMatch, features: ["بصري"] },
      { id: "vis12", name: "ملك الإدراك", description: "ملك الإدراك البصري", difficulty: "hard", players: "1", xpReward: 140, timeLimit: 30, component: ColorMatch, features: ["بصري"] },
    ],
  },
  {
    id: "challenge",
    name: "تحديات متنوعة",
    icon: Swords,
    color: "text-orange-600 bg-orange-500/10",
    games: [
      { id: "ch1", name: "معلومات سريعة", description: "معلومات سريعة", difficulty: "easy", players: "1", xpReward: 50, timeLimit: 60, component: QuickTrivia },
      { id: "ch2", name: "مختلط عبقري", description: "مختلط عبقري", difficulty: "medium", players: "1", xpReward: 90, timeLimit: 90, component: WordScramble },
      { id: "ch3", name: "جوانب متعددة", description: "جوانب متعددة", difficulty: "hard", players: "1", xpReward: 120, timeLimit: 120, component: TicTacToe },
      { id: "ch4", name: "وضع Turbo", description: "وضع Turbo", difficulty: "medium", players: "1", xpReward: 80, timeLimit: 30, component: ReactionSpeed },
      { id: "ch5", name: "جولة فوضى", description: "جولة فوضى", difficulty: "hard", players: "1", xpReward: 130, timeLimit: 60, component: MathSprint },
      { id: "ch6", name: "لعبة مزدوجة", description: "لعبة مزدوجة", difficulty: "easy", players: "1", xpReward: 60, timeLimit: 90, component: MemoryGrid },
      { id: "ch7", name: "وضع Hyper", description: "وضع Hyper", difficulty: "hard", players: "1", xpReward: 140, timeLimit: 45, component: WordScramble },
      { id: "ch8", name: "ماراثون الألعاب", description: "ماراثون الألعاب", difficulty: "hard", players: "1", xpReward: 160, timeLimit: 180, component: QuickTrivia },
      { id: "ch9", name: "برق المعارك", description: "برق المعارك", difficulty: "medium", players: "1", xpReward: 85, timeLimit: 40, component: ColorMatch },
      { id: "ch10", name: "الفوضى المطلقة", description: "الفوضى المطلقة", difficulty: "hard", players: "1", xpReward: 180, timeLimit: 120, component: NumberSequence, tier: "silver" },
      { id: "ch11", name: "عبقرية التحدي", description: "تحدي عبقري متنوع", difficulty: "hard", players: "1", xpReward: 155, timeLimit: 90, component: TicTacToe },
      { id: "ch12", name: "تحدي الخلط الذهني", description: "تحدي الخلط الذهني", difficulty: "hard", players: "1", xpReward: 175, timeLimit: 60, component: WordScramble },
    ],
  },
  {
    id: "expert",
    name: "تحديات خبراء",
    icon: Crown,
    color: "text-pink-600 bg-pink-500/10",
    games: [
      { id: "exp1", name: "عقل عبقري", description: "عقل عبقري", difficulty: "hard", players: "1", xpReward: 130, timeLimit: 90, component: NumberSequence, features: ["عبقرية"] },
      { id: "exp2", name: "السيد الأكبر", description: "السيد الأكبر", difficulty: "hard", players: "1", xpReward: 150, timeLimit: 120, component: TicTacToe, features: ["عبقرية"] },
      { id: "exp3", name: "صياد القمة", description: "صياد القمة", difficulty: "hard", players: "1", xpReward: 140, timeLimit: 60, component: PatternMatch, features: ["عبقرية"] },
      { id: "exp4", name: "اختبار الذكاء", description: "اختبار الذكاء", difficulty: "hard", players: "1", xpReward: 160, timeLimit: 120, component: NumberSequence, features: ["عبقرية"] },
      { id: "exp5", name: "عاصفة العقل", description: "عاصفة العقل", difficulty: "hard", players: "1", xpReward: 170, timeLimit: 90, component: MathSprint, features: ["عبقرية"] },
      { id: "exp6", name: "لغز الدماغ", description: "لغز الدماغ", difficulty: "hard", players: "1", xpReward: 145, timeLimit: 100, component: WordScramble, features: ["عبقرية"] },
      { id: "exp7", name: "بوابة المنطق", description: "بوابة المنطق", difficulty: "hard", players: "1", xpReward: 155, timeLimit: 80, component: NumberSequence, features: ["عبقرية"] },
      { id: "exp8", name: "سيّد الزن", description: "سيّد الزن", difficulty: "hard", players: "1", xpReward: 135, timeLimit: 150, component: PatternMatch, features: ["عبقرية"] },
      { id: "exp9", name: "التشوه الزمني", description: "التشوه الزمني", difficulty: "hard", players: "1", xpReward: 165, timeLimit: 60, component: ReactionSpeed, features: ["عبقرية"] },
      { id: "exp10", name: "عبقرية لا نهائية", description: "عبقرية لا نهائية", difficulty: "hard", players: "1", xpReward: 200, timeLimit: 120, component: TicTacToe, tier: "diamond", features: ["عبقرية"] },
      { id: "exp11", name: "عبقرية الذاكرة الخارقة", description: "عبقرية الذاكرة الخارقة", difficulty: "hard", players: "1", xpReward: 185, timeLimit: 85, component: MemoryGrid, features: ["عبقرية"] },
      { id: "exp12", name: "عبقرية السرعة المطلقة", description: "عبقرية السرعة المطلقة", difficulty: "hard", players: "1", xpReward: 195, timeLimit: 45, component: ReactionSpeed, features: ["عبقرية"] },
    ],
  },
];

export { GAME_CATEGORIES };
