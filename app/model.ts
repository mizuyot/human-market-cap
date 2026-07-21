export interface EducationParam {
  key: string; label: string; multiplier: number; salaryAdj: number;
  nw: number; nwSalary: number; nwReturn: number;
}

export interface AppearanceParam {
  key: string; label: string; salaryBase: number; returnBase: number;
}

export interface OccupationParam {
  key: string; label: string; retirement: number; peak: number; baseReturn: number;
  appearanceMultiplier: number; careerRisk: number; riskLabel: string;
  rampUp: [number, number, number, number]; rampDown: [number, number];
}

export const EDUCATIONS = [
  { key: "top100", label: "海外有名大学（Top100圏）", multiplier: 1.50, salaryAdj: .12, nw: 92, nwSalary: .028, nwReturn: .016 },
  { key: "imperialDoctor", label: "旧帝大 博士課程", multiplier: 1.30, salaryAdj: .04, nw: 85, nwSalary: .020, nwReturn: .012 },
  { key: "imperialMaster", label: "旧帝大 修士", multiplier: 1.20, salaryAdj: .03, nw: 80, nwSalary: .016, nwReturn: .010 },
  { key: "sokeiMaster", label: "早慶等 修士", multiplier: 1.15, salaryAdj: .025, nw: 75, nwSalary: .013, nwReturn: .008 },
  { key: "eliteBachelor", label: "旧帝大・早慶 学部", multiplier: 1.10, salaryAdj: .02, nw: 70, nwSalary: .010, nwReturn: .006 },
  { key: "overseasOther", label: "海外その他大学", multiplier: 1.05, salaryAdj: .02, nw: 55, nwSalary: .005, nwReturn: .002 },
  { key: "march", label: "MARCH・上位国公立", multiplier: 1.05, salaryAdj: .01, nw: 60, nwSalary: .006, nwReturn: .003 },
  { key: "university", label: "大学卒（その他）", multiplier: 1.00, salaryAdj: 0, nw: 50, nwSalary: .003, nwReturn: .001 },
  { key: "vocational", label: "専門学校・短大卒", multiplier: .92, salaryAdj: -.01, nw: 35, nwSalary: .001, nwReturn: 0 },
  { key: "highSchool", label: "高卒", multiplier: .85, salaryAdj: -.02, nw: 25, nwSalary: 0, nwReturn: 0 },
  { key: "middleSchool", label: "中卒", multiplier: .75, salaryAdj: -.03, nw: 15, nwSalary: 0, nwReturn: 0 },
] as const satisfies readonly EducationParam[];

export const APPEARANCES = [
  { key: "top10", label: "上位10%", salaryBase: .04, returnBase: .015 },
  { key: "top35", label: "上位35%", salaryBase: .02, returnBase: .008 },
  { key: "middle", label: "中間", salaryBase: 0, returnBase: 0 },
  { key: "lower35", label: "下位35%", salaryBase: -.01, returnBase: -.003 },
  { key: "lower10", label: "下位10%", salaryBase: -.02, returnBase: -.008 },
] as const satisfies readonly AppearanceParam[];

const curve = {
  elite: [[.08,.06,.04,.018],[-.02,-.05]], stable: [[.04,.032,.022,.01],[-.008,-.025]],
  independent: [[.06,.045,.025,.008],[-.02,-.05]], volatile: [[.09,.05,.015,-.025],[-.07,-.12]],
  extreme: [[.14,.09,.02,-.06],[-.14,-.22]], public: [[.026,.022,.016,.008],[-.004,-.012]],
} as const;

function occupation(key: string, label: string, retirement: number, peak: number, baseReturn: number, appearanceMultiplier: number, careerRisk: number, riskLabel: string, wage: keyof typeof curve): OccupationParam {
  return { key, label, retirement, peak, baseReturn, appearanceMultiplier, careerRisk, riskLabel, rampUp: [...curve[wage][0]], rampDown: [...curve[wage][1]] };
}

