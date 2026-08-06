"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
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

interface AdminStats {
  historyCount: number;
  rankingCount: number;
  dummyRankingCount: number;
  dummyHistoryCount: number;
  score: {
    avgMan: number;
    medianMan: number;
    minMan: number;
    maxMan: number;
  };
  tierCounts: Record<"S" | "A" | "B" | "C" | "D", number>;
  quizDistribution: Array<{ correct: number; count: number }>;
  funnel?: {
    windowDays: number;
    pageViews: number;
    challengeVisits: number;
    quizStarts: number;
    valuations: number;
    shareClicks: number;
    shareSuccesses: number;
    apiErrors: number;
    uniqueVisitors: number;
    quizStartRate: number | null;
    valuationRate: number | null;
    shareClickRate: number | null;
    challengeConversionRate: number | null;
  };
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

function authHeaders(token: string): HeadersInit {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export default function AdminHistoryPage() {
  const [password, setPassword] = useState("");
  const [draftPassword, setDraftPassword] = useState("");
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY) ?? "";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore admin session from sessionStorage
    setPassword(saved);
    setReady(true);
  }, []);

  const load = useCallback(async (token: string) => {
    if (!token) {
      setRows([]);
      setStats(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [historyResponse, statsResponse] = await Promise.all([
        fetch("/api/admin/history?limit=200", { headers: authHeaders(token) }),
        fetch("/api/admin/stats", { headers: authHeaders(token) }),
      ]);
      const historyPayload = await historyResponse.json() as { rows?: HistoryRow[]; error?: string };
      const statsPayload = await statsResponse.json() as AdminStats & { error?: string };
      if (!historyResponse.ok) throw new Error(historyPayload.error ?? "履歴を取得できませんでした。");
      if (!statsResponse.ok) throw new Error(statsPayload.error ?? "集計を取得できませんでした。");
      setRows(historyPayload.rows ?? []);
      setStats(statsPayload);
    } catch (fetchError) {
      setRows([]);
      setStats(null);
      setError(fetchError instanceof Error ? fetchError.message : "履歴を取得できませんでした。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready || !password) return;
    // Restore session and refresh admin data once after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional session restore
    void load(password);
  }, [ready, password, load]);

  const showTable = Boolean(password) && !error && !loading;
  const dummyCount = Math.max(stats?.dummyRankingCount ?? 0, stats?.dummyHistoryCount ?? 0);
  const tierMax = stats
    ? Math.max(1, ...Object.values(stats.tierCounts))
    : 1;
  const quizMax = stats
    ? Math.max(1, ...stats.quizDistribution.map((item) => item.count))
    : 1;

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
    setStats(null);
    setError(null);
    setNotice(null);
  }

  async function onDeleteDummies() {
    if (!password || !stats || dummyCount === 0) return;
    const ok = window.confirm(
      `ダミーデータを削除しますか？\nランキング ${stats.dummyRankingCount}件 / 履歴 ${stats.dummyHistoryCount}件\nこの操作は取り消せません。`,
    );
    if (!ok) return;
    setDeleting(true);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/delete-dummies", {
        method: "POST",
        headers: authHeaders(password),
      });
      const payload = await response.json() as {
        deletedRanking?: number;
        deletedHistory?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "ダミー削除に失敗しました。");
      setNotice(`ダミーを削除しました（ランキング ${payload.deletedRanking ?? 0}件 / 履歴 ${payload.deletedHistory ?? 0}件）。`);
      await load(password);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "ダミー削除に失敗しました。");
    } finally {
      setDeleting(false);
    }
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
          <h1>査定管理</h1>
          <p>集計と最新200件の履歴</p>
        </div>
        <div className="admin-actions">
          <button type="button" onClick={() => void load(password)} disabled={loading || deleting}>再読み込み</button>
          <button
            type="button"
            className="danger"
            onClick={() => void onDeleteDummies()}
            disabled={loading || deleting || dummyCount === 0}
          >
            {deleting ? "削除中…" : `ダミーを削除${dummyCount > 0 ? `（${dummyCount}）` : ""}`}
          </button>
          <button type="button" className="ghost" onClick={onLogout}>ログアウト</button>
        </div>
      </header>

      {loading && <p>読み込み中…</p>}
      {notice && <p className="admin-notice">{notice}</p>}
      {error && (
        <div className="admin-error-box">
          <p>{error}</p>
          <button type="button" onClick={onLogout}>パスワードを入れ直す</button>
        </div>
      )}

      {stats && showTable && (
        <>
          <div className="admin-summary">
            <div><span>履歴件数</span><strong>{stats.historyCount.toLocaleString("ja-JP")}</strong></div>
            <div><span>ランキング件数</span><strong>{stats.rankingCount.toLocaleString("ja-JP")}</strong></div>
            <div><span>ダミー（履歴）</span><strong>{stats.dummyHistoryCount.toLocaleString("ja-JP")}</strong></div>
            <div><span>平均スコア</span><strong>{formatMan(stats.score.avgMan)}</strong></div>
            <div><span>中央値</span><strong>{formatMan(stats.score.medianMan)}</strong></div>
            <div><span>最高</span><strong>{formatMan(stats.score.maxMan)}</strong></div>
            <div><span>最低</span><strong>{formatMan(stats.score.minMan)}</strong></div>
          </div>

          {stats.funnel && (
            <section className="admin-funnel">
              <h2>利用ファネル（直近{stats.funnel.windowDays}日）</h2>
              <div className="admin-summary">
                <div><span>訪問（ユニーク）</span><strong>{stats.funnel.uniqueVisitors.toLocaleString("ja-JP")}</strong></div>
                <div><span>ページ表示</span><strong>{stats.funnel.pageViews.toLocaleString("ja-JP")}</strong></div>
                <div><span>対戦流入</span><strong>{stats.funnel.challengeVisits.toLocaleString("ja-JP")}</strong></div>
                <div><span>クイズ開始</span><strong>{stats.funnel.quizStarts.toLocaleString("ja-JP")}</strong></div>
                <div><span>査定完了</span><strong>{stats.funnel.valuations.toLocaleString("ja-JP")}</strong></div>
                <div><span>共有クリック</span><strong>{stats.funnel.shareClicks.toLocaleString("ja-JP")}</strong></div>
                <div><span>共有成功</span><strong>{stats.funnel.shareSuccesses.toLocaleString("ja-JP")}</strong></div>
                <div><span>APIエラー</span><strong>{stats.funnel.apiErrors.toLocaleString("ja-JP")}</strong></div>
              </div>
              <div className="admin-summary rates">
                <div><span>訪問→クイズ開始</span><strong>{stats.funnel.quizStartRate == null ? "—" : `${stats.funnel.quizStartRate}%`}</strong></div>
                <div><span>クイズ→査定完了</span><strong>{stats.funnel.valuationRate == null ? "—" : `${stats.funnel.valuationRate}%`}</strong></div>
                <div><span>査定→共有クリック</span><strong>{stats.funnel.shareClickRate == null ? "—" : `${stats.funnel.shareClickRate}%`}</strong></div>
                <div><span>対戦→査定完了</span><strong>{stats.funnel.challengeConversionRate == null ? "—" : `${stats.funnel.challengeConversionRate}%`}</strong></div>
              </div>
            </section>
          )}

          <div className="admin-charts">
            <section className="admin-chart">
              <h2>TIER分布</h2>
              <ul>
                {(["S", "A", "B", "C", "D"] as const).map((tier) => (
                  <li key={tier}>
                    <span className={`tier tier-${tier}`}>{tier}</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${(stats.tierCounts[tier] / tierMax) * 100}%` }} />
                    </div>
                    <strong>{stats.tierCounts[tier]}</strong>
                  </li>
                ))}
              </ul>
            </section>
            <section className="admin-chart">
              <h2>クイズ正答数</h2>
              <ul>
                {stats.quizDistribution.map((item) => (
                  <li key={item.correct}>
                    <span className="quiz-label">{item.correct}/5</span>
                    <div className="bar-track">
                      <div className="bar-fill quiz" style={{ width: `${(item.count / quizMax) * 100}%` }} />
                    </div>
                    <strong>{item.count}</strong>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
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
      .admin-actions button.danger {
        background: #8b2e2e;
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
      .admin-notice {
        background: #eaf6ea;
        border: 1px solid #b9d9b9;
        border-radius: 10px;
        padding: 0.75rem 1rem;
        color: #1f5a2e;
        margin-bottom: 1rem;
      }
      .admin-funnel {
        margin-bottom: 1rem;
      }
      .admin-funnel h2 {
        margin: 0 0 0.6rem;
        font-size: 0.95rem;
      }
      .admin-summary.rates strong {
        color: #1f3a5f;
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
      .admin-charts {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
        margin-bottom: 1rem;
      }
      .admin-chart {
        background: #fff;
        border: 1px solid #e4e0d6;
        border-radius: 12px;
        padding: 0.9rem 1rem;
      }
      .admin-chart h2 {
        margin: 0 0 0.75rem;
        font-size: 0.95rem;
      }
      .admin-chart ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.45rem;
      }
      .admin-chart li {
        display: grid;
        grid-template-columns: 2.4rem 1fr 2.2rem;
        gap: 0.5rem;
        align-items: center;
      }
      .admin-chart .quiz-label {
        font-size: 0.82rem;
        color: #555;
      }
      .bar-track {
        height: 0.55rem;
        background: #efeae0;
        border-radius: 999px;
        overflow: hidden;
      }
      .bar-fill {
        height: 100%;
        background: #1f3a5f;
        border-radius: 999px;
        min-width: 0;
      }
      .bar-fill.quiz {
        background: #3d6b4f;
      }
      .admin-chart strong {
        text-align: right;
        font-size: 0.85rem;
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
      @media (max-width: 900px) {
        .admin-charts { grid-template-columns: 1fr; }
      }
      @media (max-width: 720px) {
        .admin-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .admin-header { flex-direction: column; }
      }
    `}</style>
  );
}
