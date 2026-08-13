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
  formatMan,
  formatPercent,
  formatRiskLabel,
  getAppearance,
  getEducation,
  getOccupation,
  getOccupationsByCategory,
  getTier,
  miniWageCurve,
  nwSalaryAdjustment,
  nwTransitionAdjustment,
  occupationIncomeFloor,
} from "./model";
import type {
  PublicQuizSet,
  QuizAnswers,
  QuizReviewItem,
  QuizStartResponse,
  RankingSnapshot,
  ValuationResponse,
} from "./api-types";
import { formatAxisMan, logHistogramMarkerPercent } from "./ranking-display";
import { trackEvent } from "./analytics";
import {
  FieldError,
  FieldHelp,
  InfoTooltip,
  NumberInputWithUnit,
  PrimaryButton,
  PrivacySummary,
  QuestionHeader,
  SecondaryButton,
  SelectField,
  WizardProgress,
  type WizardStepId,
} from "./hmc/ui";

const QUIZ_SECONDS = 20;

type InputState = CalculatorInputs;
type QuizPhase = "idle" | "A" | "B" | "done";

interface DisplayResult {
  calculation: CalculationResult;
  scoreYen: number;
  previousScoreYen: number | null;
  reviews: QuizReviewItem[];
  quizCorrect: number;
  inputs: InputState;
}

const DEFAULTS: InputState = {
  age: 30,
  annualIncome: 600,
  education: "university",
  appearance: "middle",
  occupation: "listedGeneral",
  financialAssets: 300,
  realEstateAssets: 0,
  otherAssets: 0,
  reinvestmentRate: .2,
};

