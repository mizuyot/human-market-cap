# Cursor引き継ぎ書 — 人間時価総額 CALCULATOR

更新日: 2026-08-02  
現行バージョン: v19  
基準コミット: `321c5ae` (`Add hidden title avatars`)  
公開URL: https://human-market-cap.mizuyot.workers.dev/

## 1. Cursorで開くフォルダ

Cursorの `Open Folder` で、次のフォルダを開く。

```text
/Users/yota/.codex/.chatgpt-projects/g-p-6a5f738b3aac8191a4c017980a4509a0/human-market-cap
```

このフォルダには、アプリ本体、DB定義、マイグレーション、テスト、画像アセット、設定Excel、クイズ原文、この引き継ぎ書が入っている。

Cursorに最初に伝える指示:

> `CURSOR_HANDOFF.md` を最後まで読み、現行仕様と変更禁止事項を守って作業してください。変更前に関連テストとソースを確認し、実装後は `npm test` を実行してください。

引き継ぎ時点で、`.env.example`、`README.md`、`CURSOR_HANDOFF.md`、`docs/handoff/` に未コミットの引き継ぎ資料差分がある。これらは意図的な差分なので、作業開始時に削除・復元しない。

## 2. プロダクトの目的

年齢・年収・学歴・容姿・職業・資産・再投資率・金融リテラシーから、「人間時価総額」をDCF風に算出するエンタメ×金融教育アプリ。企業価値評価の世界観を使うが、人間の価値自体を金額で表すものではない。

結果画面最後の確定メッセージ:

> 企業はお金を稼ぐのが目的。でも人間の目的は、お金ではありません。死ぬ時にいくら資産があってもあの世に持ち込めないのだから。

## 3. 現在の技術構成

### 本番運用メモ（Workers独立デプロイ）

- 環境は3つ: ローカル（`npm run dev`）／ステージング（別Worker + 別D1）／本番
- ステージング: `npm run db:migrate:staging` → `npm run deploy:staging`  
  URL: https://human-market-cap-staging.mizuyot.workers.dev/
- 本番: `npm run db:migrate:remote` → `npm run deploy:production`（`npm run deploy` も本番）  
  URL: https://human-market-cap.mizuyot.workers.dev/
- デプロイ本体: `scripts/deploy.mjs` が build 後に `dist/server/wrangler.json` の Worker名と D1 を環境ごとに差し替え
- 管理UI: `/admin`（パスワード入力。API: `/api/admin/history`・`/api/admin/stats`・`/api/admin/delete-dummies`）
- Wrangler secret `ADMIN_TOKEN` はステージングと本番それぞれに設定する
- 管理APIは `Authorization: Bearer` のみ（URLトークンは不可）。ログイン試行はレート制限あり
- 法務ページ: `/privacy` `/terms` `/contact`
- 同一クイズ試行での再査定は拒否（ランキング水増し防止）。再計算は新しいクイズ開始が必要
- ダミー投入は原則ステージング: `npm run db:seed:staging`（uid は `dummy-jp-%`）
- トークン平文はリポジトリに含めない（`.admin-token.local` / `.dev.vars` は gitignore）
- 監視: Workers Observability（logs）有効。API 500 は `errorId` 付き構造化ログ。外形監視は `/api/health` と `node scripts/check-health.mjs`
- 管理画面は `robots: noindex`。Cloudflare Access で `/admin*` `/api/admin*` を追加保護する手順は README 参照
- 市場ポジションは履歴全体ベース（ダミー除く）。掲示板順位のみ上位約1000件



- Next.js App Router + React 19 + TypeScript
- vinext / ViteでCloudflare Workers向けにビルド
- Cloudflare D1 + Drizzle ORM
- CSSは `app/globals.css`。コンポーネントライブラリなし
- チャートとシェアカードはCanvas/DOMで自前描画
- 本番ホスティングは **Cloudflare Workers（workers.dev）**。`wrangler.toml` で D1 `DB` と Images `IMAGES` をバインド。`.openai/hosting.json` はSites向けメタデータ（独立デプロイでは参照用）
- Supabaseは採用していない。古い仕様書にSupabaseの記述があっても現行実装ではD1が正しい
- MacやNASを公開サーバーとして使わない