export const OCCUPATIONS = [
  occupation("fund", "ヘッジファンド・PEファンド", 55, 42, .05, .5, .12, "VERY HIGH", "elite"),
  occupation("finance", "大手金融・コンサル・外資", 60, 45, .045, 1.5, .05, "MID", "elite"),
  occupation("poker", "プロポーカー", 55, 38, .045, .2, .25, "VERY HIGH", "volatile"),
  occupation("betting", "競馬・スポーツベット", 60, 45, .04, .1, .20, "VERY HIGH", "volatile"),
  occupation("listed", "大手企業（上場）", 60, 55, .035, .8, .02, "LOW", "stable"),
  occupation("freelance", "中堅・フリーランス", 60, 45, .035, 1, .08, "MID", "independent"),
  occupation("selfEmployed", "自営業", 65, 50, .032, 1.2, .10, "HIGH", "independent"),
  occupation("founder", "起業家・経営者", 70, 55, .03, 1.3, .20, "VERY HIGH", "elite"),
  occupation("entertainment", "芸能（俳優・タレント等）", 55, 32, .03, 3, .20, "EXTREME", "extreme"),
  occupation("athlete", "スポーツ選手（プロ）", 38, 27, .028, 1.8, .18, "EXTREME", "extreme"),
  occupation("sme", "中小企業", 60, 50, .028, .7, .08, "MID-LOW", "stable"),
  occupation("public", "公務員", 60, 55, .025, .2, .01, "VERY LOW", "public"),
  occupation("slot", "スロットプロ", 45, 32, .025, .1, .40, "EXTREME", "extreme"),
  occupation("nonRegular", "非正規雇用", 60, 40, .02, 1, .15, "HIGH", "stable"),
  occupation("professional", "医師・弁護士・会計士", 65, 50, .015, .3, .02, "LOW", "independent"),
  occupation("host", "ホスト", 35, 28, .01, 2.8, .30, "EXTREME", "extreme"),
  occupation("hostess", "ホステス・キャバクラ", 32, 25, .01, 3, .25, "EXTREME", "extreme"),
  occupation("clubOwner", "クラブ ママ・経営", 65, 50, .01, 1.5, .12, "HIGH", "independent"),
] as const;

export type EducationKey = typeof EDUCATIONS[number]["key"];
export type AppearanceKey = typeof APPEARANCES[number]["key"];
export type OccupationKey = typeof OCCUPATIONS[number]["key"];

export interface QuizQuestion { id: string; question: string; options: string[]; answer: number; explanation: string; }
const quiz = (id: string, question: string, options: string[], answer: number, explanation: string): QuizQuestion => ({ id, question, options, answer, explanation });

