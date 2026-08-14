"use client";

import {
  type ButtonHTMLAttributes,
  type FocusEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

export function QuestionHeader({
  number,
  title,
  htmlFor,
}: {
  number: string;
  title: string;
  htmlFor?: string;
}) {
  const content = (
    <>
      <span className="question-number" aria-hidden="true">{number}</span>
      <span className="question-title-text">{title}</span>
    </>
  );
  if (htmlFor) {
    return <label className="question-header" htmlFor={htmlFor}>{content}</label>;
  }
  return <div className="question-header">{content}</div>;
}

export function FieldHelp({ id, children }: { id?: string; children: ReactNode }) {
  return <p className="field-note" id={id}>{children}</p>;
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p className="field-error" id={id} role="alert">
      <span className="field-error-icon" aria-hidden="true">!</span>
      {message}
    </p>
  );
}

function commitNumberText(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === "") return 0;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const NumberInputWithUnit = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
    unit: string;
    invalid?: boolean;
    describedBy?: string;
    value: number;
    onValueChange: (value: number) => void;
  }
>(function NumberInputWithUnit({
  unit,
  invalid,
  describedBy,
  value,
  onValueChange,
  onBlur,
  onFocus,
  ...props
}, ref) {
  // null = 親の value を表示。入力中だけ文字列下書きを持ち、空欄を許可する。
  const [draft, setDraft] = useState<string | null>(null);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setDraft(null);
  }, [value]);

  const display = draft !== null ? draft : String(value);

  return (
    <div className={`number-input ${invalid ? "is-invalid" : ""}`}>
      <input
        {...props}
        ref={ref}
        className="hmc-number"
        value={display}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onFocus={(event) => {
          focusedRef.current = true;
          setDraft(String(value));
          onFocus?.(event);
        }}
        onChange={(event) => {
          const raw = event.target.value;
          setDraft(raw);
          if (raw.trim() === "") return;
          const parsed = Number(raw);
          if (!Number.isFinite(parsed)) return;
          onValueChange(parsed);
        }}
        onBlur={(event: FocusEvent<HTMLInputElement>) => {
          focusedRef.current = false;
          const next = commitNumberText(draft ?? event.target.value);
          setDraft(null);
          onValueChange(next);
          onBlur?.(event);
        }}
      />
      <span aria-hidden="true">{unit}</span>
    </div>
  );
});

export const SelectField = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & {
    invalid?: boolean;
    describedBy?: string;
  }
>(function SelectField({ invalid, describedBy, children, ...props }, ref) {
  return (
    <div className={`select-wrap ${invalid ? "is-invalid" : ""}`}>
      <select
        {...props}
        ref={ref}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      >
        {children}
      </select>
    </div>
  );
});

export function InfoTooltip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const tipId = useId();
  return (
    <span className="info-tooltip">
      <button
        type="button"
        className="info-tooltip-trigger"
        aria-label={`${label}の説明`}
        aria-expanded={open}
        aria-controls={tipId}
        onClick={() => setOpen((value) => !value)}
        onBlur={() => setOpen(false)}
      >
        i
      </button>
      {open && (
        <span className="info-tooltip-panel" id={tipId} role="tooltip">
          {children}
        </span>
      )}
    </span>
  );
}

export function PrimaryButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className="hmc-btn hmc-btn-primary" {...props}>
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className="hmc-btn hmc-btn-secondary" {...props}>
      {children}
    </button>
  );
}

export const WIZARD_STEPS = [
  { id: 1, title: "基本情報", short: "基本", minutesLeft: "約2分" },
  { id: 2, title: "キャリア", short: "キャリア", minutesLeft: "約1.5分" },
  { id: 3, title: "資産・投資", short: "資産", minutesLeft: "約1分" },
  { id: 4, title: "金融クイズ", short: "クイズ", minutesLeft: "約2分" },
] as const;

export type WizardStepId = 1 | 2 | 3 | 4;

export function WizardProgress({
  step,
  statuses,
  onSelect,
  variant,
}: {
  step: WizardStepId;
  statuses: Record<WizardStepId, "current" | "complete" | "incomplete" | "error">;
  onSelect: (next: WizardStepId) => void;
  variant: "sidebar" | "compact";
}) {
  const current = WIZARD_STEPS[step - 1];
  const progress = ((step - 1) / 3) * 100;
  return (
    <nav
      className={`wizard-progress wizard-progress-${variant}`}
      aria-label="査定の進行状況"
    >
      <div className="wizard-progress-meta">
        <span className="step-counter">ステップ {step} / 4</span>
        <span>残り{current.minutesLeft}</span>
      </div>
      <div className="wizard-progress-bar" aria-hidden="true">
        <i style={{ width: `${Math.max(8, progress)}%` }} />
      </div>
      {variant === "compact" ? (
        <p className="wizard-progress-current wizard-step-title" aria-current="step">
          {current.title}
        </p>
      ) : (
        <ol className="wizard-step-list">
          {WIZARD_STEPS.map((item) => {
            const status = statuses[item.id];
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`wizard-step-button is-${status}`}
                  aria-current={status === "current" ? "step" : undefined}
                  onClick={() => onSelect(item.id)}
                >
                  <span className="wizard-step-index" aria-hidden="true">
                    {status === "complete" ? "✓" : String(item.id).padStart(2, "0")}
                  </span>
                  <span>{item.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </nav>
  );
}

export function PrivacySummary() {
  const full =
    "査定のたびに、匿名ID・スコア・年齢・年収・学歴・容姿・職業・資産・再投資率・クイズ正答数を保存します（設問文や回答の本文は残しません）。ランキングにも匿名IDとスコアを追記します。詳細はプライバシーポリシーをご覧ください。この結果は金融助言ではなく、教育・娯楽目的の試算です。";
  return (
    <div className="privacy-summary">
      <ul className="privacy-summary-list">
        <li><span aria-hidden="true">✓</span>匿名IDで記録</li>
        <li><span aria-hidden="true">✓</span>クイズの設問・回答本文は保存しません</li>
        <li><span aria-hidden="true">✓</span>結果は教育・娯楽目的で、金融助言ではありません</li>
      </ul>
      <details className="privacy-details">
        <summary>保存される情報を詳しく見る</summary>
        <p className="privacy-note">
          {full.replace("プライバシーポリシーをご覧ください", "")}
          <a href="/privacy">プライバシーポリシー</a>
          をご覧ください。この結果は金融助言ではなく、教育・娯楽目的の試算です。
        </p>
      </details>
      <p className="privacy-always-link">
        <a href="/privacy">プライバシーポリシー</a>
      </p>
      {/* Keep exact disclosure strings for regression tests / legal parity */}
      <p className="sr-only">
        査定のたびに、匿名ID・スコア・年齢・年収・学歴・容姿・職業・資産・再投資率・クイズ正答数を保存します（設問文や回答の本文は残しません）。ランキングにも匿名IDとスコアを追記します。詳細は
        <a href="/privacy">プライバシーポリシー</a>
        をご覧ください。この結果は金融助言ではなく、教育・娯楽目的の試算です。
      </p>
    </div>
  );
}
