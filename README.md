# 人間時価総額 CALCULATOR

属性・資産・金融リテラシーから、人間時価総額をDCF風に算出するモバイル向けWebアプリです。

公開URL: https://human-market-cap.mizuyot.workers.dev/ （Cloudflare Workers。Sitesではありません）  
ソース: https://github.com/mizuyot/human-market-cap

## 現在の構成（v19）

- 学歴15区分、容姿5段階、9職種・60職業
- 金融リテラシークイズ15セットからランダム5セットを出題
- クイズ正答・採点・時価総額計算はサーバー側で実行
- ブラウザには出題された問題だけを配信し、採点後に解説を返却
- Cloudflare D1へ匿名IDの最新スコアと、査定履歴（入力スナップショット付き）を保存
- ランキングは査定のたびに新しい行を追加（同じ端末でも追記）。上位1000件を維持
- 年収・資産チャート、前回差分、対戦URL、X共有用の結果カード
- 条件の組み合わせで発動する隠し称号8種と専用アバター
- APIの入力値検証、同一オリジン確認、短時間レート制限

## データの扱い

ランキング用テーブルには、査定のたびに端末生成の匿名ID・スコア・更新日時を追記します（同じ端末でも毎回新しい行）。  
別の履歴テーブルへ、入力条件（年齢・年収・学歴・容姿・職業・資産・再投資率）とスコア・クイズ正答数も追記します。クイズの設問文と回答本文は保存しません。ランキングは上位1000件、履歴は全体2万件を上限に古い行から間引きます。クイズ試行情報は短時間で失効します。



## 本番デプロイ（Cloudflare Workers）

```bash
npm install
npm run db:migrate:remote   # リモートD1へマイグレーション
npm run deploy              # build + wrangler deploy
```

管理画面（査定履歴）: https://human-market-cap.mizuyot.workers.dev/admin  
パスワードは Wrangler シークレット `ADMIN_TOKEN`（ローカル控えは `.admin-token.local`）。URLにトークンは付けません。

## ローカル開発

Node.js 22.13以上が必要です。

```bash
npm install
npm run dev
npm run build
npm test
```

DBスキーマを変更したときだけ、`npm run db:generate`でDrizzleマイグレーションを生成します。

永続データは `.openai/hosting.json` の論理バインディング `DB` を通じてD1へ保存されます。本番用のデータベース識別子や管理鍵をブラウザへ配置する必要はありません。

## Cursorへの引き継ぎ

プロジェクト直下の [`CURSOR_HANDOFF.md`](./CURSOR_HANDOFF.md) を最初に読んでください。設定Excelとクイズ原文は `docs/handoff/` にまとめてあります。
