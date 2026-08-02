"use client";

import { useEffect, useMemo, useState } from "react";

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

function formatYen(score: number): string {
  return `${Math.round(score / 10_000).toLocaleString("ja-JP")}万円`;
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString("ja-JP", { hour12: false });
}

export default function AdminHistoryPage() {
  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("token") ?? "";
  }, []);
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError("URLに token クエリが必要です。");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/admin/history?limit=200&token=${encodeURIComponent(token)}`, {
          headers: { Accept: "application/json" },
        });
        const payload = await response.json() as { rows?: HistoryRow[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "履歴を取得できませんでした。");
        if (!cancelled) setRows(payload.rows ?? []);
      } catch (fetchError) {
        if (!cancelled) setError(fetchError instanceof Error ? fetchError.message : "履歴を取得できませんでした。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <main style={{ padding: "1.25rem", fontFamily: "system-ui, sans-serif", maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.35rem", marginBottom: "0.75rem" }}>査定履歴（管理）</h1>
      <p style={{ color: "#555", marginBottom: "1rem" }}>最新200件。token はURLに付与してください。</p>
      {loading && <p>読み込み中…</p>}
      {error && <p style={{ color: "#b00020" }}>{error}</p>}
      {!loading && !error && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.85rem" }}>
            <thead>
              <tr>
                {["日時", "UID", "スコア", "正答", "年齢", "年収", "学歴", "容姿", "職業", "金融", "不動産", "その他", "再投資"].map((label) => (
                  <th key={label} style={{ borderBottom: "1px solid #ccc", textAlign: "left", padding: "0.4rem" }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={{ padding: "0.35rem", borderBottom: "1px solid #eee" }}>{formatTime(row.created_at)}</td>
                  <td style={{ padding: "0.35rem", borderBottom: "1px solid #eee", fontFamily: "monospace" }}>{row.uid.slice(0, 8)}…</td>
                  <td style={{ padding: "0.35rem", borderBottom: "1px solid #eee" }}>{formatYen(row.score)}</td>
                  <td style={{ padding: "0.35rem", borderBottom: "1px solid #eee" }}>{row.quiz_correct}</td>
                  <td style={{ padding: "0.35rem", borderBottom: "1px solid #eee" }}>{row.age}</td>
                  <td style={{ padding: "0.35rem", borderBottom: "1px solid #eee" }}>{row.annual_income}</td>
                  <td style={{ padding: "0.35rem", borderBottom: "1px solid #eee" }}>{row.education}</td>
                  <td style={{ padding: "0.35rem", borderBottom: "1px solid #eee" }}>{row.appearance}</td>
                  <td style={{ padding: "0.35rem", borderBottom: "1px solid #eee" }}>{row.occupation}</td>
                  <td style={{ padding: "0.35rem", borderBottom: "1px solid #eee" }}>{row.financial_assets}</td>
                  <td style={{ padding: "0.35rem", borderBottom: "1px solid #eee" }}>{row.real_estate_assets}</td>
                  <td style={{ padding: "0.35rem", borderBottom: "1px solid #eee" }}>{row.other_assets}</td>
                  <td style={{ padding: "0.35rem", borderBottom: "1px solid #eee" }}>{row.reinvestment_rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p>履歴はまだありません。</p>}
        </div>
      )}
    </main>
  );
}
