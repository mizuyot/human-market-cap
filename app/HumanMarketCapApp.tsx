"use client";

import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  APPEARANCES,
  EDUCATIONS,
  OCCUPATION_CATEGORIES,
  type AnnualProjection,
  type AppearanceKey,
  type CalculatorInputs,
  type CalculationResult,
  type EducationKey,
  type OccupationCategoryKey,
  type OccupationKey,
  calculateMarketCap,
  formatMan,
  formatPercent,
  getAppearance,
  getEducation,
  getOccupation,
  getOccupationsByCategory,
  getTier,
  miniWageCurve,
  nwSalaryAdjustment,
  nwTransitionAdjustment,
} from "./model";
import {
  QUIZ_SETS,
  type QuizSet,
  type QuizSetAnswer,
  isQuizSetCorrect,
} from "./quiz-data";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type InputState = Omit<CalculatorInputs, "correctAnswers">;
type RankingMode = "global" | "demo";
type QuizPhase = "idle" | "A" | "B" | "done";
type QuizAnswers = Record<string, QuizSetAnswer>;

interface Ranking {
  rank: number;
  total: number;
  deviation: number;
  topPercent: number;
  scores: number[];
  mode: RankingMode;
}

interface DisplayResult {
  calculation: CalculationResult;
  scoreYen: number;
  previousScoreYen: number | null;
  quizSets: QuizSet[];
  quizAnswers: QuizAnswers;
  quizCorrect: number;
}

const DEFAULTS: InputState = {
  age: 30,
  annualIncome: 600,
  education: "university",
  appearance: "middle",
  occupation: "listedGeneral",
  financialAssets: 300,
  realEstateAssets: 0,
  reinvestmentRate: .2,
};

function pickQuestions(): QuizSet[] {
  const list = [...QUIZ_SETS];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list.slice(0, 5);
}

function uid(): string {
  const key = "hmc_uid";
  const old = localStorage.getItem(key);
  if (old) return old;
  const value = crypto?.randomUUID?.() ?? `hmc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(key, value);
  return value;
}

function demoScores(): number[] {
  return Array.from({ length: 180 }, (_, i) =>
    Math.round((650 + Math.pow(i / 179, 2.35) * 68000 + (i % 9) * 55) * 10000));
}

function rankScores(source: number[], score: number, mode: RankingMode): Ranking {
  const scores = source.some((item) => Math.abs(item - score) < 1) ? [...source] : [...source, score];
  scores.sort((a, b) => b - a);
  const index = scores.findIndex((item) => item <= score);
  const rank = (index < 0 ? scores.length - 1 : index) + 1;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const sd = Math.sqrt(scores.reduce((sum, item) => sum + (item - mean) ** 2, 0) / scores.length);
  return {
    rank,
    total: scores.length,
    deviation: sd ? Math.min(99, Math.max(1, 50 + (score - mean) / sd * 10)) : 50,
    topPercent: rank / scores.length * 100,
    scores,
    mode,
  };
}

async function saveRanking(score: number): Promise<Ranking> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return rankScores(demoScores(), score, "demo");
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
  };
  const saved = await fetch(`${SUPABASE_URL}/rest/v1/hmc_scores?on_conflict=uid`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ uid: uid(), score, updated_at: new Date().toISOString() }),
  });
  if (!saved.ok) throw new Error("upsert");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/hmc_scores?select=score&order=score.desc&limit=1000`, { headers });
  if (!response.ok) throw new Error("select");
  const rows = await response.json() as { score: number | string }[];
  return rankScores(rows.map((row) => Number(row.score)).filter(Number.isFinite), score, "global");
}

function MiniCurve({ occupation }: { occupation: OccupationKey }) {
  const points = miniWageCurve(getOccupation(occupation));
  const max = Math.max(...points);
  return (
    <div className="mini-curve" aria-label="賃金カーブプレビュー">
      {points.map((point, index) => <span key={index} style={{ height: `${Math.max(10, point / max * 100)}%` }} />)}
    </div>
  );
}

