"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { APPEARANCES, EDUCATIONS, OCCUPATIONS, getTier } from "../model";

interface HistoryRow {
  id: string;
  uid: string;
  score: number;
  quiz_correct: number;
  age: number;
  annual_income: number;
  education: string;
  appearance: string;
  occupation: string;
  financial_assets: number;
  real_estate_assets: number;
  other_assets: number;
  reinvestment_rate: number;
  created_at: number;
}

const STORAGE_KEY = "hmc-admin-password";

const educationLabel = Object.fromEntries(EDUCATIONS.map((item) => [item.key, item.label]));
const appearanceLabel = Object.fromEntries(APPEARANCES.map((item) => [item.key, item.label]));
const occupationLabel = Object.fromEntries(OCCUPATIONS.map((item) => [item.key, item.label]));

function formatMan(value: number): string {
  return `${Math.round(value).toLocaleString("ja-JP")}万円`;
}

function formatScore(scoreYen: number): string {
  return formatMan(scoreYen / 10_000);
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function label(map: Record<string, string>, key: string): string {
  return map[key] ?? key;
}

export default function AdminHistoryPage() {
  const [password, setPassword] = useState("");
  const [draftPassword, setDraftPassword] = useState("");
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY) ?? "";
    setPassword(saved);
    setReady(true);
  }, []);

  const load = useCallback(async (token: string) => {
    if (!token) {
      setRows([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/history?limit=200", {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await response.json() as { rows?: HistoryRow[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "履歴を取得できませんでした。");
      setRows(payload.rows ?? []);
    } catch (fetchError) {
      setRows([]);
      setError(fetchError instanceof Error ? fetchError.message : "履歴を取得できませんでした。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready || !password) return;
    void load(password);
  }, [ready, password, load]);

  const showTable = Boolean(password) && !error && !loading;

  const summary = useMemo(() => {
    if (rows.length === 0) return null;
    const scores = rows.map((row) => row.score / 10_000);
    const avg = scores.reduce((sum, value) => sum + value, 0) / scores.length;
    return {
      count: rows.length,
      avg: Math.round(avg),
      max: Math.round(Math.max(...scores)),
      min: Math.round(Math.min(...scores)),
    };
  }, [rows]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next = draftPassword.trim();
    if (!next) {
      setError("パスワードを入力してください。");
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, next);
    setPassword(next);
    setDraftPassword("");
  }

  function onLogout() {
    sessionStorage.removeItem(STORAGE_KEY);
    setPassword("");
    setRows([]);
    setError(null);
  }

  if (!ready) {
    return (
      <main className="admin-shell">
        <p>読み込み中…</p>
        <AdminStyles />
      </main>
    );
  }

  if (!password) {
    return (
      <main className="admin-shell">
        <section className="admin-login">
          <h1>査定履歴</h1>
          <p>管理用パスワードを入力してください。</p>
          <form onSubmit={onSubmit}>
            <label htmlFor="admin-password">パスワード</label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={draftPassword}
              onChange={(event) => setDraftPassword(event.target.value)}
              placeholder="パスワード"
            />
            <button type="submit">入る</button>
          </form>
          {error && <p className="admin-error">{error}</p>}
        </section>
        <AdminStyles />
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <h1>査定履歴</h1>
          <p>最新200件（新しい順）</p>
        </div>
        <div className="admin-actions">
          <button type="button" onClick={() => void load(password)} disabled={loading}>再読み込み</button>
          <button type="button" className="ghost" onClick={onLogout}>ログアウト</button>
        </div>
      </header>

      {loading && <p>読み込み中…</p>}
      {error && (
        <div className="admin-error-box">
          <p>{error}</p>
          <button type="button" onClick={onLogout}>パスワードを入れ直す</button>
        </div>
      )}

      {summary && showTable && (
        <div className="admin-summary">
          <div><span>件数</span><strong>{summary.count}</strong></div>
          <div><span>平均</span><strong>{formatMan(summary.avg)}</strong></div>
          <div><span>最高</span><strong>{formatMan(summary.max)}</strong></div>
          <div><span>最低</span><strong>{formatMan(summary.min)}</strong></div>
        </div>
      )}

      {showTable && (
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                {["日時", "スコア", "TIER", "正答", "年齢", "年収", "学歴", "容姿", "職業", "金融", "不動産", "その他", "再投資", "UID"].map((heading) => (
                  <th key={heading}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const man = row.score / 10_000;
                const tier = getTier(man);
                return (
                  <tr key={row.id}>
                    <td className="nowrap">{formatTime(row.created_at)}</td>
                    <td className="nowrap score">{formatScore(row.score)}</td>
                    <td><span className={`tier tier-${tier}`}>{tier}</span></td>
                    <td>{row.quiz_correct}/5</td>
                    <td>{row.age}</td>
                    <td className="nowrap">{formatMan(row.annual_income)}</td>
                    <td>{label(educationLabel, row.education)}</td>
                    <td className="nowrap">{label(appearanceLabel, row.appearance)}</td>
                    <td>{label(occupationLabel, row.occupation)}</td>
                    <td className="nowrap">{formatMan(row.financial_assets)}</td>
                    <td className="nowrap">{formatMan(row.real_estate_assets)}</td>
                    <td className="nowrap">{formatMan(row.other_assets)}</td>
                    <td>{Math.round(row.reinvestment_rate * 100)}%</td>
                    <td className="uid" title={row.uid}>{row.uid.slice(0, 10)}…</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <p className="admin-empty">履歴はまだありません。</p>}
        </div>
      )}
      <AdminStyles />
    </main>
  );
}

function AdminStyles() {
  return (
    <style>{`
      .admin-shell {
        min-height: 100vh;
        padding: 1.25rem 1rem 2.5rem;
        max-width: 1280px;
        margin: 0 auto;
        font-family: "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif;
        color: #1a1a1a;
        background: #f6f4ef;
      }
      .admin-login {
        max-width: 360px;
        margin: 12vh auto 0;
        padding: 1.5rem;
        background: #fff;
        border: 1px solid #e4e0d6;
        border-radius: 12px;
      }
      .admin-login h1, .admin-header h1 {
        margin: 0 0 0.35rem;
        font-size: 1.35rem;
      }
      .admin-login p, .admin-header p {
        margin: 0 0 1rem;
        color: #666;
        font-size: 0.92rem;
      }
      .admin-login label {
        display: block;
        margin-bottom: 0.35rem;
        font-size: 0.85rem;
      }
      .admin-login input {
        width: 100%;
        box-sizing: border-box;
        padding: 0.7rem 0.8rem;
        margin-bottom: 0.85rem;
        border: 1px solid #ccc;
        border-radius: 8px;
        font-size: 1rem;
      }
      .admin-login button, .admin-actions button, .admin-error-box button {
        border: 0;
        border-radius: 8px;
        padding: 0.65rem 1rem;
        background: #1f3a5f;
        color: #fff;
        font-size: 0.95rem;
        cursor: pointer;
      }
      .admin-actions button:disabled {
        opacity: 0.6;
        cursor: wait;
      }
      .admin-actions button.ghost {
        background: #fff;
        color: #1f3a5f;
        border: 1px solid #c9d2de;
      }
      .admin-header {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: flex-start;
        margin-bottom: 1rem;
      }
      .admin-actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .admin-summary {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0.6rem;
        margin-bottom: 1rem;
      }
      .admin-summary div {
        background: #fff;
        border: 1px solid #e4e0d6;
        border-radius: 10px;
        padding: 0.75rem 0.9rem;
      }
      .admin-summary span {
        display: block;
        color: #777;
        font-size: 0.78rem;
        margin-bottom: 0.2rem;
      }
      .admin-summary strong {
        font-size: 1.05rem;
      }
      .admin-table-wrap {
        overflow-x: auto;
        background: #fff;
        border: 1px solid #e4e0d6;
        border-radius: 12px;
      }
      .admin-shell table {
        border-collapse: collapse;
        width: 100%;
        font-size: 0.82rem;
      }
      .admin-shell th, .admin-shell td {
        padding: 0.55rem 0.6rem;
        border-bottom: 1px solid #eee;
        text-align: left;
        vertical-align: top;
      }
      .admin-shell th {
        position: sticky;
        top: 0;
        background: #faf8f3;
        font-weight: 600;
        white-space: nowrap;
      }
      .admin-shell .nowrap { white-space: nowrap; }
      .admin-shell .score { font-weight: 600; }
      .admin-shell .uid { font-family: ui-monospace, monospace; color: #777; }
      .admin-shell .tier {
        display: inline-block;
        min-width: 1.4rem;
        text-align: center;
        padding: 0.1rem 0.35rem;
        border-radius: 999px;
        font-weight: 700;
        font-size: 0.75rem;
      }
      .tier-S { background: #ffe08a; }
      .tier-A { background: #d7ecff; }
      .tier-B { background: #e3f6d8; }
      .tier-C { background: #eee; }
      .tier-D { background: #f3d9d9; }
      .admin-error, .admin-error-box {
        color: #9b1c1c;
      }
      .admin-error-box {
        background: #fff1f1;
        border: 1px solid #f0c7c7;
        border-radius: 10px;
        padding: 0.9rem 1rem;
        margin-bottom: 1rem;
      }
      .admin-empty {
        padding: 1rem;
        color: #666;
      }
      @media (max-width: 720px) {
        .admin-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .admin-header { flex-direction: column; }
      }
    `}</style>
  );
}
