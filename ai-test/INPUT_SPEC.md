# 人間時価総額 CALCULATOR — 入力仕様書

抽出元: `app/model.ts`, `app/quiz-data.ts`, `app/calculation-policy.ts`, `app/server/calculation.ts`, `app/HumanMarketCapApp.tsx`, `app/api/valuation/route.ts`  
モデル表示: **DCF MODEL / v19**  
用途: AIコメントのバケット設計用（読み取り抽出。コード変更なし）

---

## ウィザード構成

| STEP | タイトル | 短縮 | 目安時間 | 設問番号 |
|------|----------|------|----------|----------|
| 1 | 基本情報 | 基本 | 約2分 | 01〜03 |
| 2 | キャリア | キャリア | 約1.5分 | 04〜05 |
| 3 | 資産・投資 | 資産 | 約1分 | 06〜08 |
| 4 | 金融クイズ | クイズ | 約2分 | 09 |

初期デフォルト（UI）:

| フィールド | 初期値 |
|------------|--------|
| age | 30 |
| annualIncome | 600 |
| education | `university` |
| appearance | `middle` |
| occupation | `listedGeneral` |
| financialAssets | 300 |
| realEstateAssets | 0 |
| otherAssets | 0 |
| reinvestmentRate | 0.2（20%） |

---

## 1. STEP1〜4 全入力項目

### STEP1 基本情報

#### 01 現在の年齢 — `age`

| 項目 | 内容 |
|------|------|
| 入力形式 | 数値入力 (`type="number"`, `inputMode="numeric"`) |
| 単位 | 歳 |
| 最小 | **18** |
| 最大 | **80** |
| 刻み | 整数（`step`未指定。APIは整数必須） |
| 用途 | 残余就労期間 = `max(0, 職業.retirement − age)` |

#### 02 現在の年収 — `annualIncome`

| 項目 | 内容 |
|------|------|
| 入力形式 | 数値入力 (`type="number"`, `inputMode="decimal"`) |
| 単位 | 万円（額面） |
| 最小 | **0** |
| 最大 | UI無制限 / API **100,000** |
| 刻み | 未指定 |
| 用途 | 賃金カーブ投影の起点年収 |

#### 03 最終学歴 — `education`（選択式）

| value (`key`) | 表示ラベル | キャリア補正 `multiplier` | ネットワーク指数 `nw` |
|---------------|------------|---------------------------|------------------------|
| `top100` | 海外有名大学（Top100圏） | 1.060 | 95 |
| `tokyoKyotoDoctor` | 東京大学・京都大学 博士 | 1.055 | 93 |
| `tokyoKyotoMaster` | 東京大学・京都大学 修士 | 1.050 | 90 |
| `tokyoKyotoBachelor` | 東京大学・京都大学 学部 | 1.045 | 88 |
| `eliteDoctor` | 一橋・東京科学・その他旧帝大 博士 | 1.040 | 85 |
| `eliteMaster` | 一橋・東京科学・その他旧帝大 修士 | 1.035 | 82 |
| `eliteBachelor` | 一橋・東京科学・その他旧帝大 学部 | 1.030 | 80 |
| `sokeiGraduate` | 早稲田・慶應 大学院 | 1.025 | 77 |
| `sokeiBachelor` | 早稲田・慶應 学部 | 1.020 | 74 |
| `upperUniversity` | 上位国公立・上智・東京理科 | 1.015 | 68 |
| `march` | MARCH・関関同立 | 1.010 | 61 |
| `university` | 大学卒（その他） | 1.000 | 50 |
| `vocational` | 専門学校・短大卒 | 0.995 | 42 |
| `highSchool` | 高卒 | 0.990 | 35 |
| `middleSchool` | 中卒 | 0.980 | 25 |

---

### STEP2 キャリア

#### 04 容姿（自己評価） — `appearance`（ラジオ）

| value (`key`) | 表示ラベル | 給与補正 `salaryBase` | 利回り補正 `returnAdjustment` |
|---------------|------------|----------------------|-------------------------------|
| `top10` | 上位10% | +0.006 | −0.010 |
| `top35` | 上位35% | +0.003 | −0.005 |
| `middle` | 中間 | 0 | 0 |
| `lower35` | 下位35% | −0.002 | +0.003 |
| `lower10` | 下位10% | −0.004 | +0.005 |

実効の給与側: `salaryBase × 職業.appearanceMultiplier`  
実効の利回り側: `returnAdjustment`（職業倍率なし）

#### 05 現在の職業 — 二段選択

