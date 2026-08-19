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
    ["ذكاء", "ة"], ["ذكاء", "اء"], ["胜负", "胜"],
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
      { id: "mem1", name: "شبكة الذاكرة", description: "اقلب البطاقات وأتطابق الأزواج", difficulty: "easy", players: "1", xpReward: 50, timeLimit: 60, component: MemoryGrid },
      { id: "mem2", name: "تسلسل الأرقام", description: "تذكر التسلسل الرقمي المتزايد", difficulty: "medium", players: "1", xpReward: 75, timeLimit: 45, component: NumberSequence },
      { id: "mem3", name: "نماذج الألوان", description: "تذكر ترتيب الألوان وكرره", difficulty: "easy", players: "1", xpReward: 40, timeLimit: 30, component: PatternMatch },
      { id: "mem4", name: "ذاكرة الأرقام", description: "4×4 شبكة — اذكر الأرقام المخفية", difficulty: "medium", players: "1", xpReward: 80, timeLimit: 60, component: MemoryGrid },
      { id: "mem5", name: "تسلسل الكسور", description: "أكمل التسلسل العددي", difficulty: "hard", players: "1", xpReward: 100, timeLimit: 45, component: NumberSequence },
      { id: "mem6", name: "نظام الألوان المتقدم", description: "تسلسل ألوان أطول وأسرع", difficulty: "hard", players: "1", xpReward: 120, timeLimit: 30, component: PatternMatch },
      { id: "mem7", name: "ذاكرة كلمات", description: "تذكر الكلمات بالترتيب", difficulty: "medium", players: "1", xpReward: 70, timeLimit: 60, component: WordScramble },
      { id: "mem8", name: "نظام الأرقام السريع", description: "أرقام سريعة جداً", difficulty: "hard", players: "1", xpReward: 110, timeLimit: 30, component: NumberSequence },
      { id: "mem9", name: "تسلسل الأشكال", description: "تذكر ترتيب الأشكال", difficulty: "easy", players: "1", xpReward: 45, timeLimit: 45, component: PatternMatch },
      { id: "mem10", name: "تحدي الذاكرة الخارق", description: "سلسلة طويلة من التحديات", difficulty: "hard", players: "1", xpReward: 150, timeLimit: 90, component: NumberSequence },
    ],
  },
  {
    id: "speed",
    name: "السرعة والردود",
    icon: Zap,
    color: "text-amber-600 bg-amber-500/10",
    games: [
      { id: "spd1", name: "سرعة الردة", description: "اضغط أسرع مPossible عند الإشارة", difficulty: "easy", players: "1", xpReward: 60, timeLimit: 30, component: ReactionSpeed },
      { id: "spd2", name: "مطابقة الألوان", description: "اختر اللون الصحيح بسرعة", difficulty: "easy", players: "1", xpReward: 50, timeLimit: 45, component: ColorMatch },
      { id: "spd3", name: "الموسم الرياضي", description: "حسابات رياضية سريعة", difficulty: "medium", players: "1", xpReward: 75, timeLimit: 45, component: MathSprint },
      { id: "spd4", name: "تحدي السرعة", description: "ردود أفعال فائقة السرعة", difficulty: "medium", players: "1", xpReward: 80, timeLimit: 30, component: ReactionSpeed },
      { id: "spd5", name: " nflaichess", description: "مطابقة ألوان مركبة", difficulty: "hard", players: "1", xpReward: 100, timeLimit: 30, component: ColorMatch },
      { id: "spd6", name: "حساب خاطف", description: "مسائل رياضية بسرعة البرق", difficulty: "hard", players: "1", xpReward: 110, timeLimit: 30, component: MathSprint },
      { id: "spd7", name: "رد سريع", description: "اختبر سرعة رد فعلك", difficulty: "easy", players: "1", xpReward: 40, timeLimit: 20, component: ReactionSpeed },
      { id: "spd8", name: "akhbar", description: "ألوان سريعة ومتصاعدة", difficulty: "medium", players: "1", xpReward: 70, timeLimit: 40, component: ColorMatch },
      { id: "spd9", name: "mathKing", description: "مسائل رياضية متقدمة", difficulty: "hard", players: "1", xpReward: 120, timeLimit: 30, component: MathSprint },
      { id: "spd10", name: "SUPER_SPEED", description: "تحدي السرعة الخارق", difficulty: "hard", players: "1", xpReward: 150, timeLimit: 25, component: ReactionSpeed },
    ],
  },
  {
    id: "words",
    name: "الكلمات واللغة",
    icon: Globe,
    color: "text-emerald-600 bg-emerald-500/10",
    games: [
      { id: "wrd1", name: "خلط الكلمات", description: "رتب الحروف لتكوين كلمة", difficulty: "easy", players: "1", xpReward: 50, timeLimit: 30, component: WordScramble },
      { id: "wrd2", name: "سلسلة الكلمات", description: "اختر الكلمة الصحيحة", difficulty: "medium", players: "1", xpReward: 70, timeLimit: 45, component: WordChain },
      { id: "wrd3", name: "معلومات عامة", description: "أسئلة معلومات متنوعة", difficulty: "medium", players: "1", xpReward: 80, timeLimit: 60, component: QuickTrivia },
      { id: "wrd4", name: "aksent", description: "كلمات أصعب وأكثر تعقيداً", difficulty: "hard", players: "1", xpReward: 100, timeLimit: 25, component: WordScramble },
      { id: "wrd5", name: "worldClass", description: "سلسلة لغوية متقدمة", difficulty: "hard", players: "1", xpReward: 110, timeLimit: 40, component: WordChain },
      { id: "wrd6", name: "triviaPro", description: "معلومات عامة احترافية", difficulty: "hard", players: "1", xpReward: 120, timeLimit: 50, component: QuickTrivia },
      { id: "wrd7", name: "speedWords", description: "كلمات سريعة", difficulty: "easy", players: "1", xpReward: 40, timeLimit: 35, component: WordScramble },
      { id: "wrd8", name: "triviaKing", description: "ملك المعلومات العامة", difficulty: "medium", players: "1", xpReward: 75, timeLimit: 55, component: QuickTrivia },
      { id: "wrd9", name: "wordMaster", description: "سيد الكلمات", difficulty: "hard", players: "1", xpReward: 130, timeLimit: 30, component: WordScramble },
      { id: "wrd10", name: "ULTIMATE_TRIVIA", description: "تحدي المعلومات الخارق", difficulty: "hard", players: "1", xpReward: 150, timeLimit: 60, component: QuickTrivia },
    ],
  },
  {
    id: "strategy",
    name: "الاستراتيجية والمنطق",
    icon: Target,
    color: "text-rose-600 bg-rose-500/10",
    games: [
      { id: "stg1", name: "اكس أو", description: "هزم الذكاء الاصطناعي في اللوح", difficulty: "easy", players: "1", xpReward: 60, timeLimit: 120, component: TicTacToe },
      { id: "stg2", name: "تحدي المنطق", description: "مسائل منطقية مختلفة", difficulty: "medium", players: "1", xpReward: 80, timeLimit: 90, component: NumberSequence },
      { id: "stg3", name: "استراتيجية الأرقام", description: "خطط للفوز بالأرقام", difficulty: "medium", players: "1", xpReward: 85, timeLimit: 120, component: TicTacToe },
      { id: "stg4", name: "aiHunter", description: "هزم الذكاء الاصطناعي المتقدم", difficulty: "hard", players: "1", xpReward: 120, timeLimit: 90, component: TicTacToe },
      { id: "stg5", name: "logicMaster", description: "سيد المنطق", difficulty: "hard", players: "1", xpReward: 110, timeLimit: 60, component: NumberSequence },
      { id: "stg6", name: "chessMind", description: " tư duy استراتيجي", difficulty: "medium", players: "1", xpReward: 90, timeLimit: 120, component: TicTacToe },
      { id: "stg7", name: "speedLogic", description: "منطق سريع", difficulty: "easy", players: "1", xpReward: 55, timeLimit: 60, component: NumberSequence },
      { id: "stg8", name: "grandStrat", description: "استراتيجية كبرى", difficulty: "hard", players: "1", xpReward: 130, timeLimit: 150, component: TicTacToe },
      { id: "stg9", name: "ultimateLogic", description: "منطق مطلق", difficulty: "hard", players: "1", xpReward: 140, timeLimit: 90, component: NumberSequence },
      { id: "stg10", name: "GRAND_MASTER", description: "السيد الأعلى", difficulty: "hard", players: "1", xpReward: 160, timeLimit: 120, component: TicTacToe },
    ],
  },
  {
    id: "numbers",
    name: "الأرقام والرياضيات",
    icon: Calculator,
    color: "text-blue-600 bg-blue-500/10",
    games: [
      { id: "num1", name: "mathBasic", description: "مسائل جمع وطرح", difficulty: "easy", players: "1", xpReward: 40, timeLimit: 45, component: MathSprint },
      { id: "num2", name: "mathAddict", description: "مسائل ضرب وقسمة", difficulty: "medium", players: "1", xpReward: 80, timeLimit: 40, component: MathSprint },
      { id: "num3", name: "mathGenius", description: "مسائل رياضية صعبة", difficulty: "hard", players: "1", xpReward: 120, timeLimit: 35, component: MathSprint },
      { id: "num4", name: "calcPro", description: "حاسبة بشرية", difficulty: "medium", players: "1", xpReward: 90, timeLimit: 30, component: MathSprint },
      { id: "num5", name: "numberNinja", description: "نينجا الأرقام", difficulty: "hard", players: "1", xpReward: 130, timeLimit: 25, component: MathSprint },
      { id: "num6", name: "mathBlitz", description: "برق الأرقام", difficulty: "easy", players: "1", xpReward: 50, timeLimit: 30, component: MathSprint },
      { id: "num7", name: "decimalDash", description: "أرقام عشرية سريعة", difficulty: "medium", players: "1", xpReward: 85, timeLimit: 35, component: MathSprint },
      { id: "num8", name: "fractionFury", description: "كسور وقصور", difficulty: "hard", players: "1", xpReward: 110, timeLimit: 40, component: MathSprint },
      { id: "num9", name: "algebraAce", description: "جبر مبسط", difficulty: "hard", players: "1", xpReward: 140, timeLimit: 30, component: MathSprint },
      { id: "num10", name: "MATH_LEGEND", description: "أسطورة الرياضيات", difficulty: "hard", players: "1", xpReward: 160, timeLimit: 20, component: MathSprint },
    ],
  },
  {
    id: "visual",
    name: "البصريات والإدراك",
    icon: Eye,
    color: "text-teal-600 bg-teal-500/10",
    games: [
      { id: "vis1", name: "Pattern初级", description: "اكتشف النمط", difficulty: "easy", players: "1", xpReward: 50, timeLimit: 45, component: PatternMatch },
      { id: "vis2", name: "ColorGenius", description: "عبقري الألوان", difficulty: "medium", players: "1", xpReward: 75, timeLimit: 40, component: ColorMatch },
      { id: "vis3", name: "VisMem", description: "ذاكرة بصرية", difficulty: "medium", players: "1", xpReward: 80, timeLimit: 50, component: PatternMatch },
      { id: "vis4", name: "PatternMaster", description: "سيد الأنماط", difficulty: "hard", players: "1", xpReward: 100, timeLimit: 35, component: PatternMatch },
      { id: "vis5", name: "ColorKing", description: "ملك الألوان", difficulty: "hard", players: "1", xpReward: 110, timeLimit: 30, component: ColorMatch },
      { id: "vis6", name: "eyeTest", description: "اختبار العين", difficulty: "easy", players: "1", xpReward: 45, timeLimit: 40, component: ColorMatch },
      { id: "vis7", name: "visSpeed", description: "سرعة بصرية", difficulty: "medium", players: "1", xpReward: 70, timeLimit: 35, component: PatternMatch },
      { id: "vis8", name: "colorBlitz", description: "برق الألوان", difficulty: "hard", players: "1", xpReward: 120, timeLimit: 25, component: ColorMatch },
      { id: "vis9", name: "patternPro", description: "محترف الأنماط", difficulty: "hard", players: "1", xpReward: 130, timeLimit: 30, component: PatternMatch },
      { id: "vis10", name: "VISUAL_LEGEND", description: "أسطورة البصر", difficulty: "hard", players: "1", xpReward: 150, timeLimit: 25, component: PatternMatch },
    ],
  },
  {
    id: "challenge",
    name: "تحديات متنوعة",
    icon: Swords,
    color: "text-orange-600 bg-orange-500/10",
    games: [
      { id: "ch1", name: "SprintTrivia", description: "معلومات سريعة", difficulty: "easy", players: "1", xpReward: 50, timeLimit: 60, component: QuickTrivia },
      { id: "ch2", name: "MixedGenius", description: "مختلط عبقري", difficulty: "medium", players: "1", xpReward: 90, timeLimit: 90, component: WordScramble },
      { id: "ch3", name: "AllRounder", description: "جوانب متعددة", difficulty: "hard", players: "1", xpReward: 120, timeLimit: 120, component: TicTacToe },
      { id: "ch4", name: "turboMode", description: "وضع Turbo", difficulty: "medium", players: "1", xpReward: 80, timeLimit: 30, component: ReactionSpeed },
      { id: "ch5", name: "chaosRound", description: "جولة فوضى", difficulty: "hard", players: "1", xpReward: 130, timeLimit: 60, component: MathSprint },
      { id: "ch6", name: "dualPlay", description: "لعبة مزدوجة", difficulty: "easy", players: "1", xpReward: 60, timeLimit: 90, component: MemoryGrid },
      { id: "ch7", name: "hyperMode", description: "وضع Hyper", difficulty: "hard", players: "1", xpReward: 140, timeLimit: 45, component: WordScramble },
      { id: "ch8", name: "marathon", description: "ماراثون الألعاب", difficulty: "hard", players: "1", xpReward: 160, timeLimit: 180, component: QuickTrivia },
      { id: "ch9", name: "lightning", description: "برق المعارك", difficulty: "medium", players: "1", xpReward: 85, timeLimit: 40, component: ColorMatch },
      { id: "ch10", name: "ULTIMATE_CHAOS", description: "الفوضى المطلقة", difficulty: "hard", players: "1", xpReward: 180, timeLimit: 120, component: NumberSequence },
    ],
  },
  {
    id: "expert",
    name: "تحديات خبراء",
    icon: Crown,
    color: "text-pink-600 bg-pink-500/10",
    games: [
      { id: "exp1", name: "GeniusMind", description: "عقل عبقري", difficulty: "hard", players: "1", xpReward: 130, timeLimit: 90, component: NumberSequence },
      { id: "exp2", name: "GrandMaster", description: "السيد الأكبر", difficulty: "hard", players: "1", xpReward: 150, timeLimit: 120, component: TicTacToe },
      { id: "exp3", name: "ApexHunter", description: "صياد القمة", difficulty: "hard", players: "1", xpReward: 140, timeLimit: 60, component: PatternMatch },
      { id: "exp4", name: "IQ_TEST", description: "اختبار الذكاء", difficulty: "hard", players: "1", xpReward: 160, timeLimit: 120, component: NumberSequence },
      { id: "exp5", name: "MindStorm", description: "عاصفة العقل", difficulty: "hard", players: "1", xpReward: 170, timeLimit: 90, component: MathSprint },
      { id: "exp6", name: "BrainTeaser", description: "لغز الدماغ", difficulty: "hard", players: "1", xpReward: 145, timeLimit: 100, component: WordScramble },
      { id: "exp7", name: "LogicGate", description: "بوابة المنطق", difficulty: "hard", players: "1", xpReward: 155, timeLimit: 80, component: NumberSequence },
      { id: "exp8", name: "ZenMaster", description: "سيّد الزن", difficulty: "hard", players: "1", xpReward: 135, timeLimit: 150, component: PatternMatch },
      { id: "exp9", name: "TimeWarp", description: "التشوه الزمني", difficulty: "hard", players: "1", xpReward: 165, timeLimit: 60, component: ReactionSpeed },
      { id: "exp10", name: "INFINITE_GENIUS", description: "عبقرية لا نهائية", difficulty: "hard", players: "1", xpReward: 200, timeLimit: 120, component: TicTacToe },
    ],
  },
];

export { GAME_CATEGORIES };
