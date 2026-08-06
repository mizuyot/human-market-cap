import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "プライバシーポリシー | 人間時価総額 CALCULATOR",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <p className="legal-back"><Link href="/">← 査定に戻る</Link></p>
      <h1>プライバシーポリシー</h1>
      <p className="legal-updated">最終更新: 2026年8月7日</p>

      <section>
        <h2>1. 運営について</h2>
        <p>
          「人間時価総額 CALCULATOR」（以下「本サービス」）は、教育・娯楽目的の試算ツールです。
          金融商品の勧誘や投資助言を行うものではありません。
        </p>
      </section>

      <section>
        <h2>2. 収集する情報</h2>
        <p>査定を完了すると、次の情報をサーバー上のデータベースへ保存します。</p>
        <ul>
          <li>端末で生成した匿名ID</li>
          <li>査定スコア（時価総額）</li>
          <li>年齢、年収、学歴、容姿区分、職業</li>
          <li>金融資産・不動産・その他資産、再投資率</li>
          <li>クイズの正答数（0〜5）</li>
          <li>査定日時</li>
        </ul>
        <p>
          氏名・メールアドレス・電話番号などの連絡先は求めません。
          クイズの設問文や回答の本文は、履歴テーブルには保存しません
          （採点のために短時間だけ一時保存される場合があります）。
        </p>
        <p>
          また、画面の表示・クイズ開始・査定完了・共有操作などの利用イベントを、
          匿名のセッションIDとともに記録する場合があります（氏名などの連絡先は含みません）。
        </p>
      </section>

      <section>
        <h2>3. 利用目的</h2>
        <ul>
          <li>ランキング・偏差値・分布の表示</li>
          <li>サービス改善のための集計（個人を特定しない形）</li>
          <li>訪問〜クイズ〜査定〜共有などの利用状況の把握</li>
          <li>不正利用や過度なアクセスの防止</li>
        </ul>
      </section>

      <section>
        <h2>4. 保管期間</h2>
        <p>
          ランキングはおおむね上位1,000件を維持し、古い・低いスコアから間引きます。
          査定履歴は件数上限（現在は最大約2万件）に達すると古いものから削除します。
          期間だけの保管期限は設けていません。
        </p>
      </section>

      <section>
        <h2>5. 第三者提供</h2>
        <p>
          法令に基づく場合を除き、収集した査定データを販売・譲渡することはありません。
          ホスティング（Cloudflare）などインフラ事業者へは、サービス提供に必要な範囲で処理が委託されます。
        </p>
      </section>

      <section>
        <h2>6. 削除のご依頼</h2>
        <p>
          匿名IDがわかる場合、該当データの削除を依頼できます。
          <Link href="/contact">お問い合わせ</Link>
          から「データ削除希望」と匿名ID（わかる範囲）をご連絡ください。
        </p>
      </section>

      <section>
        <h2>7. 改定</h2>
        <p>本ポリシーは必要に応じて改定します。重要な変更がある場合は、本ページの更新日を改めます。</p>
      </section>

      <LegalStyles />
    </main>
  );
}

function LegalStyles() {
  return (
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
  );
}