## 4. 最初に読むファイル

| 順番 | ファイル | 役割 |
|---:|---|---|
| 1 | `CURSOR_HANDOFF.md` | 現状、確定仕様、禁止事項 |
| 2 | `docs/handoff/human_market_cap_settings_v19.xlsx` | パラメータ、クイズ、隠し称号の比較用台帳 |
| 3 | `app/calculation-policy.ts` | 計算の定数・振る舞いフラグ（後から直しやすい入口） |
| 4 | `app/model.ts` | 学歴、容姿、職業、賃金カーブ、TIER |
| 5 | `app/server/calculation.ts` | 時価総額計算の正式実装 |
| 6 | `app/quiz-data.ts` | クイズ15セットと正答・解説 |
| 7 | `app/HumanMarketCapApp.tsx` | 入力UI、結果UI、隠し称号、シェアカード |
| 8 | `app/api/quiz/start/route.ts` | ランダム出題と試行発行 |
| 9 | `app/api/valuation/route.ts` | 入力検証、採点、計算、ランキング保存 |
| 10 | `db/schema.ts` / `drizzle/` | D1テーブルとマイグレーション |
| 11 | `tests/` | 仕様の回帰防止 |

## 5. 同梱参考資料

- `docs/handoff/human_market_cap_settings_v19.xlsx`
  - 共通設定、学歴、容姿、職業60種、入力仕様、クイズ15セット、隠し称号8種、整合性チェック
  - 黄地・青文字は修正対象、緑地・緑文字は自動計算
  - Excelはレビュー台帳であり、変更してもコードへ自動反映されない
- `docs/handoff/financial_literacy_quiz_final.txt`
  - ユーザー提供のクイズ原文。現行コードの正式データは `app/quiz-data.ts`
- `design-assets/title-avatars-original/`
  - 隠し称号アバターの原画像
- `public/title-avatars/`
  - Web配信用に最適化したJPEG

## 6. 計算モデルの現行仕様

計算の数値・振る舞いフラグの正本（コード側）は `app/calculation-policy.ts`。  
式の本体は `app/server/calculation.ts`。後から直すときは、まず policy のフラグと定数を変える。

### 総額

```text
人間時価総額 = 給与所得総額 + 資産所得総額 + 初期資産元本
```

厳密な割引現在価値計算ではなく、キャリア生存確率を使った簡易期待所得累計モデル。「DCF風」であることを注記する。  
初期資産の元本は時価総額に含める（`includeInitialAssetsInMarketCap`）。資産所得総額は運用益のみで、元本との二重計上を避ける。

### 年収

- 初年度は入力された現在年収をそのまま使う（ただし開始時点ですでに `primaryEnd` 以上なら、初年度から転職後モデル）
- 成長率 = 職業別賃金カーブ + インフ2% + NW給与補正 + 容姿給与補正 + 特別成長率
- ピーク前は `rampUp[4]`、ピーク後は `rampDown[2]`
- 容姿給与補正 = 容姿ベース × 職業別容姿倍率
- キャリア生存率は、`primaryEnd` 未満かつ初年度なら1、以降 `(1-careerRisk)^t`。`primaryEnd` 以上は0
- `primaryEnd`以後は主職生存率0とし、転職後共通収入モデルへ移行
- 転職後収入は `MAX(現年収×職業別転職率, 年齢別共通基準)` から年2%成長
- 基準年収0の職業（無職・ニート）には転職後共通収入を混ぜない
- 給与所得の累計後に学歴乗数を掛ける
- 引退年齢を超えると残余年数0のため、既定では時価総額0（資産のみ延長は `projectAssetsAfterRetirement` で変更可）

### 現在年収が異常に低い場合

- 現在年収が年齢調整後の職業別基準年収の25%未満なら、翌年は基準年収まで回復
- 25%以上だが予測年収が基準未満なら、毎年、基準との差の35%を回復
- 初年度は必ず入力年収のまま。職業に就いている限り翌年以降に収入が発生することを画面で注記する
- 専業主婦・主夫は本人の家事労働を基準年収に換算。配偶者の収入や与信は聞かず、含めない