function SalaryCanvas({ data, width }: { data: AnnualProjection[]; width: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !data.length) return;
    const height = 272;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    const left = 54;
    const top = 32;
    const bottom = 30;
    const chartHeight = height - top - bottom;
    const max = Math.max(100, ...data.map((item) => item.salary)) * 1.18;
    context.font = "10px 'DM Mono', monospace";
    context.textAlign = "right";
    for (let tick = 0; tick <= 4; tick += 1) {
      const y = top + chartHeight - chartHeight * tick / 4;
      context.strokeStyle = "#292722";
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(width - 20, y);
      context.stroke();
      context.fillStyle = "#77736b";
      context.fillText(`${Math.round(max * tick / 4).toLocaleString("ja-JP")}万`, left - 8, y + 3);
    }
    context.strokeStyle = "#4a9eff";
    context.lineWidth = 2.5;
    context.beginPath();
    data.forEach((item, index) => {
      const x = left + index * 56 + 28;
      const y = top + chartHeight - item.salary / max * chartHeight;
      if (index) context.lineTo(x, y);
      else context.moveTo(x, y);
    });
    context.stroke();
    data.forEach((item, index) => {
      const x = left + index * 56 + 28;
      const y = top + chartHeight - item.salary / max * chartHeight;
      context.fillStyle = "#0a0a0a";
      context.strokeStyle = "#4a9eff";
      context.lineWidth = 2;
      context.beginPath();
      context.arc(x, y, 4, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.fillStyle = "#b8d6ff";
      context.font = "9px 'DM Mono', monospace";
      context.textAlign = "center";
      context.fillText(`${Math.round(item.salary).toLocaleString("ja-JP")}万`, x, Math.max(12, y - 10 - (index % 2) * 11));
    });
  }, [data, width]);
  return <canvas ref={ref} role="img" aria-label="年齢別の期待年収推移" />;
}

