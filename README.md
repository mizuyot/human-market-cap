# 人間時価総額 CALCULATOR

属性・資産・金融リテラシーから、人間時価総額をDCF風に算出するモバイル向けWebアプリです。

公開URL: https://humanmarketcap.com （予備: https://human-market-cap.mizuyot.workers.dev/）  
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
- セキュリティヘッダー（CSP / frame 拒否 / Permissions-Policy）と同一オリジン配信フォント

## データの扱い

ランキング用テーブルには、査定のたびに端末生成の匿名ID・スコア・更新日時を追記します（同じ端末でも毎回新しい行）。  
別の履歴テーブルへ、入力条件（年齢・年収・学歴・容姿・職業・資産・再投資率）とスコア・クイズ正答数も追記します。クイズの設問文と回答本文は保存しません。ランキングは上位1000件、履歴は全体2万件を上限に古い行から間引きます。クイズ試行情報は短時間で失効します。



## 環境の分け方

| 環境 | 用途 | データ | 出し方 |
|---|---|---|---|
| ローカル | 自分のPCで試す | パソコン内の一時DB | `npm run dev` |
| ステージング | 本番前の試しURL | 本番とは別のD1 | `npm run db:migrate:staging` → `npm run deploy:staging` |
| 本番 | 公開サイト | 本番D1 | `npm run db:migrate:remote` → `npm run deploy:production` |

- 本番: https://humanmarketcap.com / https://human-market-cap.mizuyot.workers.dev/
- ステージング: https://human-market-cap-staging.mizuyot.workers.dev/
- 管理画面: 各環境の `/admin`（集計・履歴・ダミー削除）。先に Cloudflare Access、次に管理パスワード
- パスワードは Wrangler シークレット `ADMIN_TOKEN`（ローカル控えは `.admin-token.local`）。URLにトークンは付けません
- ダミー投入は原則ステージングのみ: `npm run db:seed:staging`（本番へ入れる場合は明示フラグが必要）
- 外形監視: `npm run health:check`（複数URLの `/api/health`）
- D1バックアップ: `npm run db:backup:production`（`backups/` にSQLを保存。git管理外）
- Workers Logs は `wrangler.toml` の observability で有効。ダッシュボードの Notifications でエラー率・CPUアラートを推奨
- Cloudflare Access（管理画面の二重保護）設定手順は下表のあと「管理画面の追加保護」を参照

```bash
npm install
npm run db:migrate:staging
npm run deploy:staging
# 確認後
npm run db:backup:production
npm run db:migrate:remote
npm run deploy:production
```

### 管理画面の追加保護（Cloudflare Access）

パスワードだけでは弱いので、Cloudflare Zero Trust の Access で `/admin*` を保護することを推奨します。

1. [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) → Access → Applications → Add an application → Self-hosted（Public DNS）
2. Domain に `humanmarketcap.com`、Path に `/admin` と `/api/admin` を指定（Worker全体は選ばない）
3. Policy で自分のメールだけ Allow。ログイン方法に One-time PIN を有効化
4. 保存後、管理画面はメール認証のあと、従来どおり管理パスワードでも入る

Workers ダッシュボードの Notifications で、エラー率・CPU時間の閾値アラートも設定できます。

### DBマイグレーション

`scripts/migrate-remote.mjs` は `hmc_schema_migrations` に適用済みファイルを記録します。  
既存DBで履歴が空のときは、現在のマイグレーションファイルを「適用済み」として一度だけブートストラップします（再実行しません）。  
スキーマ変更後はステージングで `db:migrate:staging` → 確認 → 本番前に `db:backup:production` → `db:migrate:remote` の順を推奨します。

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