### NW力

NW力は飾りではなく計算に影響する。学歴ごとに値を持つ。

```text
NW→給与 = CLIP((NW-50)×0.01%, -0.25%, +0.45%)
NW→転職後 = CLIP((NW-50)×0.1%, -2.5%, +4.5%)
```

### 資産所得

- 初期資産 = 現金・金融資産 + 不動産資産 + その他資産（債券・金・時計など）
- 毎年、期待年収×再投資率を資産に追加
- 実効利回り = 職業別基本利回り + 金融リテラシー補正 + 容姿利回り補正
- 実効利回りに上限は設けない。マイナスも許容
- 現行実装では、容姿利回り補正に職業別容姿倍率を掛けない
- 容姿が良いほど資産利回りが低い設計
- 時価総額には、資産所得（運用益）に加えて初期資産の元本も加算する

## 7. 現行パラメータの要点

### 学歴

- 15区分
- 「海外大学」は `海外有名大学（Top100圏）` の1区分だけ
- Top100は東大・京大より強い。現行乗数は1.060、東大・京大博士は1.055
- 学歴は飛び道具にならない程度の乗数に抑え、NW力を介して年収成長と転職後収入にも影響する

### 容姿

- 5段階
- 給与成長への基本補正は `+0.6% / +0.3% / 0% / -0.2% / -0.4%`
- 資産利回りは `-1.0% / -0.5% / 0% / +0.3% / +0.5%`
- 夜職の容姿倍率は極端に大きい。ホスト・ラウンジ嬢等は8.0、風俗は10.0、港区フリーランスは9.0

### 職業

- 9職種、60職業
- 細かな一覧はExcelの「職業」シートが正確で比較しやすい
- ヘッジファンド・PEの賃金カーブは意図的に極端
- AIエンジニアは今後5年の特別成長率30%、全職業で最強
- ポーカー専業はライブとオンラインに分離
- `slotProfessional` の表示名は「スロット専業」
- 「プロギャンブラー」は競馬・スポーツベット等の統合枠
- 夜職にラウンジ嬢・ホステス・キャバクラ、風俗、港区フリーランスを含む
- 専業主婦・主夫と無職・ニートを含む

## 8. 入力項目

1. 年齢（18〜80歳、初期値30）
2. 現在年収（初期値600万円）
3. 最終学歴（15択）
4. 容姿（5択、自己評価）
5. 現在の職業（職種→職業）
6. 現金・金融資産
7. 不動産資産 + その他資産（債券・金・時計など）
8. 給与からの再投資率（0〜80%、初期値20%）
9. 金融リテラシー瞬発クイズ

## 9. 金融リテラシークイズ

- 全15セットからランダム5セット
- 1セットにA/Bがあり、それぞれ20秒
- A回答後にBを表示し、B表示後はAを変更できない
- A/B両方の条件を満たしたときのみ1点。部分点なし
- 解説は結果後に確認できる
- 補正式は `((正答数/5)-0.5)×10%`。0点で-5%、5点で+5%
- 問題と正答はサーバー側が正式ソース。クライアントバンドルに正解と計算エンジンを含めない
- クイズ試行は30分で失効。同一試行の他UIDによる再利用は拒否

## 10. TIERとランキング

| TIER | 時価総額 |
|---|---:|
| S | 5億円以上 |
| A | 2億円以上 |
| B | 8,000万円以上 |
| C | 2,000万円以上 |
| D | 2,000万円未満 |

- UIDは初回アクセス時にブラウザで発行し、`localStorage` へ保存
- ランキングは査定のたびに新行を追加（同じUIDでも追記）。最大1000件、超過時は低スコアから削除
- 査定履歴は `hmc_score_history` へ追記。入力条件・スコア・クイズ正答数を保存（設問文・回答本文は保存しない）
- 履歴は全体2万件を上限に古い行から間引き
- 順位、偏差値、上位%、12ビンのヒストグラムを表示（横軸は対数スケール。外れ値でも分布が潰れにくい）
- やり直しで前回差分を表示
- 職業別、年齢別、学歴別の部門ランキングは不要で、実装しない
- ソース公開: https://github.com/mizuyot/human-market-cap