function uid(): string {
  const key = "hmc_uid";
  const old = localStorage.getItem(key);
  if (old) return old;
  const value = crypto?.randomUUID?.() ?? `hmc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(key, value);
  return value;
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

function compactMoney(value: number): string {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (absolute >= 10000) return `${sign}${(absolute / 10000).toFixed(absolute >= 100000 ? 0 : 1)}億`;
  return `${sign}${Math.round(absolute).toLocaleString("ja-JP")}万`;
}

function formatShareScore(value: number): string {
  if (Math.abs(value) < 10000) return formatMan(value);
  const amount = (value / 10000).toFixed(1).replace(/\.0$/, "");
  return `${amount}億円`;
}

function compactProjections(data: AnnualProjection[], maxPoints = 6): AnnualProjection[] {
  if (data.length <= maxPoints) return data;
  const last = data.length - 1;
  const selected = Array.from({ length: maxPoints }, (_, index) => Math.round(index * last / (maxPoints - 1)));
  const peakIndex = data.reduce((best, item, index) => item.salary > data[best].salary ? index : best, 0);
  if (!selected.includes(peakIndex)) {
    const replaceAt = selected
      .map((index, position) => ({ distance: Math.abs(index - peakIndex), position }))
      .filter(({ position }) => position > 0 && position < selected.length - 1)
      .sort((a, b) => a.distance - b.distance)[0]?.position;
    if (replaceAt !== undefined) selected[replaceAt] = peakIndex;
  }
  return [...new Set(selected)].sort((a, b) => a - b).map((index) => data[index]);
}

function SalaryCanvas({ data }: { data: AnnualProjection[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(420);

  useEffect(() => {
    const canvas = ref.current;
    const container = canvas?.parentElement;
    if (!container) return;
    const update = () => setWidth(Math.max(280, Math.floor(container.clientWidth)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !data.length) return;
    const height = 360;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    const left = 58;
    const right = 16;
    const top = 48;
    const bottom = 44;
    const chartHeight = height - top - bottom;
    const salaries = data.map((item) => item.salary);
    const dataMin = Math.min(...salaries);
    const dataMax = Math.max(...salaries);
    const spread = Math.max(100, dataMax - dataMin);
    const axisMin = Math.max(0, dataMin - spread * .18);
    const axisMax = dataMax + spread * .12;
    const axisRange = Math.max(1, axisMax - axisMin);
    context.font = "10px 'Noto Sans JP', sans-serif";
    context.textAlign = "right";
    for (let tick = 0; tick <= 4; tick += 1) {
      const y = top + chartHeight - chartHeight * tick / 4;
      context.strokeStyle = "#292722";
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(width - right, y);
      context.stroke();
      context.fillStyle = "#77736b";
      const tickValue = axisMin + axisRange * tick / 4;
      context.fillText(`${Math.round(tickValue).toLocaleString("ja-JP")}万`, left - 8, y + 3);
    }
    context.strokeStyle = "#4a9eff";
    context.lineWidth = 2.5;
    context.beginPath();
    data.forEach((item, index) => {
      const x = left + (width - left - right) * index / Math.max(1, data.length - 1);
      const y = top + chartHeight - (item.salary - axisMin) / axisRange * chartHeight;
      if (index) context.lineTo(x, y);
      else context.moveTo(x, y);
    });
    context.stroke();
    data.forEach((item, index) => {
      const x = left + (width - left - right) * index / Math.max(1, data.length - 1);
      const y = top + chartHeight - (item.salary - axisMin) / axisRange * chartHeight;
      context.fillStyle = "#0a0a0a";
      context.strokeStyle = "#4a9eff";
      context.lineWidth = 2;
      context.beginPath();
      context.arc(x, y, 4, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.fillStyle = "#b8d6ff";
      context.font = "10px 'Noto Sans JP', sans-serif";
      context.textAlign = "center";
      context.fillText(compactMoney(item.salary), x, Math.max(12, y - 10 - (index % 2) * 11));
    });
  }, [data, width]);
  return <canvas ref={ref} role="img" aria-label="年齢別の期待年収推移" />;
}

function Charts({ result }: { result: CalculationResult }) {
  const data = compactProjections(result.projections);
  if (!data.length) return <p className="empty-note">就労終了年齢を超えているため、残余期間のチャートはありません。</p>;
  const max = Math.max(1, ...data.map((item) => item.balance));
  return (
    <div className="chart-scroll">
      <div className="chart-stage">
        <div className="chart-heading-row">
          <div><span className="eyebrow">年収の推移</span><h4>年収推移</h4></div>
          <span className="legend-dot blue">期待年収・拡大表示</span>
        </div>
        <SalaryCanvas data={data} />
        <div className="chart-heading-row asset-heading">
          <div><span className="eyebrow">資産の積み上がり</span><h4>資産推移</h4></div>
          <div className="asset-legend">
            <span className="legend-dot purple">初期</span>
            <span className="legend-dot green">再投資</span>
            <span className="legend-dot gold">運用益</span>
          </div>
        </div>
        <div className="asset-chart">
          {data.map((item) => (
            <div className="asset-column" key={item.age}>
              <span className="asset-total">{compactMoney(item.balance)}</span>
              <div className="asset-bar" title={`${item.age}歳：${formatMan(item.balance)}`}>
                <span className="asset-layer gain" style={{ height: Math.max(0, item.gains / max * 245) }} />
                <span className="asset-layer reinvested" style={{ height: Math.max(0, item.reinvested / max * 245) }} />
                <span className="asset-layer initial" style={{ height: Math.max(2, item.initialAssets / max * 245) }} />
              </div>
              {item.gains < 0 && <span className="loss-mark">含み損</span>}
              <span className="age-label">{item.age}歳</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Histogram({ ranking, score }: { ranking: RankingSnapshot; score: number }) {
  const peak = Math.max(...ranking.bins, 1);
  const marker = logHistogramMarkerPercent(score, ranking.minScore, ranking.maxScore);
  return (
    <div className="histogram-wrap">
      <div className="you-marker" style={{ left: `${marker}%` }}><span>あなた</span></div>
      <div className="histogram">
        {ranking.bins.map((item, index) => (
          <span
            key={index}
            style={{ height: `${Math.max(5, Math.sqrt(item / peak) * 100)}%` }}
            title={`${item}人`}
          />
        ))}
      </div>
      <div className="histogram-axis">
        <span>{formatAxisMan(ranking.minScore)}</span>
        <span>対数表示</span>
        <span>{formatAxisMan(ranking.maxScore)}</span>
      </div>
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
    result.effectiveReturn >= .06
      ? "実効利回りはかなり高い水準です。上限は設けていませんが、期待値が高いほど下方リスク管理も重要です。"
      : result.effectiveReturn < .01
        ? "資産運用の寄与が弱く、金融リテラシーの改善効果が大きい状態です。"
        : "資産所得は健全な補助エンジンです。再投資率を維持すると後半ほど複利が効きます。",
    result.yearsRemaining < 10
      ? "残余就労年数が短いため、既存資産の保全とキャッシュフロー設計が優先です。"
      : `残余就労年数は${result.yearsRemaining}年。小さな成長率差でも累計価値には大きく効く時間軸です。`,
  ];
}

function answerLabel(set: PublicQuizSet, phase: "a" | "b", answer: number | null): string {
  if (answer === null) return "時間切れ・未回答";
  const option = set[phase].options[answer];
  return `${answer + 1}．${option}`;
}

function QuizReview({ reviews }: { reviews: QuizReviewItem[] }) {
  const correct = reviews.filter((review) => review.passed).length;
  return (
    <section className="result-card quiz-review-card">
      <div className="section-title">
        <div><span className="eyebrow">金融クイズの振り返り</span><h3>金融判断の振り返り</h3></div>
        <span className="quiz-score-chip">{correct} / 5</span>
      </div>
      <p className="quiz-review-intro">各セットを開くと、あなたの回答と判断原則の解説を確認できます。</p>
      <div className="quiz-review-list">
        {reviews.map((set, index) => {
          const answer = set.answer;
          const passed = set.passed;
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

interface ShareCardPayload {
  score: string;
  tier: string;
  deviation: string;
  occupation: string;
  quiz: string;
  title: string | null;
  avatar: string | null;
  marketSignal: string;
  variant: "premium" | "surge" | "standard" | "warning";
  url: string;
  /** 万円単位の時価総額（結果カードの色分け用） */
  marketCapMan: number;
}

type ShareCardTone = "rainbow" | "purple" | "gold" | "silver" | "bronze" | "green";

interface ShareCardTheme {
  tone: ShareCardTone;
  bg: string;
  panel: string;
  accent: string;
  accentSoft: string;
  score: string;
  muted: string;
  text: string;
  tierText: string;
  glow: string;
  borderStops: string[];
}

/** marketCapMan は万円。例: 10億円 = 100_000 */
function shareCardTheme(marketCapMan: number): ShareCardTheme {
  if (marketCapMan >= 1_000_000) {
    return {
      tone: "rainbow",
      bg: "#07070f",
      panel: "#101018",
      accent: "#ff7ad9",
      accentSoft: "rgba(255,122,217,.28)",
      score: "#ffffff",
      muted: "#b7b3c9",
      text: "#f7f4ff",
      tierText: "#120816",
      glow: "rgba(120, 90, 255, .35)",
      borderStops: ["#ff4d4d", "#ff9f1a", "#ffe066", "#5dff8a", "#4db8ff", "#b56bff", "#ff4d4d"],
    };
  }
  if (marketCapMan >= 300_000) {
    return {
      tone: "purple",
      bg: "#0c0714",
      panel: "#160d24",
      accent: "#c4b5fd",
      accentSoft: "rgba(167,139,250,.30)",
      score: "#e9d5ff",
      muted: "#b8a8d4",
      text: "#f5efff",
      tierText: "#1a0b2e",
      glow: "rgba(124, 58, 237, .38)",
      borderStops: ["#7c3aed", "#c4b5fd", "#a855f7"],
    };
  }
  if (marketCapMan >= 100_000) {
    return {
      tone: "gold",
      bg: "#080704",
      panel: "#15110a",
      accent: "#ffe08a",
      accentSoft: "rgba(255, 214, 120, .38)",
      score: "#ffe9a8",
      muted: "#c9b789",
      text: "#fff6df",
      tierText: "#1a1205",
      glow: "rgba(255, 204, 90, .48)",
      borderStops: ["#8a6418", "#f6b94e", "#fff1b0", "#ffd078", "#c4892e", "#fff6c8"],
    };
  }
  if (marketCapMan >= 50_000) {
    return {
      tone: "silver",
      bg: "#0a0c10",
      panel: "#15191f",
      accent: "#d7dde7",
      accentSoft: "rgba(192,199,209,.28)",
      score: "#eef2f7",
      muted: "#9aa3af",
      text: "#eef2f7",
      tierText: "#12161c",
      glow: "rgba(180, 190, 205, .28)",
      borderStops: ["#8b95a5", "#e8eef5", "#aeb6c2"],
    };
  }
  if (marketCapMan >= 30_000) {
    return {
      tone: "bronze",
      bg: "#100b08",
      panel: "#1b120c",
      accent: "#d9a066",
      accentSoft: "rgba(205,127,50,.28)",
      score: "#efc08a",
      muted: "#b39a82",
      text: "#f4e6d6",
      tierText: "#1b120c",
      glow: "rgba(184, 115, 51, .30)",
      borderStops: ["#8a4b1f", "#cd7f32", "#e0a86a"],
    };
  }
  return {
    tone: "green",
    bg: "#050a07",
    panel: "#0c1610",
    accent: "#5fbf7a",
    accentSoft: "rgba(47, 133, 90, .32)",
    score: "#8fe3a6",
    muted: "#7fa88a",
    text: "#dff7e6",
    tierText: "#06140b",
    glow: "rgba(34, 120, 72, .34)",
    borderStops: ["#14532d", "#2f855a", "#4ade80"],
  };
}

function createBorderGradient(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  stops: string[],
) {
  const gradient = context.createLinearGradient(0, 0, width, height);
  const last = Math.max(1, stops.length - 1);
  stops.forEach((color, index) => gradient.addColorStop(index / last, color));
  return gradient;
}

function createScoreFill(
  context: CanvasRenderingContext2D,
  theme: ShareCardTheme,
  x: number,
  y: number,
  width: number,
) {
  if (theme.tone === "rainbow" || theme.tone === "purple" || theme.tone === "gold") {
    const gradient = context.createLinearGradient(x, y, x + width, y);
    theme.borderStops.forEach((color, index) => {
      gradient.addColorStop(index / Math.max(1, theme.borderStops.length - 1), color);
    });
    return gradient;
  }
  return theme.score;
}

interface ResultFlavor {
  title: string | null;
  avatar: string | null;
  quizBadge: string;
  marketSignal: string;
  variant: ShareCardPayload["variant"];
}

interface HiddenTitle {
  title: string;
  avatar: string;
}

function getHiddenTitle(display: DisplayResult, ranking: RankingSnapshot | null, tier: string): HiddenTitle | null {
  const { inputs, quizCorrect } = display;
  const totalAssets = inputs.financialAssets + inputs.realEstateAssets + inputs.otherAssets;
  if (inputs.education === "middleSchool" && inputs.occupation === "fund") {
    return { title: "下剋上", avatar: "/title-avatars/gekokujo.jpg" };
  }
  if (inputs.education === "tokyoKyotoGraduate" && inputs.occupation === "nonRegular") {
    return { title: "高学歴ワーキングプア", avatar: "/title-avatars/high-education-working-poor.jpg" };
  }
  if (inputs.appearance === "top10" && inputs.occupation === "professionalGambler") {
    return { title: "宝の持ち腐れ", avatar: "/title-avatars/treasure-wasted.jpg" };
  }
  if (inputs.occupation === "unemployed" && totalAssets >= 10_000) {
    return { title: "無職という名の資本家", avatar: "/title-avatars/unemployed-capitalist.jpg" };
  }
  if (inputs.occupation === "aiEngineer" && inputs.age <= 30 && tier === "S") {
    return { title: "2026最有力銘柄候補", avatar: "/title-avatars/ai-2026-top-pick.jpg" };
  }
  if (["pokerLive", "pokerOnline"].includes(inputs.occupation) && quizCorrect === 5 && inputs.financialAssets < 100) {
    return { title: "EVだけは億万長者", avatar: "/title-avatars/ev-millionaire.jpg" };
  }
  if (inputs.occupation === "public" && totalAssets >= 5_000 && inputs.reinvestmentRate >= .4) {
    return { title: "静かなる資本家", avatar: "/title-avatars/quiet-capitalist.jpg" };
  }
  if (ranking?.deviation.toFixed(1) === "50.0") {
    return { title: "完全なる市場平均", avatar: "/title-avatars/perfect-average.jpg" };
  }
  return null;
}

function getResultFlavor(display: DisplayResult, ranking: RankingSnapshot | null, tier: string): ResultFlavor {
  const { quizCorrect } = display;
  const hiddenTitle = getHiddenTitle(display, ranking, tier);
  const quizBadge = quizCorrect === 5 ? "賢者・利回り最高" : quizCorrect === 0 ? "カモ" : `金融判断 ${quizCorrect}/5`;
  const marketSignal = tier === "S"
    ? "最高評価"
    : tier === "D"
      ? "上場廃止勧告・監理銘柄入り"
      : ranking && ranking.deviation < 50
        ? "TOPIXに負けています"
        : "市場平均を上回っています";
  return {
    title: hiddenTitle?.title ?? null,
    avatar: hiddenTitle?.avatar ?? null,
    quizBadge,
    marketSignal,
    variant: hiddenTitle ? "premium" : tier === "S" ? "surge" : tier === "D" ? "warning" : "standard",
  };
}

function fitCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number, startingSize: number, minimumSize: number) {
  let size = startingSize;
  while (size > minimumSize) {
    context.font = `700 ${size}px "Noto Sans JP", sans-serif`;
    if (context.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

function loadCanvasImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("称号アバターを読み込めませんでした。"));
    image.src = src;
  });
}

async function createShareCardCanvas(payload: ShareCardPayload): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const context = canvas.getContext("2d");
  if (!context) return canvas;

  const theme = shareCardTheme(payload.marketCapMan);
  const accent = theme.accent;
  context.fillStyle = theme.bg;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const glow = context.createRadialGradient(1060, 40, 0, 1060, 40, 600);
  glow.addColorStop(0, theme.glow);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (theme.tone === "rainbow") {
    // Soft rainbow wash behind the score area
    const wash = context.createLinearGradient(60, 160, 1140, 320);
    theme.borderStops.forEach((color, index) => {
      wash.addColorStop(index / Math.max(1, theme.borderStops.length - 1), `${color}33`);
    });
    context.fillStyle = wash;
    context.fillRect(48, 150, 1104, 180);
  } else if (theme.tone === "purple") {
    const wash = context.createLinearGradient(60, 120, 1140, 420);
    wash.addColorStop(0, "rgba(124,58,237,.22)");
    wash.addColorStop(1, "rgba(168,85,247,.05)");
    context.fillStyle = wash;
    context.fillRect(40, 100, 1120, 360);
  } else if (theme.tone === "gold") {
    const wash = context.createLinearGradient(80, 140, 1120, 340);
    wash.addColorStop(0, "rgba(255, 214, 120, .08)");
    wash.addColorStop(0.45, "rgba(255, 236, 170, .26)");
    wash.addColorStop(1, "rgba(196, 137, 46, .10)");
    context.fillStyle = wash;
    context.fillRect(48, 140, 1104, 200);
    const sheen = context.createLinearGradient(100, 200, 980, 280);
    sheen.addColorStop(0, "rgba(255,255,255,0)");
    sheen.addColorStop(0.45, "rgba(255,255,255,.14)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = sheen;
    context.fillRect(72, 190, 980, 90);
  } else if (theme.tone === "green") {
    const wash = context.createLinearGradient(60, 120, 1140, 420);
    wash.addColorStop(0, "rgba(20, 83, 45, .28)");
    wash.addColorStop(1, "rgba(47, 133, 90, .08)");
    context.fillStyle = wash;
    context.fillRect(40, 100, 1120, 360);
  }

  const border = createBorderGradient(context, canvas.width, canvas.height, theme.borderStops);
  context.strokeStyle = border;
  context.lineWidth = 3;
  context.strokeRect(29, 29, 1142, 572);
  context.fillStyle = border;
  context.fillRect(29, 29, 10, 572);
  if (payload.variant === "premium" || theme.tone === "rainbow" || theme.tone === "purple" || theme.tone === "gold") {
    context.strokeStyle = theme.accentSoft;
    context.lineWidth = 2;
    context.strokeRect(43, 43, 1114, 544);
  }

  context.fillStyle = accent;
  context.font = "500 24px 'Noto Sans JP', sans-serif";
  context.fillText("HMC / 人間時価総額", 78, 84);
  context.textAlign = "right";
  context.font = "700 23px 'Noto Sans JP', sans-serif";
  context.fillText(payload.marketSignal, 1120, 84);
  context.textAlign = "left";
  context.fillStyle = theme.muted;
  context.font = "500 25px 'Noto Sans JP', sans-serif";
  context.fillText("あなたの人間時価総額", 78, 143);

  const scoreSize = fitCanvasText(context, payload.score, 1035, 98, 62);
  context.fillStyle = createScoreFill(context, theme, 72, 180, 980);
  context.font = `700 ${scoreSize}px "Noto Sans JP", sans-serif`;
  context.fillText(payload.score, 72, 259);

  context.fillStyle = border;
  context.fillRect(76, 297, 208, 72);
  context.fillStyle = theme.tierText;
  context.font = "700 37px 'Noto Sans JP', sans-serif";
  context.fillText(`${payload.tier}ランク`, 102, 345);
  context.fillStyle = theme.text;
  context.font = "700 40px 'Noto Sans JP', sans-serif";
  context.fillText(`偏差値 ${payload.deviation}`, 326, 345);

  const contentWidth = payload.avatar ? 760 : 1040;
  if (payload.title) {
    context.fillStyle = accent;
    const titleSize = fitCanvasText(context, `隠し称号：${payload.title}`, contentWidth, 33, 22);
    context.font = `700 ${titleSize}px "Noto Sans JP", sans-serif`;
    context.fillText(`隠し称号：${payload.title}`, 78, 414);
  }
  context.fillStyle = theme.text;
  context.font = "600 25px 'Noto Sans JP', sans-serif";
  context.fillText(`金融リテラシー ${payload.quiz}`, 78, 458);

  context.fillStyle = theme.muted;
  const occupationSize = fitCanvasText(context, payload.occupation, contentWidth, 27, 20);
  context.font = `600 ${occupationSize}px "Noto Sans JP", sans-serif`;
  context.fillText(payload.occupation, 78, 503);
  if (payload.avatar) {
    try {
      const avatar = await loadCanvasImage(payload.avatar);
      context.save();
      context.beginPath();
      context.arc(1005, 405, 105, 0, Math.PI * 2);
      context.clip();
      context.drawImage(avatar, 900, 300, 210, 210);
      context.restore();
      context.strokeStyle = accent;
      context.lineWidth = 4;
      context.beginPath();
      context.arc(1005, 405, 106, 0, Math.PI * 2);
      context.stroke();
    } catch {
      // The text result remains shareable even if an avatar asset fails to load.
    }
  }
  context.strokeStyle = theme.accentSoft;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(78, 523);
  context.lineTo(1122, 523);
  context.stroke();

  context.fillStyle = theme.text;
  context.font = "600 25px 'Noto Sans JP', sans-serif";
  context.fillText("あなたも算出してみる →", 78, 559);
  context.fillStyle = theme.muted;
  context.font = "500 17px 'Noto Sans JP', sans-serif";
  context.fillText(payload.url, 78, 586);
  context.fillStyle = accent;
  context.textAlign = "right";
  context.font = "500 20px 'Noto Sans JP', sans-serif";
  context.fillText("#人間時価総額", 1120, 582);
  context.textAlign = "left";
  return canvas;
}

function canvasToPngFile(canvas: HTMLCanvasElement): File {
  const dataUrl = canvas.toDataURL("image/png");
  const binary = atob(dataUrl.split(",")[1]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new File([bytes], "human-market-cap-result.png", { type: "image/png" });
}

export default function HumanMarketCapApp() {
  const [inputs, setInputs] = useState<InputState>(DEFAULTS);
  const [questions, setQuestions] = useState<PublicQuizSet[]>([]);
  const [attemptId, setAttemptId] = useState("");
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswers>({});
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizPhase, setQuizPhase] = useState<QuizPhase>("idle");
  const [timeLeft, setTimeLeft] = useState(QUIZ_SECONDS);
  const [error, setError] = useState("");
  const [quizLoading, setQuizLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [display, setDisplay] = useState<DisplayResult | null>(null);
  const [ranking, setRanking] = useState<RankingSnapshot | null>(null);
  const [shareImageUrl, setShareImageUrl] = useState("");
  const [sharingImage, setSharingImage] = useState(false);
  const [shareFeedback, setShareFeedback] = useState("");
  const [challengeScoreYen, setChallengeScoreYen] = useState<number | null>(null);
  const [wizardStep, setWizardStep] = useState<WizardStepId>(1);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [stepNavError, setStepNavError] = useState("");
  const resultRef = useRef<HTMLElement>(null);
  const ageRef = useRef<HTMLInputElement>(null);
  const incomeRef = useRef<HTMLInputElement>(null);
  const educationRef = useRef<HTMLSelectElement>(null);

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
      setTimeLeft(QUIZ_SECONDS);
      return;
    }
    if (quizIndex >= questions.length - 1) {
      setQuizPhase("done");
      setTimeLeft(0);
      return;
    }
    setQuizIndex((current) => current + 1);
    setQuizPhase("A");
    setTimeLeft(QUIZ_SECONDS);
  }, [questions, quizIndex, quizPhase]);

  useEffect(() => {
    if (quizPhase !== "A" && quizPhase !== "B") return;
    const timer = window.setTimeout(() => {
      if (timeLeft <= 1) advanceQuiz(null);
      else setTimeLeft((current) => current - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [advanceQuiz, quizPhase, timeLeft]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const candidate = Number(params.get("challenge"));
    const challenge = Number.isSafeInteger(candidate) && candidate > 0 ? candidate : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read challenge query on mount
    setChallengeScoreYen(challenge);
    trackEvent(challenge ? "challenge_visit" : "page_view", {
      uid: uid(),
      props: challenge ? { challengeScoreYen: challenge } : undefined,
    });
  }, []);

  function restartValuation() {
    setDisplay(null);
    setRanking(null);
    setShareImageUrl("");
    setShareFeedback("");
    setQuestions([]);
    setAttemptId("");
    setQuizAnswers({});
    setQuizIndex(0);
    setQuizPhase("idle");
    setTimeLeft(QUIZ_SECONDS);
    setError("");
    setQuizLoading(false);
    setCalculating(false);
    setWizardStep(1);
    setFieldErrors({});
    setStepNavError("");
    setInputs({ ...DEFAULTS });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function number(field: keyof InputState, value: number) {
    setInputs((current) => ({ ...current, [field]: Number.isFinite(value) ? value : 0 }));
  }

  function validateStep(step: WizardStepId): { ok: boolean; firstId?: string; errors: Partial<Record<string, string>> } {
    const errors: Partial<Record<string, string>> = {};
    if (step === 1) {
      if (inputs.age < 18 || inputs.age > 80) errors.age = "年齢は18〜80歳で入力してください。";
      if (!(inputs.annualIncome >= 0)) errors.annualIncome = "年収を入力してください。";
      if (!inputs.education) errors.education = "最終学歴を選択してください。";
    }
    if (step === 2) {
      if (!inputs.appearance) errors.appearance = "容姿を選択してください。";
      if (!inputs.occupation) errors.occupation = "職業を選択してください。";
    }
    if (step === 3) {
      if (!(inputs.financialAssets >= 0)) errors.financialAssets = "金融資産を入力してください。";
      if (!(inputs.realEstateAssets >= 0)) errors.realEstateAssets = "不動産資産を入力してください。";
      if (!(inputs.otherAssets >= 0)) errors.otherAssets = "その他資産を入力してください。";
    }
    const firstId = Object.keys(errors)[0];
    return { ok: !firstId, firstId, errors };
  }

  function stepStatus(step: WizardStepId): "current" | "complete" | "incomplete" | "error" {
    if (step === wizardStep) return fieldErrors && Object.keys(fieldErrors).length && step === wizardStep ? (validateStep(step).ok ? "current" : "error") : "current";
    if (step < wizardStep) return validateStep(step).ok ? "complete" : "error";
    return "incomplete";
  }

  function focusFirstError(firstId?: string) {
    const map: Record<string, HTMLElement | null | undefined> = {
      age: ageRef.current,
      annualIncome: incomeRef.current,
      education: educationRef.current,
      appearance: document.getElementById("appearance-group"),
      occupation: document.getElementById("occupation"),
      financialAssets: document.getElementById("financial"),
      realEstateAssets: document.getElementById("realestate"),
      otherAssets: document.getElementById("other-assets"),
    };
    const el = firstId ? map[firstId] : null;
    if (!el) return;
    el.focus?.();
    const top = el.getBoundingClientRect().top + window.scrollY - 16;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  function goNext() {
    setStepNavError("");
    const result = validateStep(wizardStep);
    setFieldErrors(result.errors);
    if (!result.ok) {
      focusFirstError(result.firstId);
      return;
    }
    if (wizardStep < 4) setWizardStep((current) => (current + 1) as WizardStepId);
  }

  function goBack() {
    setStepNavError("");
    setFieldErrors({});
    if (wizardStep > 1) setWizardStep((current) => (current - 1) as WizardStepId);
  }

  function selectWizardStep(next: WizardStepId) {
    setStepNavError("");
    if (next === wizardStep) return;
    if (next > wizardStep) {
      for (let step = 1; step < next; step += 1) {
        const check = validateStep(step as WizardStepId);
        if (!check.ok) {
          setWizardStep(step as WizardStepId);
          setFieldErrors(check.errors);
          setStepNavError("未完了のステップがあります。先に入力を完了してください。");
          focusFirstError(check.firstId);
          return;
        }
      }
    }
    setFieldErrors({});
    setWizardStep(next);
  }

  const quizSetsLeft = quizPhase === "done" ? 0 : quizPhase === "idle" ? 5 : 5 - quizIndex;

  async function startQuiz() {
    setQuizLoading(true);
    setError("");
    try {
      const response = await fetch("/api/quiz/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const payload = await response.json() as QuizStartResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || "クイズを開始できませんでした。");
      setQuestions(payload.sets);
      setAttemptId(payload.attemptId);
      setQuizPhase("A");
      setTimeLeft(QUIZ_SECONDS);
      setQuizIndex(0);
      setQuizAnswers({});
      trackEvent("quiz_start", { uid: uid(), props: { attemptId: payload.attemptId } });
    } catch (startError) {
      trackEvent("api_error", { uid: uid(), props: { action: "quiz_start" } });
      setError(startError instanceof Error ? startError.message : "クイズを開始できませんでした。");
    } finally {
      setQuizLoading(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inputs.age < 18 || inputs.age > 80) {
      setError("年齢は18〜80歳で入力してください。");
      return;
    }
    if (quizPhase !== "done" || !attemptId) {
      setError("金融リテラシーテストを最後まで回答してください。");
      return;
    }
    setError("");
    setCalculating(true);
    try {
      const response = await fetch("/api/valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, uid: uid(), inputs, answers: quizAnswers }),
      });
      const payload = await response.json() as ValuationResponse & { error?: string };
      if (!response.ok) {
        if (response.status === 409 || response.status === 410) {
          setQuestions([]);
          setAttemptId("");
          setQuizAnswers({});
          setQuizPhase("idle");
        }
        throw new Error(payload.error || "査定できませんでした。");
      }
      const previous = localStorage.getItem("hmc_previous_score");
      localStorage.setItem("hmc_previous_score", String(payload.scoreYen));
      setDisplay({
        calculation: payload.calculation,
        scoreYen: payload.scoreYen,
        previousScoreYen: previous === null ? null : Number(previous),
        reviews: payload.reviews,
        quizCorrect: payload.quizCorrect,
        inputs: { ...inputs },
      });
      setRanking(payload.ranking);
      trackEvent("valuation_complete", {
        uid: uid(),
        props: {
          scoreYen: payload.scoreYen,
          quizCorrect: payload.quizCorrect,
          fromChallenge: challengeScoreYen !== null,
        },
      });
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    } catch (submitError) {
      trackEvent("api_error", { uid: uid(), props: { action: "valuation" } });
      setError(submitError instanceof Error ? submitError.message : "査定できませんでした。");
    } finally {
      setCalculating(false);
    }
  }

  const result = display?.calculation;
  const tier = result ? getTier(result.marketCapMan) : "D";
  const activeQuiz = questions[quizIndex];
  const activePart = activeQuiz && (quizPhase === "A" || quizPhase === "B") ? activeQuiz[quizPhase.toLowerCase() as "a" | "b"] : null;
  const flavor = useMemo(
    () => display && result ? getResultFlavor(display, ranking, tier) : null,
    [display, ranking, result, tier],
  );

  function challengeUrl(scoreYen: number) {
    const url = new URL(window.location.pathname, window.location.origin);
    url.searchParams.set("challenge", String(scoreYen));
    return url.toString();
  }

  useEffect(() => {
    if (!display || !result || !flavor) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale share card when result resets
      setShareImageUrl("");
      return;
    }
    let active = true;
    const render = async () => {
      await document.fonts?.ready;
      if (!active) return;
      const canvas = await createShareCardCanvas({
        score: formatShareScore(result.marketCapMan),
        tier,
        deviation: ranking ? ranking.deviation.toFixed(1) : "—",
        occupation: result.occupation.label,
        quiz: `${display.quizCorrect}/5｜${flavor.quizBadge}`,
        title: flavor.title,
        avatar: flavor.avatar,
        marketSignal: flavor.marketSignal,
        variant: flavor.variant,
        url: challengeUrl(display.scoreYen).replace(/^https?:\/\//, ""),
        marketCapMan: result.marketCapMan,
      });
      setShareImageUrl(canvas.toDataURL("image/png"));
    };
    void render();
    return () => { active = false; };
  }, [display, flavor, ranking, result, tier]);

  function shareText() {
    if (!display || !result) return;
    const position = ranking
      ? `全体順位 ${ranking.rank}/${ranking.total}｜偏差値 ${ranking.deviation.toFixed(1)}｜上位${ranking.topPercent.toFixed(1)}%｜掲示板 ${ranking.leaderboardRank}/${ranking.leaderboardTotal}`
      : "市場ポジションを査定中";
    const summary = [
      "【人間時価総額 CALCULATOR】",
      `査定額：${formatMan(result.marketCapMan)}`,
      `${tier}ランク｜${result.occupation.label}`,
      position,
      flavor?.title ? `隠し称号：${flavor.title}` : null,
      `金融リテラシー ${display.quizCorrect}/5点｜${flavor?.quizBadge ?? ""}`,
      flavor?.marketSignal ?? "",
      "※もちろん、人間の価値はこの数字では決まりません。",
      "#人間時価総額 #HMC",
      challengeUrl(display.scoreYen),
    ].filter(Boolean).join("\n");
    return summary;
  }

  async function shareResultImage() {
    if (!display || !result || !flavor) return;
    setSharingImage(true);
    setShareFeedback("");
    trackEvent("share_click", { uid: uid(), props: { scoreYen: display.scoreYen } });
    try {
      const canvas = await createShareCardCanvas({
        score: formatShareScore(result.marketCapMan),
        tier,
        deviation: ranking ? ranking.deviation.toFixed(1) : "—",
        occupation: result.occupation.label,
        quiz: `${display.quizCorrect}/5｜${flavor.quizBadge}`,
        title: flavor.title,
        avatar: flavor.avatar,
        marketSignal: flavor.marketSignal,
        variant: flavor.variant,
        url: challengeUrl(display.scoreYen).replace(/^https?:\/\//, ""),
        marketCapMan: result.marketCapMan,
      });
      const file = canvasToPngFile(canvas);
      const summary = shareText() ?? "#人間時価総額";
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: summary });
        trackEvent("share_success", { uid: uid(), props: { method: "share_api" } });
        setShareFeedback("結果カードを共有しました。");
        return;
      }
      const download = document.createElement("a");
      download.href = canvas.toDataURL("image/png");
      download.download = file.name;
      download.click();
      window.open(`https://x.com/intent/post?text=${encodeURIComponent(summary)}`, "_blank", "noopener,noreferrer");
      trackEvent("share_success", { uid: uid(), props: { method: "download_x" } });
      setShareFeedback("結果カードを保存しました。開いたXの投稿画面へ画像を添付してください。");
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") return;
      trackEvent("api_error", { uid: uid(), props: { action: "share" } });
      setShareFeedback("共有を開始できませんでした。もう一度お試しください。");
    } finally {
      setSharingImage(false);
    }
  }

  return (
    <main className="hmc-app">
      <div className="app-shell">
        <header className="brand-bar">
          <a
            className="brand"
            href="#top"
            aria-label="最初からやり直す"
            title="最初からやり直す"
            onClick={(event) => {
              event.preventDefault();
              restartValuation();
            }}
          >
            <span className="brand-mark" aria-hidden="true">
              <svg className="brand-mark-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1.5" y="1.5" width="45" height="45" rx="3" stroke="url(#hmcGold)" strokeWidth="1.5" />
                <path d="M8 8H14M34 8H40M8 40H14M34 40H40" stroke="url(#hmcGold)" strokeWidth="1.5" strokeLinecap="square" />
                <path d="M8 8V14M40 8V14M8 34V40M40 34V40" stroke="url(#hmcGold)" strokeWidth="1.5" strokeLinecap="square" />
                <rect x="7" y="7" width="34" height="34" rx="1.5" stroke="rgba(246,185,78,0.28)" strokeWidth="1" />
                <text x="24" y="28.5" textAnchor="middle" fill="#FFD078" fontFamily="Noto Sans JP, sans-serif" fontSize="12" fontWeight="800" letterSpacing="0.5">HMC</text>
                <defs>
                  <linearGradient id="hmcGold" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#FFD078" />
                    <stop offset="0.5" stopColor="#F6B94E" />
                    <stop offset="1" stopColor="#C4892E" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
          </a>
          <span className="model-tag model-version">モデル v20</span>
        </header>

        <section className="intro" id="top">
          <p className="eyebrow">将来の稼ぎを、いま測る</p>
          <h1 className="hero-title">
            <span className="hero-title-line">あなたの価値を、</span>
            <span className="hero-title-line hero-title-accent">数字にする。</span>
          </h1>
          <p className="intro-copy">現在の収入・職種のポテンシャル・資産・将来の選択肢から、将来の収益力を読みます。</p>
          <div className="formula-strip" aria-label="査定の計算式">
            <span>本業所得 ＋ キャリアの選択肢 ＋ 資産所得 ＋ 初期資産</span>
            <span className="formula-eq">＝ 人間時価総額</span>
          </div>
          <div className="trust-row"><span>01 / 匿名ID</span><span>02 / 約3分</span><span>03 / 査定ごとに記録</span></div>
        </section>

        {challengeScoreYen !== null && (
          <section className="challenge-banner">
            <span>チャレンジ査定</span>
            <strong>{formatShareScore(challengeScoreYen / 10000)}に挑戦する</strong>
            <p>シェアした人の査定額を超えられるか。条件を入力して勝負してください。</p>
            <a href="#valuation-form">診断を始める →</a>
          </section>
        )}

        <form className="calculator-form" id="valuation-form" onSubmit={submit} noValidate>
          <div className="form-heading"><div><span className="eyebrow">査定シート</span><h2>査定情報</h2></div></div>

          <div className="valuation-layout">
            <aside className="wizard-sidebar" aria-label="ステップ一覧">
              <WizardProgress
                step={wizardStep}
                statuses={{
                  1: stepStatus(1),
                  2: stepStatus(2),
                  3: stepStatus(3),
                  4: stepStatus(4),
                }}
                onSelect={selectWizardStep}
                variant="sidebar"
              />
            </aside>

            <div className="valuation-main">
              <WizardProgress
                step={wizardStep}
                statuses={{
                  1: stepStatus(1),
                  2: stepStatus(2),
                  3: stepStatus(3),
                  4: stepStatus(4),
                }}
                onSelect={selectWizardStep}
                variant="compact"
              />

              {stepNavError && <p className="form-error" role="alert">{stepNavError}</p>}

              {wizardStep === 1 && (
                <>
                  <div className="basic-grid">
                    <section className="question-card">
                      <QuestionHeader number="01" title="現在の年齢" htmlFor="age" />
                      <NumberInputWithUnit
                        ref={ageRef}
                        id="age"
                        unit="歳"
                        type="number"
                        inputMode="numeric"
                        min={18}
                        max={80}
                        value={inputs.age}
                        invalid={Boolean(fieldErrors.age)}
                        describedBy={[fieldErrors.age ? "age-error" : "", "age-help"].filter(Boolean).join(" ") || undefined}
                        onChange={(event) => number("age", Number(event.target.value))}
                      />
                      <FieldHelp id="age-help">職業別の就労終了年齢までを残余就労期間として計算します。</FieldHelp>
                      <FieldError id="age-error" message={fieldErrors.age} />
                    </section>

                    <section className="question-card">
                      <QuestionHeader number="02" title="現在の年収" htmlFor="income" />
                      <NumberInputWithUnit
                        ref={incomeRef}
                        id="income"
                        unit="万円"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={inputs.annualIncome}
                        invalid={Boolean(fieldErrors.annualIncome)}
                        describedBy={[fieldErrors.annualIncome ? "income-error" : "", "income-help"].filter(Boolean).join(" ") || undefined}
                        onChange={(event) => number("annualIncome", Number(event.target.value))}
                      />
                      <FieldHelp id="income-help">額面年収です。将来の賃金カーブの起点になります。</FieldHelp>
                      <FieldError id="income-error" message={fieldErrors.annualIncome} />
                    </section>
                  </div>

                  <section className="question-card">
                    <QuestionHeader number="03" title="最終学歴" htmlFor="education" />
                    <SelectField
                      ref={educationRef}
                      id="education"
                      value={inputs.education}
                      invalid={Boolean(fieldErrors.education)}
                      describedBy={fieldErrors.education ? "education-error" : undefined}
                      onChange={(event) => setInputs((current) => ({ ...current, education: event.target.value as EducationKey }))}
                    >
                      {EDUCATIONS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                    </SelectField>
                    <div className="parameter-card">
                      <div>
                        <span className="parameter-label">キャリア補正 <InfoTooltip label="キャリア補正">学歴によるキャリア全体の補正係数です。</InfoTooltip></span>
                        <strong>×{education.multiplier.toFixed(3)}</strong>
                      </div>
                      <div>
                        <span className="parameter-label">ネットワーク指数 <InfoTooltip label="ネットワーク指数">学歴に紐づく人的ネットワークの指数です。</InfoTooltip></span>
                        <strong>{education.nw}</strong>
                      </div>
                      <div>
                        <span className="parameter-label">年収補正 <InfoTooltip label="年収補正">ネットワーク指数が毎年の給与成長へ与える補正です。</InfoTooltip></span>
                        <strong>{formatPercent(nwSalaryAdjustment(education.nw), 2)}</strong>
                      </div>
                      <div>
                        <span className="parameter-label">転職補正 <InfoTooltip label="転職補正">ネットワーク指数が転職後所得へ与える補正です。</InfoTooltip></span>
                        <strong>{formatPercent(nwTransitionAdjustment(education.nw), 1)}</strong>
                      </div>
                    </div>
                    <FieldError id="education-error" message={fieldErrors.education} />
                  </section>
                </>
              )}

              {wizardStep === 2 && (
                <>
                  <section className="question-card">
                    <fieldset id="appearance-group">
                      <legend className="question-header">
                        <span className="question-number" aria-hidden="true">04</span>
                        <span className="question-title-text">容姿（自己評価）</span>
                      </legend>
                      <FieldHelp>自己評価に基づく項目です。給与成長率などの補正に使用します。</FieldHelp>
                      <div className="choice-grid five" role="radiogroup" aria-label="容姿（自己評価）">
                        {APPEARANCES.map((item) => (
                          <label key={item.key} className={inputs.appearance === item.key ? "selected" : ""}>
                            <input
                              type="radio"
                              name="appearance"
                              checked={inputs.appearance === item.key}
                              onChange={() => setInputs((current) => ({ ...current, appearance: item.key as AppearanceKey }))}
                            />
                            <span>{item.label}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div className="parameter-card two">
                      <div><span>給与成長（職業補正後）</span><strong>{formatPercent(appearance.salaryBase * job.appearanceMultiplier, 2)}</strong></div>
                      <div><span>資産利回り</span><strong>{formatPercent(appearance.returnAdjustment, 1)}</strong></div>
                    </div>
                    <FieldError id="appearance-error" message={fieldErrors.appearance} />
                  </section>

                  <section className="question-card">
                    <QuestionHeader number="05" title="現在の職業" />
                    <div className="occupation-selects">
                      <label htmlFor="occupation-category"><span>職種</span>
                        <SelectField
                          id="occupation-category"
                          value={category}
                          onChange={(event) => {
                            const next = getOccupationsByCategory(event.target.value as OccupationCategoryKey)[0];
                            if (next) setInputs((current) => ({ ...current, occupation: next.key as OccupationKey }));
                          }}
                        >
                          {OCCUPATION_CATEGORIES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                        </SelectField>
                      </label>
                      <label htmlFor="occupation"><span>職業</span>
                        <SelectField
                          id="occupation"
                          value={inputs.occupation}
                          invalid={Boolean(fieldErrors.occupation)}
                          describedBy={fieldErrors.occupation ? "occupation-error" : undefined}
                          onChange={(event) => setInputs((current) => ({ ...current, occupation: event.target.value as OccupationKey }))}
                        >
                          {categoryJobs.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                        </SelectField>
                      </label>
                    </div>
                    <div className="occupation-card">
                      <div className="occupation-stats">
                        <div><span>想定就労年齢</span><strong>{job.retirement}</strong></div>
                        <div><span>年収ピーク年齢</span><strong>{job.peak}</strong></div>
                        <div><span>想定運用利回り</span><strong>{(job.baseReturn * 100).toFixed(1)}%</strong></div>
                        <div><span>キャリアリスク</span><strong>{(job.careerRisk * 100).toFixed(1)}%</strong></div>
                      </div>
                      <div className="curve-preview"><span>賃金カーブ</span><MiniCurve occupation={inputs.occupation} /></div>
                      <div className="risk-line"><span>主職{job.primaryEnd}歳まで / 転職後{Math.round(job.transitionIncomeRate * 100)}% / 容姿×{job.appearanceMultiplier.toFixed(1)}</span><b className={`risk-badge risk-${job.riskLabel.toLowerCase().replace(/\s/g, "-")}`}>リスク水準: {formatRiskLabel(job.riskLabel)}</b></div>
                      <div className="job-income-floor">現在年齢のポテンシャル年収：<strong>{occupationIncomeFloor(job, inputs.age).toLocaleString("ja-JP")}万円</strong></div>
                      {job.specialNote && <div className={`job-special-note ${job.key === "aiEngineer" ? "ai-strongest" : ""}`}>{job.specialNote}</div>}
                    </div>
                    <FieldError id="occupation-error" message={fieldErrors.occupation} />
                  </section>
                </>
              )}

              {wizardStep === 3 && (
                <>
                  <section className="question-card">
                    <QuestionHeader number="06" title="現金・金融資産" htmlFor="financial" />
                    <NumberInputWithUnit
                      id="financial"
                      unit="万円"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={inputs.financialAssets}
                      invalid={Boolean(fieldErrors.financialAssets)}
                      describedBy={fieldErrors.financialAssets ? "financial-error" : undefined}
                      onChange={(event) => number("financialAssets", Number(event.target.value))}
                    />
                    <FieldError id="financial-error" message={fieldErrors.financialAssets} />
                  </section>

                  <section className="question-card">
                    <QuestionHeader number="07" title="不動産・その他資産" />
                    <div className="assets-grid assets-grid-2">
                      <div>
                        <label htmlFor="realestate" className="sr-only">不動産資産</label>
                        <NumberInputWithUnit
                          id="realestate"
                          unit="万円"
                          type="number"
                          inputMode="decimal"
                          min={0}
                          value={inputs.realEstateAssets}
                          invalid={Boolean(fieldErrors.realEstateAssets)}
                          describedBy={fieldErrors.realEstateAssets ? "realestate-error" : "realestate-help"}
                          onChange={(event) => number("realEstateAssets", Number(event.target.value))}
                        />
                        <FieldHelp id="realestate-help">不動産資産</FieldHelp>
                        <FieldError id="realestate-error" message={fieldErrors.realEstateAssets} />
                      </div>
                      <div>
                        <label htmlFor="other-assets" className="sr-only">その他資産</label>
                        <NumberInputWithUnit
                          id="other-assets"
                          unit="万円"
                          type="number"
                          inputMode="decimal"
                          min={0}
                          value={inputs.otherAssets}
                          invalid={Boolean(fieldErrors.otherAssets)}
                          describedBy={fieldErrors.otherAssets ? "other-error" : "other-help"}
                          onChange={(event) => number("otherAssets", Number(event.target.value))}
                        />
                        <FieldHelp id="other-help">その他資産（債券・金・時計など）</FieldHelp>
                        <FieldError id="other-error" message={fieldErrors.otherAssets} />
                      </div>
                    </div>
                    <FieldHelp>現金・金融資産・不動産・その他資産を合算して初期資産に計上します。</FieldHelp>
                  </section>

                  <section className="question-card">
                    <QuestionHeader number="08" title="給与からの再投資率" htmlFor="reinvestment" />
                    <div className="range-head">
                      <strong className="hmc-number" aria-live="polite">{Math.round(inputs.reinvestmentRate * 100)}%</strong>
                      <span className="range-pill">推奨 20%以上</span>
                    </div>
                    <input
                      id="reinvestment"
                      className="range-input"
                      type="range"
                      min={0}
                      max={80}
                      value={Math.round(inputs.reinvestmentRate * 100)}
                      aria-valuemin={0}
                      aria-valuemax={80}
                      aria-valuenow={Math.round(inputs.reinvestmentRate * 100)}
                      aria-valuetext={`${Math.round(inputs.reinvestmentRate * 100)}パーセント`}
                      onChange={(event) => number("reinvestmentRate", Number(event.target.value) / 100)}
                    />
                    <div className="range-scale"><span>0%</span><span>40%</span><span>80%</span></div>
                  </section>
                </>
              )}

              {wizardStep === 4 && (
                <>
                  <section className="question-card quiz-card" id="question-9">
                    <div className="quiz-title">
                      <span className="question-number" aria-hidden="true">09</span>
                      <div>
                        <span>金融リテラシー瞬発クイズ</span>
                        <small>ランダム5セット · A/B 各20秒</small>
                      </div>
                    </div>
                    <div className="quiz-meta-row" aria-label="クイズ概要">
                      <span>必須</span>
                      <span>全5セット</span>
                      <span>A/B 各20秒</span>
                      <span>所要時間 約2分</span>
                    </div>
                    {quizPhase === "idle" && (
                      <div className="quiz-start-panel">
                        <p>15セットから選ばれた5セットに挑戦します。Aに答えるとBが表示され、Aの回答は変更できません。A・Bの両方を満たした場合のみ1点です。</p>
                        <button type="button" onClick={startQuiz} disabled={quizLoading}>
                          {quizLoading ? <><span className="quiz-spinner" aria-hidden="true" />クイズを準備中…</> : "5問を開始する"}
                        </button>
                      </div>
                    )}
                    {activeQuiz && activePart && (quizPhase === "A" || quizPhase === "B") && (
                      <div className="quiz-stage">
                        <div className="quiz-progress-row">
                          <span>セット {quizIndex + 1} / 5</span>
                          <div><i style={{ width: `${(quizIndex + (quizPhase === "B" ? .5 : 0)) / 5 * 100}%` }} /></div>
                          <b className={`quiz-timer${timeLeft <= 5 ? " urgent" : ""}`}>{timeLeft}<small>秒</small></b>
                        </div>
                        <div className="quiz-set-heading"><span>{activeQuiz.id.toUpperCase()}</span><strong>{activeQuiz.title}</strong></div>
                        {activeQuiz.lead && <p className="quiz-lead">{activeQuiz.lead}</p>}
                        <fieldset className="quiz-question active">
                          <legend><span>{quizPhase}</span>{activePart.prompt}</legend>
                          <div className="quiz-options">
                            {activePart.options.map((option, index) => (
                              <button type="button" key={option} onClick={() => advanceQuiz(index)}>
                                <i aria-hidden="true">{index + 1}</i><span>{option}</span>
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
                  <button
                    className="calculate-button"
                    type="submit"
                    disabled={questions.length !== 5 || quizPhase !== "done" || calculating}
                  >
                    <span>{calculating ? <><span className="quiz-spinner" aria-hidden="true" />算出中…</> : "時価総額を算出する"}</span>
                    <b aria-hidden="true">→</b>
                  </button>
                  {quizPhase !== "done" && (
                    <p className="calculate-hint">クイズ完了後に算出できます（残り{quizSetsLeft}セット）</p>
                  )}
                  <PrivacySummary />
                </>
              )}

              <div className="wizard-actions-desktop">
                <SecondaryButton type="button" onClick={goBack} disabled={wizardStep === 1}>戻る</SecondaryButton>
                {wizardStep < 4 ? (
                  <PrimaryButton type="button" onClick={goNext}>次へ <span aria-hidden="true">→</span></PrimaryButton>
                ) : (
                  <PrimaryButton type="button" onClick={() => document.getElementById("question-9")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                    クイズへ <span aria-hidden="true">↓</span>
                  </PrimaryButton>
                )}
              </div>
            </div>
          </div>

          <div className="wizard-actions-mobile">
            <SecondaryButton type="button" onClick={goBack} disabled={wizardStep === 1}>戻る</SecondaryButton>
            {wizardStep < 4 ? (
              <PrimaryButton type="button" onClick={goNext}>次へ <span aria-hidden="true">→</span></PrimaryButton>
            ) : (
              <PrimaryButton
                type="button"
                onClick={() => {
                  if (quizPhase === "done") {
                    const form = document.getElementById("valuation-form") as HTMLFormElement | null;
                    form?.requestSubmit();
                  } else {
                    document.getElementById("question-9")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }}
                disabled={calculating}
              >
                {quizPhase === "done" ? "算出する" : "クイズへ"} <span aria-hidden="true">→</span>
              </PrimaryButton>
            )}
          </div>
        </form>

        {display && result && (
          <section className="results" ref={resultRef}>
            <div className="result-divider"><span>査定結果</span><b>査定完了</b></div>
            <section className={`market-hero tier-${tier} flavor-${flavor?.variant ?? "standard"}`}>
              <div className="hero-badges"><span className="tier-badge">{tier}ランク</span><span className="model-tag">標準シナリオ</span><span className={`risk-badge risk-${result.occupation.riskLabel.toLowerCase().replace(/\s/g, "-")}`}>{formatRiskLabel(result.occupation.riskLabel)}リスク</span></div>
              <p>人間時価総額 / 将来の収益ポテンシャル評価</p><h2>{formatMan(result.marketCapMan)}</h2><span className="hero-en">標準シナリオでの見積もり</span>
              {flavor && <div className={`result-flavor ${flavor.title ? "has-hidden-title" : ""}`}>
                {flavor.avatar && <img className="hidden-title-avatar" src={flavor.avatar} alt={`${flavor.title}の称号アバター`} />}
                <div className="result-flavor-copy">
                  <span>{flavor.marketSignal}</span>
                  {flavor.title && <><em>隠し称号を解除</em><strong>隠し称号：{flavor.title}</strong></>}
                  <b>{flavor.quizBadge}</b>
                </div>
              </div>}
              <div className="scenario-strip" aria-label="シナリオ比較">
                {result.scenarios.map((scenario) => (
                  <div key={scenario.id} className={`scenario-chip scenario-${scenario.id}${scenario.id === "base" ? " is-active" : ""}`}>
                    <span>{scenario.label}</span>
                    <strong>{formatMan(scenario.marketCapMan)}</strong>
                  </div>
                ))}
              </div>
              {result.valueDrivers.length > 0 && (
                <div className="driver-tape" aria-label="価値への寄与">
                  {result.valueDrivers.map((driver) => (
                    <span key={driver.id} className={`driver-chip driver-${driver.direction}`}>
                      {driver.direction === "up" ? "+" : "−"} {driver.label}
                      <em>{formatMan(driver.direction === "up" ? driver.amountMan : -driver.amountMan)}</em>
                    </span>
                  ))}
                </div>
              )}
              <Trace title="算定の内訳を見る">
                <p>本業所得 {formatMan(result.salaryIncomeMan)} ＋ キャリアの選択肢 {formatMan(result.careerOptionMan)} ＋ 資産所得 {formatMan(result.assetIncomeMan)} ＋ 初期資産 {formatMan(display.inputs.financialAssets + display.inputs.realEstateAssets + display.inputs.otherAssets)}</p>
                <p>残余{result.yearsRemaining}年。ポテンシャル年収を下限に、キャリアの選択肢を別建てで加算しています。この数値は将来の収益ポテンシャルの試算で、実際の収入・雇用・人格的価値を示すものではありません。</p>
              </Trace>
            </section>

            {result.occupation.specialNote && <p className={`result-job-note ${result.occupation.key === "aiEngineer" ? "ai-strongest" : ""}`}>{result.occupation.specialNote}</p>}

            {challengeScoreYen !== null && (
              <div className={`challenge-result ${display.scoreYen >= challengeScoreYen ? "win" : "lose"}`}>
                <span>{display.scoreYen >= challengeScoreYen ? "チャレンジ成功" : "チャレンジ惜敗"}</span>
                <strong>{display.scoreYen >= challengeScoreYen ? "勝ちました" : "届きませんでした"}</strong>
                <p>挑戦者との差：{display.scoreYen >= challengeScoreYen ? "＋" : "−"}{formatMan(Math.abs(display.scoreYen - challengeScoreYen) / 10000)}</p>
              </div>
            )}

            <section className="result-card share-card">
              <div className="share-card-heading">
                <span>シェア用カード</span>
                <strong>{flavor?.title ? "隠し称号つき結果カードが出現" : "結果カードができました"}</strong>
              </div>
              <div className="share-image-frame">
                {shareImageUrl
                  ? <img src={shareImageUrl} alt={`人間時価総額 ${formatShareScore(result.marketCapMan)}、${tier}ランク${ranking ? `、偏差値${ranking.deviation.toFixed(1)}` : ""}のシェアカード`} />
                  : <div className="share-image-loading"><span />結果カードを生成しています…</div>}
              </div>
              <button type="button" className="x-share-button" onClick={shareResultImage} disabled={sharingImage}><span>𝕏</span><strong>{sharingImage ? "シェア画像を準備中…" : "Xで結果カードをシェア"}</strong><b>→</b></button>
              <p className="share-helper">スマホは共有先でXを選択。未対応端末では画像を保存してXを開きます。</p>
              {shareFeedback && <p className="share-feedback" role="status">{shareFeedback}</p>}
            </section>

            {display.previousScoreYen !== null && (
              <div className={`delta-banner ${display.scoreYen >= display.previousScoreYen ? "positive" : "negative"}`}><span>{display.scoreYen >= display.previousScoreYen ? "前回比・急騰 ↑" : "前回比・暴落 ↓"}</span><strong>{display.scoreYen >= display.previousScoreYen ? "＋" : "−"}{formatMan(Math.abs(display.scoreYen - display.previousScoreYen) / 10000)}</strong></div>
            )}

            <section className="result-card ranking-card">
              <div className="section-title"><div><span className="eyebrow">市場での位置</span><h3>市場ポジション</h3></div><span className={`connection ${ranking ? "online" : ""}`}>{ranking ? "取得済み" : "取得中"}</span></div>
              {ranking ? <><div className="ranking-kpis"><div><span>全体順位</span><strong><em>{ranking.rank}</em> / {ranking.total}</strong></div><div><span>偏差値</span><strong><em>{ranking.deviation.toFixed(1)}</em></strong></div><div><span>上位</span><strong><em>{ranking.topPercent.toFixed(1)}</em>%</strong></div><div><span>掲示板</span><strong><em>{ranking.leaderboardRank}</em> / {ranking.leaderboardTotal}</strong></div></div><Histogram ranking={ranking} score={display.scoreYen} /><p className="demo-note">全体順位・偏差値・分布は査定履歴全体との比較です（ダミーデータ除く）。掲示板は表示用の上位約1,000件です。</p></> : <div className="ranking-loading"><span />ランキングを照合しています…</div>}
            </section>

            <section className="kpi-grid">
              <article className="result-card kpi-card"><span className="kpi-icon blue">01</span><p>本業所得</p><h3>{formatMan(result.salaryIncomeMan)}</h3><Trace title="本業所得の内訳"><p>入力年収とポテンシャル年収を起点に、職業カーブ・インフレ2%・ネットワーク指数・容姿を毎年適用。</p><p>離職時は所得ゼロではなく、職業別の転職後所得率へ移行する期待値モデルです。</p></Trace></article>
              <article className="result-card kpi-card"><span className="kpi-icon cyan">02</span><p>キャリアの選択肢</p><h3>{formatMan(result.careerOptionMan)}</h3><Trace title="キャリアの選択肢の内訳"><p>スキル転用・昇格・副業・顧問など、職種ごとの選択肢価値を本体所得から別建てで計上。</p><p>上振れシナリオでは比率を上げ、守りシナリオでは抑えて表示します。</p></Trace></article>
              <article className="result-card kpi-card"><span className="kpi-icon gold">03</span><p>資産所得</p><h3>{formatMan(result.assetIncomeMan)}</h3><Trace title="資産所得の内訳"><p>初期資産 {formatMan(display.inputs.financialAssets + display.inputs.realEstateAssets + display.inputs.otherAssets)} に年収の{Math.round(display.inputs.reinvestmentRate * 100)}%を毎年追加。</p><p>実効利回り {(result.effectiveReturn * 100).toFixed(2)}%で複利運用した運用益。元本自体は時価総額へ別加算。</p></Trace></article>
            </section>

            <section className="result-card charts-card"><div className="section-title"><div><span className="eyebrow">生涯の見通し</span><h3>生涯キャッシュフロー</h3></div><span className="scroll-hint">代表年齢を表示</span></div><Charts result={result} /></section>

            <section className="result-card assumptions-card">
              <div className="section-title"><div><span className="eyebrow">試算の前提</span><h3>試算の前提条件</h3></div></div>
              <div className="assumption-list">
                <div><span>残余就労年数</span><strong>{result.yearsRemaining}年（{display.inputs.age}→{result.occupation.retirement}歳）</strong></div>
                <div><span>主職終了年齢</span><strong>{result.occupation.primaryEnd}歳</strong></div>
                <div><span>キャリア補正</span><strong>×{result.education.multiplier.toFixed(3)}</strong></div>
                <div><span>ネットワーク指数</span><strong>{result.education.nw}</strong></div>
                <div><span>年収補正</span><strong>{formatPercent(result.nwSalaryAdjustment, 2)} / 年</strong></div>
                <div><span>転職補正</span><strong>{formatPercent(result.nwTransitionAdjustment, 1)}</strong></div>
                <div><span>転職後所得率</span><strong>{(result.transitionIncomeRate * 100).toFixed(1)}%</strong></div>
                <div><span>転職後の初期基準年収</span><strong>{Math.round(result.transitionBaseIncome).toLocaleString("ja-JP")}万円</strong></div>
                <div><span>ポテンシャル年収アンカー</span><strong>{result.occupationIncomeFloor.toLocaleString("ja-JP")}万円</strong></div>
                <div><span>キャリアオプション</span><strong>{formatMan(result.careerOptionMan)}</strong></div>
                <div><span>モデル版</span><strong>{result.modelVersion.toUpperCase()}</strong></div>
                <div><span>容姿→給与</span><strong>{formatPercent(result.appearanceSalaryAdjustment, 2)} / 年</strong></div>
                <div><span>容姿→利回り</span><strong>{formatPercent(result.appearanceReturnAdjustment, 1)}</strong></div>
                <div><span>職業別基本利回り</span><strong>{formatPercent(result.occupation.baseReturn)}</strong></div>
                {result.occupation.specialGrowthYears && <div className="highlight"><span>期間限定成長ブースト</span><strong>最初の{result.occupation.specialGrowthYears}年 ＋{Math.round((result.occupation.specialGrowthRate ?? 0) * 100)}% / 年</strong></div>}
                <div><span>金融リテラシー</span><strong>{display.quizCorrect} / 5点・{formatPercent(result.financialAdjustment)}</strong></div>
                <div className="highlight"><span>実効利回り</span><strong>{(result.effectiveReturn * 100).toFixed(2)}%（上限なし）</strong></div>
                <div><span>キャリア変動リスク</span><strong>{(result.occupation.careerRisk * 100).toFixed(1)}% / 年</strong></div>
              </div>
              <div className="model-notes">
                <p><b>ポテンシャル年収</b> 職業値は実収平均ではなく、専門性・可搬性・副収入を含むポテンシャル年収です。初年度は入力年収を採用し、基準の25%未満なら翌年に回復、未満なら毎年差額の35%ずつ近づきます。</p>
                <p><b>キャリアの選択肢</b> 本体所得とは別に、職種カテゴリごとの比率で将来の選択肢価値を加算します。</p>
                <p><b>3つのシナリオ</b> 標準はいちばん起きやすい見積もり、上振れは成長・副収入が進んだ場合、守りは継続性が弱い場合です。ランキング比較には標準を使います。</p>
                <p><b>簡易DCF</b> 厳密な現在価値への割引計算ではなく、キャリア継続確率で調整した将来所得を累計する簡易モデルです。</p>
                <p><b>資産モデル</b> 現金・金融資産・不動産・その他資産を合算し、資産種別によらず同じ実効利回りで運用する簡易モデルです。</p>
              </div>
            </section>

            <section className="result-card factors-card">
              <div className="section-title"><div><span className="eyebrow">評価の要因</span><h3>評価ファクター</h3></div></div>
              <Factor label="金融リテラシー" value={display.quizCorrect / 5 * 100} caption={`${display.quizCorrect}/5`} />
              <Factor label="実効利回り" value={(result.effectiveReturn + .06) / .16 * 100} caption={`${(result.effectiveReturn * 100).toFixed(2)}%`} />
              <Factor label="ネットワーク指数" value={result.education.nw} caption={`${result.education.nw}`} />
              <Factor label="容姿補正" value={50 + result.appearanceSalaryAdjustment * 2000} caption={formatPercent(result.appearanceSalaryAdjustment, 2)} />
              <Factor label="キャリア持続性" value={100 - result.occupation.careerRisk * 800} caption={`${((1 - result.occupation.careerRisk) * 100).toFixed(1)}%`} />
              <Factor label="残余就労年数" value={result.yearsRemaining / 50 * 100} caption={`${result.yearsRemaining}年`} />
            </section>

            <QuizReview reviews={display.reviews} />

            <section className="result-card analysis-card">
              <div className="section-title"><div><span className="eyebrow">分析メモ</span><h3>分析コメント</h3></div></div>
              <div className="analyst-stamp"><span>{tier}</span><div><strong>{tier === "S" ? "超優良人材" : tier === "A" ? "成長優良人材" : tier === "B" ? "安定成長人材" : tier === "C" ? "改善余地あり" : "再建プラン推奨"}</strong><small>HMC評価</small></div></div>
              <ol>{notes(result).map((note) => <li key={note}>{note}</li>)}</ol>
              <p className="risk-warning"><b>ご注意</b> この数値は、入力情報とモデル前提に基づく将来の収益ポテンシャルの試算です。実際の収入、雇用可能性、金融商品の価値、人格的価値を示すものではありません。</p>
            </section>

            <section className="closing-message">
              <span className="eyebrow">さいごに</span>
              <h3>人生は、決算書ではありません。</h3>
              <p>企業はお金を稼ぐのが目的。でも人間の目的は、お金ではありません。死ぬ時にいくら資産があってもあの世に持ち込めないのだから。</p>
            </section>

            <button className="revise-button" type="button" onClick={restartValuation}>条件を修正して再計算する</button>
            <button type="button" className="x-share-button x-share-button-bottom" onClick={shareResultImage} disabled={sharingImage}><span>𝕏</span><strong>Xで結果カードをシェア</strong><b>→</b></button>
          </section>
        )}

        <footer>
          <span className="footer-meta">人間時価総額 / v20</span>
          <p className="footer-meta">エンタメ × 金融リテラシー</p>
          <nav className="legal-links" aria-label="法務・問い合わせ">
            <a href="/privacy">プライバシー</a>
            <a href="/terms">利用規約</a>
            <a href="/contact">お問い合わせ</a>
          </nav>
        </footer>
      </div>
    </main>
  );
}