1. **職種カテゴリ** `occupation-category`（UIのみ。送信は職業キー）
2. **職業** `occupation`

##### カテゴリ一覧

| value | 表示ラベル |
|-------|------------|
| `finance` | 金融・コンサル |
| `professional` | 医療・士業 |
| `knowledge` | IT・研究・クリエイティブ |
| `employee` | 会社員・公共・サービス |
| `independent` | 経営・独立 |
| `entertainment` | 芸能・スポーツ |
| `nightlife` | 夜職 |
| `gambling` | ギャンブルプロ |
| `lifestyle` | 生活・無業 |

カテゴリ変更時、そのカテゴリ先頭の職業が自動選択される。

##### 職業マスタの構造（全60件）

各職業レコードのフィールド:

| フィールド | 意味 |
|------------|------|
| `key` | 送信値 |
| `category` | カテゴリキー |
| `label` | 表示名 |
| `retirement` | 就労終了年齢（投影終了） |
| `primaryEnd` | 主職終了年齢（以降は転職後所得モデル） |
| `peak` | 賃金ピーク年齢 |
| `baseReturn` | 職業別基本利回り |
| `appearanceMultiplier` | 容姿→給与への倍率 |
| `careerRisk` | キャリア変動リスク（年） |
| `transitionIncomeRate` | 転職後所得率（基準） |
| `riskLabel` | リスク表示（VERY LOW〜EXTREME） |
| `rampUp[4]` / `rampDown[2]` | 賃金カーブ（`wageCurveKey`から展開） |
| `specialGrowthYears` / `specialGrowthRate` | 任意の期間限定成長 |
| `specialNote` | 任意の注記 |
| （別表）`OCCUPATION_BASE_INCOME[key]` | 職業別基準年収（万円） |

##### 職業全件（value / 表示ラベル）

**finance（5）**

| value | 表示ラベル |
|-------|------------|
| `fund` | ヘッジファンド・PE |
| `investmentBank` | 投資銀行・マーケット・トレーダー |
| `bankFinance` | 銀行・証券・保険 |
| `consultant` | 戦略・総合・ITコンサルタント |
| `fullTimeTrader` | 専業トレーダー・仮想通貨 |

**professional（6）**

| value | 表示ラベル |
|-------|------------|
| `doctor` | 医師 |
| `dentist` | 歯科医師 |
| `lawyer` | 弁護士 |
| `accountant` | 会計士・税理士 |
| `nurse` | 看護師 |
| `medicalSpecialist` | 薬剤師・医療専門職 |

**knowledge（7）**

| value | 表示ラベル |
|-------|------------|
| `software` | ITエンジニア |
| `aiEngineer` | AIエンジニア |
| `foreignTech` | 外資IT（GAFA系・RSU込み） |
| `productData` | プロダクト・データ・IT専門職 |
| `researcher` | 研究者・大学教員 |
| `creative` | デザイナー・編集・ライター |
| `mangaArtist` | 漫画家・イラストレーター |

**employee（13）**

| value | 表示ラベル |
|-------|------------|
| `listedManager` | 上場企業 管理職・高度専門職 |
| `listedGeneral` | 上場企業 一般社員 |
| `sme` | 中小企業 事務・営業職 |
| `nonRegular` | 非正規雇用 |
| `skilled` | 製造・建設・物流・技能職 |
| `service` | 小売・飲食・宿泊・介護サービス |
| `public` | 公務員 |
| `teacher` | 教師 |
| `childcare` | 保育士 |
| `bureaucrat` | 官僚（キャリア） |
| `pilot` | パイロット |
| `cabinCrew` | 客室乗務員（CA） |
| `beautician` | 美容師 |

**independent（8）**

| value | 表示ラベル |
|-------|------------|
| `founder` | スタートアップ起業家 |
| `angelInvestor` | エンジェル投資家・連続起業家 |
| `businessOwner` | 安定事業の経営者・自営業 |
| `freelancer` | 高スキルフリーランス |
| `reseller` | 転売ヤー・せどり |
| `farmerFisher` | 農家・漁師 |
| `monk` | 僧侶・宗教家 |
| `politician` | 政治家 |

**entertainment（10）**

| value | 表示ラベル |
|-------|------------|
| `entertainment` | 俳優・タレント・音楽家 |
| `influencer` | YouTuber・配信者・VTuber |
| `athlete` | プロスポーツ選手 |
| `proGamer` | プロゲーマー・eスポーツ |
| `comedian` | お笑い芸人 |
| `voiceActor` | 声優 |
| `boatCycleRacer` | 競艇・競輪選手 |
| `boardGamePro` | プロ棋士・プロ雀士 |
| `sumo` | 力士 |
| `traditionalActor` | 歌舞伎役者・伝統芸能 |

