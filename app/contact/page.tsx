import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "お問い合わせ | 人間時価総額 CALCULATOR",
};

const CONTACT_MAIL = "info@humanmarketcap.com";

export default function ContactPage() {
  const mailHref = `mailto:${CONTACT_MAIL}?subject=${encodeURIComponent("【人間時価総額】お問い合わせ")}`;

  return (
    <main className="legal-page">
      <p className="legal-back"><Link href="/">← 査定に戻る</Link></p>
      <h1>お問い合わせ</h1>
      <p className="legal-updated">データ削除・内容の訂正・不具合の報告など</p>

      <section>
        <h2>連絡先</h2>
        <p>
          メール: <a href={mailHref}>{CONTACT_MAIL}</a>
        </p>
        <p>
          件名に「データ削除希望」「不具合報告」など内容がわかる文言を入れてください。
          削除依頼の場合は、可能であれば査定時の匿名ID（端末に残っている場合）も記載してください。
        </p>
      </section>

      <section>
        <h2>関連ページ</h2>
        <ul>
          <li><Link href="/privacy">プライバシーポリシー</Link></li>
          <li><Link href="/terms">利用規約・免責</Link></li>
        </ul>
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
        .legal-page a { color: #e0c57a; word-break: break-all; }
      `}</style>
    </main>
  );
}
