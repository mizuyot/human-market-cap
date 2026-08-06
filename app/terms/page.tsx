import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "利用規約・免責 | 人間時価総額 CALCULATOR",
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <p className="legal-back"><Link href="/">← 査定に戻る</Link></p>
      <h1>利用規約・免責事項</h1>
      <p className="legal-updated">最終更新: 2026年8月7日</p>

      <section>
        <h2>1. サービスの性格</h2>
        <p>
          本サービスはエンタメ×金融教育を目的とした試算ツールです。
          表示される「人間時価総額」は簡易モデルによる参考値であり、
          個人の価値・信用・投資判断・採用・査定などを保証するものではありません。
        </p>
      </section>

      <section>
        <h2>2. 禁止事項</h2>
        <ul>
          <li>過度な自動アクセスや、ランキング・履歴を故意に歪める行為</li>
          <li>本サービスの運営を妨害する行為</li>
          <li>法令に違反する利用</li>
        </ul>
      </section>

      <section>
        <h2>3. 免責</h2>
        <p>
          本サービスの利用により生じた損害について、運営者は法令で認められる範囲で責任を負いません。
          表示内容の正確性・完全性・継続提供を保証しません。
        </p>
      </section>

      <section>
        <h2>4. データの扱い</h2>
        <p>
          保存する情報の詳細は
          <Link href="/privacy">プライバシーポリシー</Link>
          をご覧ください。
        </p>
      </section>

      <section>
        <h2>5. お問い合わせ</h2>
        <p>
          ご質問・削除依頼は
          <Link href="/contact">お問い合わせ</Link>
          へどうぞ。
        </p>
      </section>

      <style>{`
        .legal-page {
          max-width: 720px;
          margin: 0 auto;
          padding: 28px 18px 64px;
          color: #e8e4d8;
          background: #0a0a0a;
          min-height: 100vh;
          font-family: "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif;
          line-height: 1.75;
        }
        .legal-back a { color: #d4a843; font-size: 13px; }
        .legal-page h1 { margin: 18px 0 8px; font-size: 1.6rem; color: #f3ead2; }
        .legal-updated { color: #8a8578; font-size: 12px; margin-bottom: 28px; }
        .legal-page h2 { margin: 28px 0 10px; font-size: 1.05rem; color: #d4a843; }
        .legal-page p, .legal-page li { font-size: 14px; color: #c9c3b4; }
        .legal-page ul { padding-left: 1.2rem; }
        .legal-page a { color: #e0c57a; }
      `}</style>
    </main>
  );
}