**nightlife（5）**

| value | 表示ラベル |
|-------|------------|
| `host` | ホスト |
| `hostess` | ラウンジ嬢・ホステス・キャバクラ |
| `sexWorker` | 風俗 |
| `nightlifeFreelance` | 港区フリーランス |
| `clubOwner` | クラブママ・夜職経営 |

**gambling（4）**

| value | 表示ラベル |
|-------|------------|
| `pokerLive` | ポーカー専業（ライブ） |
| `pokerOnline` | ポーカー専業（オンライン） |
| `slotProfessional` | スロット専業 |
| `professionalGambler` | プロギャンブラー（競馬・スポーツベット等） |

**lifestyle（2）**

| value | 表示ラベル |
|-------|------------|
| `homemaker` | 専業主婦・主夫 |
| `unemployed` | 無職・ニート |

**合計: 60職業**

##### 職業マスタ代表例（3件）

| | A 安定会社員 | B 高成長テック | C 極端夜職 |
|--|--------------|----------------|-----------|
| value | `listedGeneral` | `aiEngineer` | `host` |
| 表示 | 上場企業 一般社員 | AIエンジニア | ホスト |
| retirement | 65 | 67 | 65 |
| primaryEnd | 65 | 65 | 45 |
| peak | 55 | 45 | 30 |
| baseReturn | 0.028 | 0.042 | 0.018 |
| appearanceMultiplier | 0.5 | 0.3 | 8.0 |
| careerRisk | 0.008 | 0.018 | 0.080 |
| transitionIncomeRate | 0.75 | 0.75 | 0.45 |
| riskLabel | LOW | MID | EXTREME |
| 賃金カーブ | `stable` | `ai` | `nightlife` |
| 基準年収 | 400 | 600 | 300 |
| 特殊 | — | 5年×年率+0.30 | — |

賃金カーブキー一覧: `hedgeFund`, `financeElite`, `financeStable`, `professional`, `tech`, `ai`, `foreignTech`, `stable`, `service`, `public`, `independent`, `founder`, `lottery`, `entertainment`, `influencer`, `athlete`, `nightlife`, `gambling`, `flat`  
各キーは `rampUp` 4区間 + `rampDown` 2区間の成長率配列。

---

### STEP3 資産・投資

#### 06 現金・金融資産 — `financialAssets`

| 項目 | 内容 |
|------|------|
| 入力形式 | 数値入力 |
| 単位 | 万円 |
| 最小 | **0** |
| 最大 | API **1,000,000** |
| 刻み | 未指定 |

#### 07 不動産・その他資産

| フィールド | 表示 | 形式 | 最小 | 最大(API) |
|------------|------|------|------|-----------|
| `realEstateAssets` | 不動産資産 | 数値 | 0 | 1,000,000 |
| `otherAssets` | その他資産（債券・金・時計など） | 数値 | 0 | 1,000,000 |

初期資産 = `financialAssets + realEstateAssets + otherAssets`（負は0扱い）

#### 08 給与からの再投資率 — `reinvestmentRate`

| 項目 | 内容 |
|------|------|
| 入力形式 | スライダー (`type="range"`) |
| UI表示 | **0〜80**（%） |
| 内部値 | **0.0〜0.8**（小数） |
| 刻み | UI未指定（ブラウザ既定・通常1ポイント） |
| 目盛 | 0% / 40% / 80% |
| 推奨表示 | 「推奨 20%以上」 |
| 用途 | 毎年の給与×率を資産残高へ加算 |

---

### STEP4 金融クイズ

| 項目 | 内容 |
|------|------|
| 設問プール | **15セット**（`q01`〜`q15`） |
| 出題数 | 毎回ランダム **5セット**（Fisher–Yates） |
| セット構造 | 各セット **A問 → B問**（A回答後ロック） |
| 制限時間 | **各問20秒**（タイムアウトは `null` = 無得点） |
| 採点単位 | セット単位。A・Bとも正解条件を満たして **1点** |
| 満点 | **5点** |
| 利回り補正 | `((正答数/5) − 0.5) × 0.1` → **−5%〜+5%** |
| 送信条件 | クイズ完了まで査定送信不可 |

#### 採点ルール種別

| `rule.kind` | 正解条件 |
|-------------|---------|
| `pair` | Aの選択index = `answers[0]` かつ B = `answers[1]` |
| `same` | Aのindex === Bのindex |
| `different` | Aのindex !== Bのindex |