export const QUIZ_BANK: QuizQuestion[] = [
  quiz("q01","複利とは、どのような増え方ですか？",["元本だけに利息","元本と過去の利息に利息","毎年固定額","税金がゼロ"],1,"過去の利息も次の元本になります。"),
  quiz("q02","分散投資の主な目的は？",["必ず利益を出す","損失をなくす","特定資産への偏りを抑える","税率を下げる"],2,"値動きの偏りを抑える考え方です。"),
  quiz("q03","インフレ率が預金金利を上回ると、実質購買力は？",["増える","変わらない","下がる","必ず2倍"],2,"物価上昇に追いつかなければ購買力は下がります。"),
  quiz("q04","債券価格と市場金利の一般的な関係は？",["同方向","逆方向","無関係","常に一定"],1,"金利上昇時は既発債価格が下がりやすくなります。"),
  quiz("q05","リスクと期待リターンの一般的な関係は？",["高リスクほど期待リターンも高い傾向","高リスクは必ず損","低リスクほど高収益","無関係"],0,"高い期待収益には通常より大きな変動が伴います。"),
  quiz("q06","生活防衛資金で重視される性質は？",["高い換金性","最大の値上がり","長い解約制限","大きな為替変動"],0,"急な支出に使える流動性が重要です。"),
  quiz("q07","株式を保有することは基本的に何を意味しますか？",["企業への貸付","企業の所有権の一部","国への寄付","元本保証預金"],1,"株式は企業の所有権を小口化したものです。"),
  quiz("q08","為替ヘッジの主な目的は？",["株価変動をなくす","為替変動の影響を抑える","配当を増やす","手数料をなくす"],1,"円換算価値の為替による揺れを抑えます。"),
  quiz("q09","投資信託の信託報酬は何に影響しますか？",["保有中の運用コスト","預金保険上限","為替レート","所得税率"],0,"保有中に継続して差し引かれる費用です。"),
  quiz("q10","ドルコスト平均法とは？",["同じ金額を定期投資","高値だけで買う","必ず底値で買う","一度だけ全額投資"],0,"定額を定期購入する方法です。"),
  quiz("q11","PERは一般に何を比較しますか？",["株価と1株利益","配当と金利","売上と現金","債券価格と満期"],0,"株価が1株利益の何倍かを示します。"),
  quiz("q12","レバレッジ取引の注意点は？",["損失も拡大しうる","損失は必ずゼロ","元本保証","変動がなくなる"],0,"利益だけでなく損失も拡大します。"),
  quiz("q13","実質金利の概算として近いものは？",["名目＋インフレ","名目−インフレ","名目×税率","インフレのみ"],1,"名目金利からインフレ率を差し引きます。"),
  quiz("q14","ETFの特徴として一般的に正しいものは？",["取引所で売買できる","価格が変わらない","必ず元本保証","法人専用"],0,"ETFは上場投資信託です。"),
  quiz("q15","流動性リスクとは？",["希望価格で売買しにくいリスク","金利が必ず上がる","配当が必ず増える","税率が固定"],0,"売りたい時に適正価格で売れない可能性です。"),
  quiz("q16","長期投資で手数料が重要な理由は？",["複利でコスト差が積み上がる","後で全額戻る","利益と無関係","高いほど保証"],0,"小さな年率差が長期で大きくなります。"),
  quiz("q17","倒産時、一般に株主の弁済順位は？",["債権者より先","債権者より後","常に国より先","順位なし"],1,"株主は債権者への支払い後です。"),
  quiz("q18","相関が低い資産を組み合わせる狙いは？",["値動きの偏りを和らげる","税金をなくす","利益を固定","為替を固定"],0,"異なる値動きで全体の振れを抑えます。"),
  quiz("q19","インデックス運用とは？",["特定指数への連動を目指す","毎日全銘柄を予想","元本保証","現金だけ"],0,"市場指数と同等の動きを目指します。"),
  quiz("q20","外貨資産を円評価するとき影響するものは？",["為替レート","郵便料金","保有者の年齢","銘柄コード"],0,"資産価格と為替の両方が影響します。"),
  quiz("q21","元本保証でまず確認することは？",["保証主体と条件","広告の色","名称の長さ","購入人数"],0,"誰がどの範囲を保証するかが重要です。"),
  quiz("q22","リバランスとは？",["資産配分を目標比率へ戻す","全資産を現金化","借入を増やす","毎日銘柄変更"],0,"崩れた資産配分を当初方針へ戻します。"),
  quiz("q23","配当落ち日に株価が下がりやすい理由は？",["配当権利の価値が切り離される","必ず倒産","市場閉鎖","税率100%"],0,"配当を受け取る権利の価値が外れます。"),
  quiz("q24","シャープレシオが示すものは？",["リスク当たりの超過リターン","従業員数","暗証番号","債券額面"],0,"リスク1単位当たりの超過収益です。"),
  quiz("q25","期待リターン5%とは？",["毎年必ず5%増","長期平均の見込みで年ごとに変動","損失なし","税引後固定"],1,"期待値は保証ではありません。"),
];

export interface CalculatorInputs { age:number; annualIncome:number; education:EducationKey; appearance:AppearanceKey; occupation:OccupationKey; financialAssets:number; realEstateAssets:number; reinvestmentRate:number; correctAnswers:number; }
export interface AnnualProjection { age:number; rawSalary:number; salary:number; survival:number; curveRate:number; initialAssets:number; reinvested:number; gains:number; balance:number; }
export interface CalculationResult {
  marketCapMan:number; salaryIncomeMan:number; assetIncomeMan:number; effectiveReturn:number;
  financialAdjustment:number; appearanceSalaryAdjustment:number; appearanceReturnAdjustment:number;
  yearsRemaining:number; education:EducationParam; appearance:AppearanceParam; occupation:OccupationParam; projections:AnnualProjection[];
}