## 11. 隠し称号

通常称号はない。上から順に判定し、最初に一致した1称号だけ表示する。

| 優先 | 称号 | 条件 |
|---:|---|---|
| 1 | 下剋上 | 中卒 × ヘッジファンド・PE |
| 2 | 高学歴ワーキングプア | 東大・京大 博士 × 非正規雇用 |
| 3 | 宝の持ち腐れ | 容姿上位10% × プロギャンブラー |
| 4 | 無職という名の資本家 | 無職・ニート × 総資産1億円以上 |
| 5 | 2026最有力銘柄候補 | AIエンジニア × 30歳以下 × S TIER |
| 6 | EVだけは億万長者 | ポーカー専業（ライブ/オンライン） × クイズ5点 × 金融資産100万円未満 |
| 7 | 静かなる資本家 | 公務員 × 総資産5,000万円以上 × 再投資率40%以上 |
| 8 | 完全なる市場平均 | 表示上の偏差値が50.0。他称号のフォールバック |

称号条件は `app/HumanMarketCapApp.tsx` の `getHiddenTitle`、アバターは `public/title-avatars/` にある。

## 12. シェア機能

- 1200×630pxのOGP風結果カードをクライアントCanvasで生成
- 時価総額、TIER、偏差値、クイズ結果、隠し称号・アバター、市場メタファーを含む
- `navigator.share` の画像共有に対応するスマホでは、ファイル付き共有
- 未対応環境ではPNGを保存してX投稿画面を開く
- 結果画面の上部と最下部にX共有ボタンを配置
- URLの `challenge` クエリにスコアを入れ、「○○さんに挑戦」導線を表示
- 対戦スコアは署名付きではない。不正対策は重視しない方針

## 13. 結果画面の順序

1. 時価総額 + TIER + リスク + 結果カード + X共有
2. 順位・偏差値・上位% + 分布ヒストグラム + 前回差分
3. 給与所得総額 / 資産所得総額
4. 年収推移 / 資産推移。スマホ1画面で見やすいよう代表年齢だけ表示
5. 試算の前提条件
6. 評価ファクター
7. 分析コメント・クイズ解説・人間の価値に関するメッセージ + 最下部X共有

## 14. 確定済みの「戻さない」仕様

1. 評価軸は時価総額のみ。人生価値・ネットデット・借入金は復活させない
2. 海外大学はTop100のみ。「海外その他」は作らない
3. 海外Top100は東大・京大より強い
4. 実効利回りに上限を設けない
5. 容姿が良いほど資産利回りは低い
6. 夜職には容姿補正を極端に強くかける
7. 専業主婦・主夫で配偶者の収入や与信を聞かない
8. クイズは15セットからランダム5セット。シャッフルボタンを付けない
9. ランキングも履歴も査定のたびに追記（同じ端末・同じUIDでも新しい行）。`hmc_scores` は上位1000件維持。偏差値・分布・全体順位は履歴全体（ダミー除く）で算出
10. 部門別ランキング、年齢別ランキング、学歴別ランキングは実装しない
11. 通常称号は表示しない。8種の隠し称号だけ
12. Supabaseに戻さない。現行のCloudflare D1構成を基準にする
13. スマホを最優先し、グラフは横スクロールなしで一画面に収める
14. 結果画面最後の人間の価値メッセージを残す
15. クイズの設問文・回答本文はDBに残さない（正答数と入力条件の履歴は可）

## 15. 主要な変更箇所