選択肢は **0始まりのindex** で送信（ラベル文字列ではない）。

#### クイズ全15セット（value=選択肢index）

| id | タイトル | ルール | 正解パターン |
|----|----------|--------|--------------|
| `q01` | 保険を使うべき損失 | pair `[1,0]` | ②→① |
| `q02` | 確実な15%リターン | pair `[0,1]` | ①→② |
| `q03` | ＋50%と−50% | pair `[3,3]` | ④→④ |
| `q04` | 映画代は取り戻せるか | pair `[1,1]` | ②→② |
| `q05` | 1,000円の重さ | same | AとB同じ |
| `q06` | 複利は金額より時間に効く | pair `[2,0]` | ③→① |
| `q07` | 1回の賭けと100回の賭け | pair `[3,1]` | ④→② |
| `q08` | 1週間の価値 | same | AとB同じ |
| `q09` | 10%オフの自社株 | pair `[1,0]` | ②→① |
| `q10` | ATM手数料というマイナス金利 | pair `[2,0]` | ③→① |
| `q11` | 利益では慎重、損失ではギャンブラー | same | AとB同じ |
| `q12` | あぶく銭の10万円 | same | AとB同じ |
| `q13` | 当たったワインは5万円以上か | different | ①→② or ②→① |
| `q14` | 給料は上がったのに貧しくなる | pair `[1,0]` | ②→① |
| `q15` | 相続したものをそのまま持つか | different | ①→② or ②→① |

各セットの選択肢ラベル（抜粋・詳細は `app/quiz-data.ts`）:

- `q01` A/B: `入る` / `入らない`
- `q02` A: `リボ払いを完済する` / `投資に入れる`　B: `奨学金を完済する` / `分散投資に入れる`
- `q03` A/B: `125万円` / `100万円` / `95万円` / `75万円`
- `q04` A: `最後まで観る` / `席を立つ`　B: `変わる` / `変わらない`
- `q05` A/B: `移動する` / `移動しない`
- `q06` A: `毎月1万円を40年間…` / `毎月2万円を20年間…` / `同じ`　B: 類似3択
- `q07` A/B: `0%` / `20%` / `50%` / `100%`
- `q08` A: `今日1万円` / `1週間後に1万1,000円`　B: `1年後に1万円` / `1年と1週間後に1万1,000円`
- `q09` A: `社員割引で10%安く買えるA社株` / `世界株インデックス`　B: `A社株` / `世界株インデックス`
- `q10` A/B: `−0.1%` / `−1%` / `−10%` / `−30%`
- `q11` A: `確実に100万円を受け取る` / `コイントス…`　B: 借金版2択
- `q12` A/B: `勝負する` / `勝負しない`
- `q13` A: `5万円で譲る` / `譲らずに自分で持つ`　B: `5万円で買う` / `買わない`
- `q14` A/B: `上がる` / `下がる`
- `q15` A: `買う` / `買わない、または分散する`　B: `売る` / `売らずに持ち続ける`

---

## 2. 計算ロジックが参照する変数

### 入力 → 係数 対応表

| 入力 | 係数・変数 | 影響の仕方 |
|------|------------|------------|
| `education.multiplier` | **キャリア補正** | 給与所得合計に乗算: `salaryIncomeMan = salaryTotal × multiplier` |
| `education.nw` | **ネットワーク指数** | 年収補正・転職補正の源泉 |
| ↑ NW | **年収補正** `nwSalaryAdjustment` | `clip((nw−50)×0.0001, −0.0025…0.0045)` を毎年の給与成長に加算 |
| ↑ NW | **転職補正** `nwTransitionAdjustment` | `clip((nw−50)×0.001, −0.025…0.045)` を職業の `transitionIncomeRate` に加算 |
| `appearance.salaryBase` × `job.appearanceMultiplier` | **容姿→給与** | 毎年の給与成長に加算 |
| `appearance.returnAdjustment` | **容姿→利回り** | 実効利回りに加算 |
| `occupation.*` | 就労終了・主職終了・ピーク・賃金カーブ・キャリアリスク・転職率・基本利回り | 年次投影ループ全体 |
| `correctAnswers` (0〜5) | **金融リテラシー補正** | `((score/5)−0.5)×0.1` → 実効利回りに加算（−5%〜+5%） |
| `job.baseReturn` + リテラシー + 容姿利回り | **実効利回り** `effectiveReturn` | 毎年の資産残高に乗算して運用益を計上 |
| 資産3項目の合計 | **初期資産** | 残高の初期値。時価総額にも元本加算（現行フラグON） |
| `reinvestmentRate` | **再投資率** | 毎年 `salary × rate` を残高へ加算 |
| `age` + `job.retirement` | **残余就労年数** | 投影ループ回数 |