export function getEducation(key: EducationKey): EducationParam { return EDUCATIONS.find(x => x.key === key) ?? EDUCATIONS[7]; }
export function getAppearance(key: AppearanceKey): AppearanceParam { return APPEARANCES.find(x => x.key === key) ?? APPEARANCES[2]; }
export function getOccupation(key: OccupationKey): OccupationParam { return OCCUPATIONS.find(x => x.key === key) ?? OCCUPATIONS[4]; }
export const financialLiteracyAdjustment = (correct: number) => (Math.min(5,Math.max(0,correct))/5-.5)*.1;

export function wageCurveRate(job: OccupationParam, startAge: number, elapsed: number): number {
  const age = startAge + elapsed;
  if (age < job.peak) {
    const segment = Math.max(.25, Math.max(1, job.peak-startAge)/4);
    return job.rampUp[Math.min(3,Math.floor(elapsed/segment))];
  }
  return job.rampDown[Math.min(1,Math.floor(Math.max(0,age-job.peak)/5))];
}

export function miniWageCurve(job: OccupationParam): number[] {
  const start = Math.max(20,job.peak-16); let value=100; const points:number[]=[];
  for(let year=0;year<28;year+=2){ value*=Math.pow(1+wageCurveRate(job,start,year)+.02,2); points.push(Math.max(10,value)); }
  return points;
}

export function calculateMarketCap(input: CalculatorInputs): CalculationResult {
  const education=getEducation(input.education), appearance=getAppearance(input.appearance), job=getOccupation(input.occupation);
  const yearsRemaining=Math.max(0,job.retirement-input.age), financialAdjustment=financialLiteracyAdjustment(input.correctAnswers);
  const appearanceSalaryAdjustment=appearance.salaryBase*job.appearanceMultiplier;
  const returnMultiplier=job.appearanceMultiplier>1?job.appearanceMultiplier*.5:job.appearanceMultiplier;
  const appearanceReturnAdjustment=appearance.returnBase*returnMultiplier;
  const effectiveReturn=Math.min(.05,job.baseReturn+financialAdjustment+education.nwReturn+appearanceReturnAdjustment);
  const initialAssets=Math.max(0,input.financialAssets)+Math.max(0,input.realEstateAssets);
  let balance=initialAssets, rawSalary=Math.max(0,input.annualIncome)*(1+education.salaryAdj), salaryTotal=0, assetTotal=0, reinvested=0, gains=0;
  const projections:AnnualProjection[]=[];
  for(let year=0;year<yearsRemaining;year+=1){
    const survival=Math.pow(1-job.careerRisk,year), salary=rawSalary*survival; salaryTotal+=salary;
    const add=salary*Math.min(1,Math.max(0,input.reinvestmentRate)); reinvested+=add; balance+=add;
    const gain=balance*effectiveReturn; gains+=gain; assetTotal+=gain; balance+=gain;
    const curveRate=wageCurveRate(job,input.age,year);
    projections.push({age:input.age+year,rawSalary,salary,survival,curveRate,initialAssets,reinvested,gains,balance});
    rawSalary=Math.max(0,rawSalary*(1+curveRate+.02+education.nwSalary+appearanceSalaryAdjustment));
  }
  const salaryIncomeMan=salaryTotal*education.multiplier;
  return {marketCapMan:salaryIncomeMan+assetTotal,salaryIncomeMan,assetIncomeMan:assetTotal,effectiveReturn,financialAdjustment,appearanceSalaryAdjustment,appearanceReturnAdjustment,yearsRemaining,education,appearance,occupation:job,projections};
}

export function getTier(value:number):"S"|"A"|"B"|"C"|"D" { return value>=50000?"S":value>=20000?"A":value>=8000?"B":value>=2000?"C":"D"; }
export function formatMan(value:number):string { const n=Math.round(Math.abs(value)),sign=value<0?"−":""; if(n>=10000){const o=Math.floor(n/10000),m=n%10000;return `${sign}${o}億${m?`${m.toLocaleString("ja-JP")}万`:""}円`;} return `${sign}${n.toLocaleString("ja-JP")}万円`; }
export function formatPercent(value:number,digits=1):string { return `${value>0?"+":""}${(value*100).toFixed(digits)}%`; }