| 変えたいもの | 主に変えるファイル | 一緒に確認するもの |
|---|---|---|
| 計算の定数・振る舞い（回復率、転職後、元本算入など） | `app/calculation-policy.ts` | `tests/income-model.test.mjs` |
| 学歴・容姿・職業・賃金カーブ | `app/model.ts` | `tests/model-curves.test.mjs`, `tests/income-model.test.mjs` |
| 時価総額数式 | `app/server/calculation.ts` | `tests/income-model.test.mjs`, API型 |
| クイズ | `app/quiz-data.ts`, `app/server/quiz.ts` | `tests/client-security.test.mjs` |
| 隠し称号 | `app/HumanMarketCapApp.tsx` の `getHiddenTitle` | アバター2種類のフォルダ、`tests/share-card.test.mjs` |
| 結果カード・X共有 | `app/HumanMarketCapApp.tsx` | `tests/share-card.test.mjs` |
| 入力UI・結果UI | `app/HumanMarketCapApp.tsx`, `app/globals.css` | `tests/mobile-layout.test.mjs`, `tests/rendered-html.test.mjs` |
| ランキング | `app/api/valuation/route.ts`, `db/schema.ts` | `tests/ranking-storage.test.mjs`, Drizzleマイグレーション |
| 査定履歴の蓄積 | `db/schema.ts`, `app/api/valuation/route.ts` | `tests/ranking-storage.test.mjs`, Drizzleマイグレーション |
| 入力検証・レート制限 | `app/api/valuation/route.ts`, `app/server/http.ts` | APIテストとビルド |

## 16. ローカル実行とテスト

Node.js 22.13以上。

```bash
npm install
npm run dev
```

総合確認:

```bash
npm test
```

`npm test` は本番相当ビルド後に `tests/*.test.mjs` を実行する。

補助コマンド:

```bash
npm run build
npm run lint
npm run db:generate   # DBスキーマ変更時だけ
```

## 17. 実装後の確認チェックリスト

- `npm test` が全件成功する
- 375px、390px、430px幅でフォームがはみ出さない
- 入力文字が16px以上で、iPhoneの自動拡大が起きない
- クイズはA→Bの順で、各20秒、結果後に解説を表示する
- クライアントバンドルにクイズ正解と計算エンジンが混入していない
- 極端に低い現在年収が翌年以降の職業別基準年収へ回復する
- スマホで年収・資産グラフが横スクロールなしで見られる
- 結果カードに時価総額、TIER、偏差値、クイズ結果、称号が反映される
- 画像共有未対応端末でPNGダウンロード + X投稿画面が動く
- 同じ匿名UIDでも再査定のたびにランキング行が増え、母数が増える
- 査定のたびに `hmc_score_history` へ入力スナップショットが追記される
- クイズの設問文・回答本文を履歴DBへ保存していない

## 18. 公開・デプロイの注意

- 本番は Cloudflare Workers（workers.dev）で公開する。このMacをサーバーとして外部公開しない
- `wrangler.toml` と Wrangler シークレット（`ADMIN_TOKEN`）が本番の正本。`.openai/hosting.json` はSites向けメタデータ
- D1スキーマ変更はデータ移行を伴う。`db/schema.ts` だけを変えず、Drizzleマイグレーションも作る
- 本番DBの管理鍵やIDをブラウザ側コードや公開環境変数に書かない
- デプロイ前に必ず `npm test` を実行する

## 19. 既知の制約と次の作業候補

- 設定Excelはコードと自動同期しない。パラメータを変更したら、Excel、`app/model.ts` / `app/calculation-policy.ts`、関連テストを揃える
- 計算の後追い修正は `app/calculation-policy.ts` のフラグを優先。引退後も資産投影する、などはフラグで切り替え可能
- シェア画像はクライアント生成。XのWeb Intentは画像を自動添付できないため、Web Share API未対応環境では画像保存が必要
- 対戦URLのスコアは改ざん可能。ただし、ユーザー方針により現状は対策不要
- ランキングはグローバル1種類のみ。部門ランキングは意図的に廃案
- ダミー削除は管理画面から可能だが、本番でも押せる。試すときはステージングを先に使う
- 次に大きな仕様変更をするなら、まずExcelで新旧値を比較し、ユーザー承認後に実装する

## 20. 作業ルール

- ユーザーが「検討だけ」と言った場合は実装しない
- 未決定の数値は推測で固定せず、新旧案と影響を示して承認を取る
- パラメータ変更は、単一値だけでなく職業間の相対比較と年収カーブ全体を確認する
- クイズ本文など不要な個人・回答データは収集・保存しない。査定入力の履歴蓄積は現行仕様
- スマホの見た目と操作性をデスクトップより先に確認する
- 使用者による変更が既にある場合、無関係な差分を元に戻さない