function Charts({ result }: { result: CalculationResult }) {
  const data = result.projections;
  if (!data.length) return <p className="empty-note">就労終了年齢を超えているため、残余期間のチャートはありません。</p>;
  const width = 74 + data.length * 56;
  const max = Math.max(1, ...data.map((item) => item.balance));
  return (
    <div className="chart-scroll">
      <div className="chart-stage" style={{ width }}>
        <div className="chart-heading-row">
          <div><span className="eyebrow">INCOME CURVE</span><h4>年収推移</h4></div>
          <span className="legend-dot blue">期待年収</span>
        </div>
        <SalaryCanvas data={data} width={width} />
        <div className="chart-heading-row asset-heading">
          <div><span className="eyebrow">ASSET BUILD-UP</span><h4>資産推移</h4></div>
          <div className="asset-legend">
            <span className="legend-dot purple">初期</span>
            <span className="legend-dot green">再投資</span>
            <span className="legend-dot gold">運用益</span>
          </div>
        </div>
        <div className="asset-chart" style={{ paddingLeft: 54, paddingRight: 20 }}>
          {data.map((item) => (
            <div className="asset-column" key={item.age}>
              <span className="asset-total">{Math.round(item.balance).toLocaleString("ja-JP")}万</span>
              <div className="asset-bar" title={`${item.age}歳：${formatMan(item.balance)}`}>
                <span className="asset-layer gain" style={{ height: Math.max(0, item.gains / max * 158) }} />
                <span className="asset-layer reinvested" style={{ height: Math.max(0, item.reinvested / max * 158) }} />
                <span className="asset-layer initial" style={{ height: Math.max(2, item.initialAssets / max * 158) }} />
              </div>
              {item.gains < 0 && <span className="loss-mark">LOSS</span>}
              <span className="age-label">{item.age}歳</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Histogram({ ranking, score }: { ranking: Ranking; score: number }) {
  const min = Math.min(...ranking.scores);
  const max = Math.max(...ranking.scores);
  const span = Math.max(1, max - min);
  const bins = Array.from({ length: 12 }, () => 0);
  ranking.scores.forEach((item) => bins[Math.min(11, Math.floor((item - min) / span * 12))] += 1);
  const peak = Math.max(...bins, 1);
  const marker = Math.min(100, Math.max(0, (score - min) / span * 100));
  return (
    <div className="histogram-wrap">
      <div className="you-marker" style={{ left: `${marker}%` }}><span>YOU</span></div>
      <div className="histogram">{bins.map((item, index) => <span key={index} style={{ height: `${Math.max(5, item / peak * 100)}%` }} />)}</div>
      <div className="histogram-axis"><span>LOW</span><span>MARKET VALUE</span><span>HIGH</span></div>
    </div>
  );
}

function Trace({ title, children }: { title: string; children: ReactNode }) {
  return <details className="trace"><summary>{title}<span>＋</span></summary><div>{children}</div></details>;
}

function Factor({ label, value, caption }: { label: string; value: number; caption: string }) {
  return (
    <div className="factor-row">
      <div className="factor-head"><span>{label}</span><strong>{caption}</strong></div>
      <div className="factor-track"><span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>
    </div>
  );
}

function notes(result: CalculationResult): string[] {
  return [
    result.occupation.careerRisk >= .07
      ? `キャリア変動リスクが年率${(result.occupation.careerRisk * 100).toFixed(1)}%と高水準です。別職種へ移った場合の所得を含めて期待値を調整しています。`
      : result.occupation.careerRisk <= .01
        ? "キャリア持続性が高く、長期間の給与キャッシュフローが評価を下支えしています。"
        : "キャリアの成長余地と継続リスクは中位です。専門性の更新が評価維持の鍵になります。",
    result.effectiveReturn >= .045
      ? "実効利回りは上限に近い水準です。追加リターンより、分散と下方リスク管理が重要です。"
      : result.effectiveReturn < .01
        ? "資産運用の寄与が弱く、金融リテラシーの改善効果が大きい状態です。"
        : "資産所得は健全な補助エンジンです。再投資率を維持すると後半ほど複利が効きます。",
    result.yearsRemaining < 10
      ? "残余就労年数が短いため、既存資産の保全とキャッシュフロー設計が優先です。"
      : `残余就労年数は${result.yearsRemaining}年。小さな成長率差でも累計価値には大きく効く時間軸です。`,
  ];
}

function answerLabel(set: QuizSet, phase: "a" | "b", answer: number | null): string {
  if (answer === null) return "時間切れ・未回答";
  const option = set[phase].options[answer];
  return `${answer + 1}．${option}`;
}

function QuizReview({ sets, answers }: { sets: QuizSet[]; answers: QuizAnswers }) {
  const correct = sets.filter((set) => isQuizSetCorrect(set, answers[set.id])).length;
  return (
    <section className="result-card quiz-review-card">
      <div className="section-title">
        <div><span className="eyebrow">LITERACY REVIEW</span><h3>金融判断の振り返り</h3></div>
        <span className="quiz-score-chip">{correct} / 5</span>
      </div>
      <p className="quiz-review-intro">各セットを開くと、あなたの回答と判断原則の解説を確認できます。</p>
      <div className="quiz-review-list">
        {sets.map((set, index) => {
          const answer = answers[set.id] ?? { a: null, b: null };
          const passed = isQuizSetCorrect(set, answer);
          return (
            <details className={`quiz-review-item ${passed ? "correct" : "incorrect"}`} key={set.id}>
              <summary>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{set.title}</strong>
                <b>{passed ? "1 POINT" : "0 POINT"}</b>
              </summary>
              <div className="quiz-review-body">
                <p><em>A</em>{answerLabel(set, "a", answer.a)}</p>
                <p><em>B</em>{answerLabel(set, "b", answer.b)}</p>
                <p className="correct-pattern"><span>正解パターン</span><strong>{set.correctPattern}</strong></p>
                <div className="quiz-explanation"><span>解説</span><p>{set.explanation}</p></div>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

export default function HumanMarketCapApp() {
  const [inputs, setInputs] = useState<InputState>(DEFAULTS);
  const [questions, setQuestions] = useState<QuizSet[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswers>({});
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizPhase, setQuizPhase] = useState<QuizPhase>("idle");
  const [timeLeft, setTimeLeft] = useState(10);
  const [error, setError] = useState("");
  const [display, setDisplay] = useState<DisplayResult | null>(null);
  const [ranking, setRanking] = useState<Ranking | null>(null);
  const resultRef = useRef<HTMLElement>(null);

  const education = useMemo(() => getEducation(inputs.education), [inputs.education]);
  const appearance = useMemo(() => getAppearance(inputs.appearance), [inputs.appearance]);
  const job = useMemo(() => getOccupation(inputs.occupation), [inputs.occupation]);
  const category = job.category as OccupationCategoryKey;
  const categoryJobs = useMemo(() => getOccupationsByCategory(category), [category]);

  const advanceQuiz = useCallback((choice: number | null) => {
    if ((quizPhase !== "A" && quizPhase !== "B") || !questions[quizIndex]) return;
    const set = questions[quizIndex];
    const key = quizPhase === "A" ? "a" : "b";
    setQuizAnswers((current) => ({
      ...current,
      [set.id]: { ...(current[set.id] ?? { a: null, b: null }), [key]: choice },
    }));
    if (quizPhase === "A") {
      setQuizPhase("B");
      setTimeLeft(10);
      return;
    }
    if (quizIndex >= questions.length - 1) {
      setQuizPhase("done");
      setTimeLeft(0);
      return;
    }
    setQuizIndex((current) => current + 1);
    setQuizPhase("A");
    setTimeLeft(10);
  }, [questions, quizIndex, quizPhase]);

  useEffect(() => {
    if (quizPhase !== "A" && quizPhase !== "B") return;
    const timer = window.setTimeout(() => {
      if (timeLeft <= 1) advanceQuiz(null);
      else setTimeLeft((current) => current - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [advanceQuiz, quizPhase, timeLeft]);

  function number(field: keyof InputState, value: number) {
    setInputs((current) => ({ ...current, [field]: Number.isFinite(value) ? value : 0 }));
  }

  async function refresh(score: number) {
    try {
      setRanking(await saveRanking(score));
    } catch {
      setRanking(rankScores(demoScores(), score, "demo"));
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (inputs.age < 18 || inputs.age > 80) {
      setError("年齢は18〜80歳で入力してください。");
      return;
    }
    if (quizPhase !== "done") {
      setError("金融リテラシーテストを最後まで回答してください。");
      return;
    }
    setError("");
    const correct = questions.filter((set) => isQuizSetCorrect(set, quizAnswers[set.id])).length;
    const calculation = calculateMarketCap({ ...inputs, correctAnswers: correct });
    const scoreYen = Math.round(calculation.marketCapMan * 10000);
    const previous = localStorage.getItem("hmc_previous_score");
    localStorage.setItem("hmc_previous_score", String(scoreYen));
    setDisplay({
      calculation,
      scoreYen,
      previousScoreYen: previous === null ? null : Number(previous),
      quizSets: [...questions],
      quizAnswers: { ...quizAnswers },
      quizCorrect: correct,
    });
    setRanking(null);
    void refresh(scoreYen);
    window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }

  const result = display?.calculation;
  const tier = result ? getTier(result.marketCapMan) : "D";
  const activeQuiz = questions[quizIndex];
  const activePart = activeQuiz && (quizPhase === "A" || quizPhase === "B") ? activeQuiz[quizPhase.toLowerCase() as "a" | "b"] : null;

  return (
    <main>
      <div className="app-shell">
        <header className="brand-bar">
          <a className="brand" href="#top"><span className="brand-mark">HMC</span><span>HUMAN CAPITAL<br />DESK</span></a>
          <span className="model-tag">DCF MODEL / v14</span>
        </header>

        <section className="intro" id="top">
          <p className="eyebrow">PRICE YOUR POTENTIAL</p>
          <h1>あなたの価値を、<br /><em>数字にする。</em></h1>
          <p className="intro-copy">属性・資産・金融知識から、残りのキャリアが生み出す価値をDCF的に査定します。</p>
          <div className="formula-strip"><span>給与所得総額</span><b>＋</b><span>資産所得総額</span><b>＝</b><strong>時価総額</strong></div>
          <div className="trust-row"><span>01 / 匿名</span><span>02 / 約3分</span><span>03 / 最新スコアのみ</span></div>
        </section>

        <form className="calculator-form" onSubmit={submit} noValidate>
          <div className="form-heading"><div><span className="eyebrow">VALUATION SHEET</span><h2>査定情報</h2></div><span>9 QUESTIONS</span></div>

          <section className="question-card">
            <label htmlFor="age"><span className="question-number">01</span><span>現在の年齢</span></label>
            <div className="number-input"><input id="age" type="number" inputMode="numeric" min="18" max="80" value={inputs.age} onChange={(event) => number("age", Number(event.target.value))} /><span>歳</span></div>
            <p className="field-note">職業別の就労終了年齢までを残余就労期間として計算</p>
          </section>

          <section className="question-card">
            <label htmlFor="income"><span className="question-number">02</span><span>現在の年収</span></label>
            <div className="number-input"><input id="income" type="number" inputMode="decimal" min="0" value={inputs.annualIncome} onChange={(event) => number("annualIncome", Number(event.target.value))} /><span>万円</span></div>
            <p className="field-note">額面年収。将来の賃金カーブの起点になります</p>
          </section>

          <section className="question-card">
            <label htmlFor="education"><span className="question-number">03</span><span>最終学歴</span></label>
            <select id="education" value={inputs.education} onChange={(event) => setInputs((current) => ({ ...current, education: event.target.value as EducationKey }))}>
              {EDUCATIONS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
            <div className="parameter-card">
              <div><span>キャリア乗数</span><strong>×{education.multiplier.toFixed(3)}</strong></div>
              <div><span>NW力</span><strong>{education.nw}</strong></div>
              <div><span>NW→給与</span><strong>{formatPercent(nwSalaryAdjustment(education.nw), 2)}</strong></div>
              <div><span>NW→転職後</span><strong>{formatPercent(nwTransitionAdjustment(education.nw), 1)}</strong></div>
            </div>
          </section>

          <section className="question-card">
            <fieldset>
              <legend><span className="question-number">04</span><span>容姿（自己評価）</span></legend>
              <div className="choice-grid five">
                {APPEARANCES.map((item) => (
                  <label key={item.key} className={inputs.appearance === item.key ? "selected" : ""}>
                    <input type="radio" name="appearance" checked={inputs.appearance === item.key} onChange={() => setInputs((current) => ({ ...current, appearance: item.key as AppearanceKey }))} />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="parameter-card two">
              <div><span>給与成長ベース</span><strong>{formatPercent(appearance.salaryBase, 2)}</strong></div>
              <div><span>資産利回り</span><strong>影響なし</strong></div>
            </div>
          </section>

          <section className="question-card">
            <div className="question-label"><span className="question-number">05</span><span>現在の職業</span></div>
            <div className="occupation-selects">
              <label htmlFor="occupation-category"><span>職種</span>
                <select id="occupation-category" value={category} onChange={(event) => {
                  const next = getOccupationsByCategory(event.target.value as OccupationCategoryKey)[0];
                  if (next) setInputs((current) => ({ ...current, occupation: next.key as OccupationKey }));
                }}>
                  {OCCUPATION_CATEGORIES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                </select>
              </label>
              <label htmlFor="occupation"><span>職業</span>
                <select id="occupation" value={inputs.occupation} onChange={(event) => setInputs((current) => ({ ...current, occupation: event.target.value as OccupationKey }))}>
                  {categoryJobs.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                </select>
              </label>
            </div>
            <div className="occupation-card">
              <div className="occupation-stats">
                <div><span>WORK END</span><strong>{job.retirement}</strong></div>
                <div><span>PEAK</span><strong>{job.peak}</strong></div>
                <div><span>RETURN</span><strong>{(job.baseReturn * 100).toFixed(1)}%</strong></div>
                <div><span>RISK</span><strong>{(job.careerRisk * 100).toFixed(1)}%</strong></div>
              </div>
              <div className="curve-preview"><span>WAGE CURVE PREVIEW</span><MiniCurve occupation={inputs.occupation} /></div>
              <div className="risk-line"><span>主職{job.primaryEnd}歳まで / 転職後所得{Math.round(job.transitionIncomeRate * 100)}%</span><b className={`risk-badge risk-${job.riskLabel.toLowerCase().replace(/\s/g, "-")}`}>{job.riskLabel}</b></div>
            </div>
          </section>

          <section className="question-card">
            <label htmlFor="financial"><span className="question-number">06</span><span>現金・金融資産</span></label>
            <div className="number-input"><input id="financial" type="number" inputMode="decimal" min="0" value={inputs.financialAssets} onChange={(event) => number("financialAssets", Number(event.target.value))} /><span>万円</span></div>
          </section>

          <section className="question-card">
            <label htmlFor="realestate"><span className="question-number">07</span><span>不動産資産</span></label>
            <div className="number-input"><input id="realestate" type="number" inputMode="decimal" min="0" value={inputs.realEstateAssets} onChange={(event) => number("realEstateAssets", Number(event.target.value))} /><span>万円</span></div>
            <p className="field-note">現金・金融資産と合算して初期資産に計上</p>
          </section>

          <section className="question-card">
            <label htmlFor="reinvestment"><span className="question-number">08</span><span>給与からの再投資率</span></label>
            <div className="range-head"><strong>{Math.round(inputs.reinvestmentRate * 100)}%</strong><span>推奨 20%以上</span></div>
            <input id="reinvestment" className="range-input" type="range" min="0" max="80" value={Math.round(inputs.reinvestmentRate * 100)} onChange={(event) => number("reinvestmentRate", Number(event.target.value) / 100)} />
            <div className="range-scale"><span>0%</span><span>40%</span><span>80%</span></div>
          </section>

          <section className="question-card quiz-card" id="question-9">
            <div className="quiz-title"><span className="question-number">09</span><div><span>金融リテラシー瞬発クイズ</span><small>5 / 15 RANDOM SETS · A/B 各10秒</small></div></div>
            {quizPhase === "idle" && (
              <div className="quiz-start-panel">
                <p>15セットから選ばれた5セットに挑戦します。Aに答えるとBが表示され、Aの回答は変更できません。A・Bの両方を満たした場合のみ1点です。</p>
                <button type="button" onClick={() => { setQuestions(pickQuestions()); setQuizPhase("A"); setTimeLeft(10); setQuizIndex(0); setQuizAnswers({}); }}>5問を開始する</button>
              </div>
            )}
            {activeQuiz && activePart && (quizPhase === "A" || quizPhase === "B") && (
              <div className="quiz-stage">
                <div className="quiz-progress-row"><span>SET {quizIndex + 1} / 5</span><div><i style={{ width: `${(quizIndex + (quizPhase === "B" ? .5 : 0)) / 5 * 100}%` }} /></div><b className={timeLeft <= 3 ? "urgent" : ""}>{timeLeft}<small>SEC</small></b></div>
                <div className="quiz-set-heading"><span>{activeQuiz.id.toUpperCase()}</span><strong>{activeQuiz.title}</strong></div>
                {activeQuiz.lead && <p className="quiz-lead">{activeQuiz.lead}</p>}
                <fieldset className="quiz-question active">
                  <legend><span>{quizPhase}</span>{activePart.prompt}</legend>
                  <div className="quiz-options">
                    {activePart.options.map((option, index) => (
                      <button type="button" key={option} onClick={() => advanceQuiz(index)}>
                        <i>{index + 1}</i><span>{option}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
                {quizPhase === "B" && <p className="locked-answer">Aの回答はロックされています</p>}
              </div>
            )}
            {quizPhase === "done" && (
              <div className="quiz-complete"><span>05 / 05</span><strong>回答完了</strong><p>採点結果と解説は査定レポートで確認できます。</p></div>
            )}
            <p className="quiz-impact">5セットの得点に応じて、実効利回りが −5% 〜 ＋5%補正されます。</p>
          </section>

          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="calculate-button" type="submit" disabled={questions.length !== 5 || quizPhase !== "done"}><span>時価総額を算出する</span><b>→</b></button>
          <p className="privacy-note">入力内容はランキング用スコア以外保存しません。この結果は金融助言ではなく、教育・娯楽目的の試算です。</p>
        </form>

        {display && result && (
          <section className="results" ref={resultRef}>
            <div className="result-divider"><span>VALUATION REPORT</span><b>査定完了</b></div>
            <section className={`market-hero tier-${tier}`}>
              <div className="hero-badges"><span className="tier-badge">{tier} TIER</span><span className={`risk-badge risk-${result.occupation.riskLabel.toLowerCase().replace(/\s/g, "-")}`}>{result.occupation.riskLabel} RISK</span></div>
              <p>あなたの人間時価総額</p><h2>{formatMan(result.marketCapMan)}</h2><span className="hero-en">ESTIMATED HUMAN MARKET CAPITAL</span>
              <Trace title="時価総額の計算トレース"><p>給与所得 {formatMan(result.salaryIncomeMan)} ＋ 資産所得 {formatMan(result.assetIncomeMan)}</p><p>残余{result.yearsRemaining}年の期待キャッシュフローを全補正で調整しています。</p></Trace>
            </section>

            {display.previousScoreYen !== null && (
              <div className={`delta-banner ${display.scoreYen >= display.previousScoreYen ? "positive" : "negative"}`}><span>前回査定との差分</span><strong>{display.scoreYen >= display.previousScoreYen ? "＋" : "−"}{formatMan(Math.abs(display.scoreYen - display.previousScoreYen) / 10000)}</strong></div>
            )}

            <section className="result-card ranking-card">
              <div className="section-title"><div><span className="eyebrow">MARKET POSITION</span><h3>市場ポジション</h3></div><span className={`connection ${ranking?.mode === "global" ? "online" : ""}`}>{ranking?.mode === "global" ? "LIVE" : "DEMO"}</span></div>
              {ranking ? <><div className="ranking-kpis"><div><span>総合順位</span><strong><em>{ranking.rank}</em> / {ranking.total}</strong></div><div><span>偏差値</span><strong><em>{ranking.deviation.toFixed(1)}</em></strong></div><div><span>上位</span><strong><em>{ranking.topPercent.toFixed(1)}</em>%</strong></div></div><Histogram ranking={ranking} score={display.scoreYen} />{ranking.mode === "demo" && <p className="demo-note">Supabase接続前のため、比較用デモ分布で順位を表示しています。</p>}</> : <div className="ranking-loading"><span />ランキングを照合しています…</div>}
            </section>

            <section className="kpi-grid">
              <article className="result-card kpi-card"><span className="kpi-icon blue">01</span><p>給与所得総額</p><h3>{formatMan(result.salaryIncomeMan)}</h3><Trace title="給与所得の計算トレース"><p>年収起点へ職業カーブ・インフレ2%・NW力・容姿を毎年適用。</p><p>離職時は所得ゼロではなく、職業別の転職後所得率へ移行する期待値モデルです。</p></Trace></article>
              <article className="result-card kpi-card"><span className="kpi-icon gold">02</span><p>資産所得総額</p><h3>{formatMan(result.assetIncomeMan)}</h3><Trace title="資産所得の計算トレース"><p>初期資産 {formatMan(inputs.financialAssets + inputs.realEstateAssets)} に年収の{Math.round(inputs.reinvestmentRate * 100)}%を毎年追加。</p><p>実効利回り {(result.effectiveReturn * 100).toFixed(2)}%で複利運用。</p></Trace></article>
            </section>

            <section className="result-card charts-card"><div className="section-title"><div><span className="eyebrow">LIFETIME PROJECTION</span><h3>生涯キャッシュフロー</h3></div><span className="scroll-hint">← SWIPE →</span></div><Charts result={result} /></section>

            <section className="result-card assumptions-card">
              <div className="section-title"><div><span className="eyebrow">APPLIED ASSUMPTIONS</span><h3>試算の前提条件</h3></div></div>
              <div className="assumption-list">
                <div><span>残余就労年数</span><strong>{result.yearsRemaining}年（{inputs.age}→{result.occupation.retirement}歳）</strong></div>
                <div><span>主職終了年齢</span><strong>{result.occupation.primaryEnd}歳</strong></div>
                <div><span>キャリア乗数</span><strong>×{result.education.multiplier.toFixed(3)}</strong></div>
                <div><span>NW力</span><strong>{result.education.nw}</strong></div>
                <div><span>NW→給与</span><strong>{formatPercent(result.nwSalaryAdjustment, 2)} / 年</strong></div>
                <div><span>NW→転職後所得</span><strong>{formatPercent(result.nwTransitionAdjustment, 1)}</strong></div>
                <div><span>転職後所得率</span><strong>{(result.transitionIncomeRate * 100).toFixed(1)}%</strong></div>
                <div><span>容姿→給与</span><strong>{formatPercent(result.appearanceSalaryAdjustment, 2)} / 年</strong></div>
                <div><span>職業別基本利回り</span><strong>{formatPercent(result.occupation.baseReturn)}</strong></div>
                <div><span>金融リテラシー</span><strong>{display.quizCorrect} / 5点・{formatPercent(result.financialAdjustment)}</strong></div>
                <div className="highlight"><span>実効利回り</span><strong>{(result.effectiveReturn * 100).toFixed(2)}%（上限5.0%）</strong></div>
                <div><span>キャリア変動リスク</span><strong>{(result.occupation.careerRisk * 100).toFixed(1)}% / 年</strong></div>
              </div>
            </section>

            <section className="result-card factors-card">
              <div className="section-title"><div><span className="eyebrow">VALUATION FACTORS</span><h3>評価ファクター</h3></div></div>
              <Factor label="金融リテラシー" value={display.quizCorrect / 5 * 100} caption={`${display.quizCorrect}/5`} />
              <Factor label="実効利回り" value={(result.effectiveReturn + .05) / .1 * 100} caption={`${(result.effectiveReturn * 100).toFixed(2)}%`} />
              <Factor label="NW力" value={result.education.nw} caption={`${result.education.nw}`} />
              <Factor label="容姿補正" value={50 + result.appearanceSalaryAdjustment * 2000} caption={formatPercent(result.appearanceSalaryAdjustment, 2)} />
              <Factor label="キャリア持続性" value={100 - result.occupation.careerRisk * 800} caption={`${((1 - result.occupation.careerRisk) * 100).toFixed(1)}%`} />
              <Factor label="残余就労年数" value={result.yearsRemaining / 50 * 100} caption={`${result.yearsRemaining}年`} />
            </section>

            <QuizReview sets={display.quizSets} answers={display.quizAnswers} />

            <section className="result-card analysis-card">
              <div className="section-title"><div><span className="eyebrow">ANALYST NOTES</span><h3>分析コメント</h3></div></div>
              <div className="analyst-stamp"><span>{tier}</span><div><strong>{tier === "S" ? "超優良人材" : tier === "A" ? "成長優良人材" : tier === "B" ? "安定成長人材" : tier === "C" ? "改善余地あり" : "再建プラン推奨"}</strong><small>HMC ANALYST RATING</small></div></div>
              <ol>{notes(result).map((note) => <li key={note}>{note}</li>)}</ol>
              <p className="risk-warning"><b>RISK NOTICE</b> この査定は入力条件に基づく期待値です。実際の収入・運用成果を保証するものではありません。</p>
            </section>

            <button className="revise-button" type="button" onClick={() => { setDisplay(null); setRanking(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}>条件を修正して再計算する</button>
          </section>
        )}

        <footer><span>HMC CALCULATOR / v14</span><p>ENTERTAINMENT × FINANCIAL EDUCATION</p></footer>
      </div>
    </main>
  );
}