### 年次ループの要点

1. **キャリア生存率** `careerSurvival`: 主職終了前は `(1−careerRisk)^year`、主職終了後は0  
2. **給与ミックス**: `主職年収×survival + 転職後年収×(1−survival)`  
3. **転職後年収**: `max(年収×転職率, 年齢別共通基準)`（無職など基準年収0は除外）  
4. **年齢別共通転職後年収（万円）**: 〜29→300 / 〜39→350 / 〜49→380 / 〜59→340 / 〜69→250 / それ以降→180  
5. **インフレ** `INFLATION_RATE = 0.02`（給与成長・転職後成長）  
6. **所得フロア**: 現在が基準の25%未満なら即回復、未満なら差額の35%を毎年キャッチアップ  
7. **時価総額**: `給与所得（キャリア補正後） + 資産所得（運用益累計） + 初期資産元本`

### 時価総額の単位

- 内部: **万円**（`marketCapMan` 等）  
- APIの `scoreYen`: `round(marketCapMan × 10000)`（円）

---

## 3. 結果画面に表示される数値・要素

時価総額以外も含む一覧:

### ヒーロー／見出し

| 要素 | 内容 |
|------|------|
| ティアー | S / A / B / C / D（時価総額しきい値: ≥5万 / ≥2万 / ≥8千 / ≥2千 万円、単位は万円） |
| リスクバッジ | 職業 `riskLabel` + 「RISK」 |
| **時価総額** | メイン数値（万円表示） |
| マーケットシグナル | 例: ストップ高 / 上場廃止勧告… / TOPIXに負けています / アウトパフォーム |
| クイズバッジ | 5点「賢者・利回りMAX」 / 0点「カモ」 / 他「金融判断 N/5」 |
| 隠し称号 | 条件付きタイトル（学歴×職業などの組み合わせ） |
| 内訳トレース | 給与所得 + 資産所得 + 初期資産、残余年数 |
| 職業 specialNote | あれば表示 |

### チャレンジ／差分

- URLクエリ `?challenge=` との勝敗・差額  
- 前回スコア（localStorage）との差分

### シェアカード

スコア、ティアー、偏差値、職業名、クイズ行、称号、シグナル、チャレンジURL

### ランキング（MARKET POSITION）

全体順位、偏差値、上位%、掲示板順位、ヒストグラム

### KPIカード

1. **給与所得総額** `salaryIncomeMan`  
2. **資産所得総額** `assetIncomeMan`（実効利回り・再投資率の注記付き）

### チャート（LIFETIME PROJECTION）

- 年収推移（年齢×給与）  
- 資産推移スタック（初期 / 再投資 / 運用益。損失時はLOSS表示）

### 適用前提リスト（assumptions）

残余就労年数、主職終了年齢、キャリア補正、NW、年収補正/年、転職補正、転職後所得率、転職後初期基準年収、職業別基準年収、容姿→給与/利回り、職業別基本利回り、期間限定成長ブースト（任意）、金融リテラシー点数+補正、**実効利回り**、キャリア変動リスク  
モデル注記: INCOME FLOOR / CAREER CHANGE / SIMPLIFIED DCF / ASSET MODEL

### バリュエーション要因バー

金融リテラシー、実効利回り、NW、容姿補正、キャリア持続性、残余就労年数

### クイズレビュー

セットごとのタイトル、1/0点、A/B回答（または時間切れ）、正解パターン、解説文

### アナリストノート

ティアー文言（S超優良人材〜D再建プラン推奨）、動的ノート、RISK NOTICE、締め文言、再査定・シェアボタン

---

## 参照ファイル索引

| 内容 | パス |
|------|------|
| 学歴・容姿・職業・カーブ・フロア | `app/model.ts` |
| 計算ポリシー定数 | `app/calculation-policy.ts` |
| 投影エンジン | `app/server/calculation.ts` |
| クイズ題庫・採点 | `app/quiz-data.ts` |
| クイズ抽選・レビュー | `app/server/quiz.ts` |
| フォームUI・結果UI | `app/HumanMarketCapApp.tsx` |
| ウィザード枠 | `app/hmc/ui.tsx` |
| APIバリデーション | `app/api/valuation/route.ts` |
