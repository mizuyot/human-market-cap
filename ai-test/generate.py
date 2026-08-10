#!/usr/bin/env python3
"""人間時価総額 CALCULATOR — AIコメント品質検証（Ollama ローカルのみ）"""

from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.request
from pathlib import Path

OLLAMA_URL = "http://localhost:11434/api/generate"
PREFERRED_MODEL = "qwen3:30b-a3b"
DIR = Path(__file__).resolve().parent
BUCKETS_PATH = DIR / "buckets.json"
HUMOR_PHRASES_PATH = DIR / "humor_phrases.json"
DEFAULT_RESULTS_PATH = DIR / "results.json"
FULL_PATTERN_COUNT = 1600


def load_humor_data() -> dict:
    return json.loads(HUMOR_PHRASES_PATH.read_text(encoding="utf-8"))


def load_humor_phrases() -> list[dict]:
    return list(load_humor_data().get("phrases") or [])


def format_humor_catalog(phrases: list[dict], *, lanes: set[str] | None = None) -> str:
    lines = []
    for p in phrases:
        lane = p.get("lane", "humor")
        if lanes is not None and lane not in lanes:
            continue
        line = (
            f"- {p['id']} [{lane}]: 「{p['phrase']}」（使う状況: {p['use_when']}）"
        )
        if p.get("note"):
            line += f"\n  補足: {p['note']}"
        lines.append(line)
    return "\n".join(lines) if lines else "（このレーンに使えるフレーズなし）"


def bucket_phrase_lane(bucket: dict) -> str:
    """この類型で使えるフレーズレーン。serious or humor。"""
    blob = f"{bucket.get('label', '')} {bucket.get('asset', '')}"
    if any(k in blob for k in ("リボ", "残債", "借金")):
        return "serious"
    # 45歳以上×投資未経験×老後不安 → serious (H12)
    age = int(bucket.get("age") or 0)
    inexperienced = any(
        k in blob
        for k in ("投資経験なし", "運用は未着手", "運用なし", "手つかず", "投資未経験")
    )
    if age >= 45 and inexperienced:
        return "serious"
    return "humor"


def is_humor_sensitive(bucket: dict) -> bool:
    """後方互換: serious レーン類型かどうか。"""
    return bucket_phrase_lane(bucket) == "serious"


def build_system_prompt(phrases: list[dict] | None = None) -> str:
    data = load_humor_data()
    if phrases is None:
        phrases = list(data.get("phrases") or [])
    policy = data.get("policy") or {}
    glossary = bool(policy.get("glossary", False))
    humor_cat = format_humor_catalog(phrases, lanes={"humor"})
    serious_cat = format_humor_catalog(phrases, lanes={"serious"})
    glossary_rule = (
        "ポーカー／ゲーム用語には注釈・言い換えを付けない（glossary: false）。"
        if not glossary
        else "必要なら用語の言い換えを付けてよい。"
    )
    return f"""あなたは「人間時価総額 CALCULATOR」の査定コメント担当です。
文体は「人間を金融銘柄として大真面目に査定するアナリストレポート」である。
前向きで、その人固有の状況に刺さる日本語コメントを書くこと。

【文体】
- だ・である調のアナリストレポート文体で全パートを統一する
- です・ます調は使わない。だ・であるとです・ますの混在も禁止

【分析ファースト（内部で必ず実施。出力には書かない）】
コメントを書く前に、頭の中で次の3問に答えてから本文を書くこと。
Q1. この人の資産構成・収支・知識レベルの中で「最大のリスクまたは機会損失」は何か？
    例: 資産がほぼ普通預金一点集中 → インフレによる実質価値の目減り・機会損失
    例: リボ払い残債あり → 高金利負債が貯蓄を食う
    例: 長期放置の運用 → 目標や配分の見直し不足
Q2. この人に「今いちばん効く一手」は何か？（優先順位を間違えない）
    例: 有利子負債があれば返済・整理が投資より先
    例: 防衛資金は足りるが預金一点集中なら、現金以外への分散を学ぶ・始める
Q3. この人の属性で「構造的に本当に強い点」は何か？（お世辞ではなく）
    例: 若さ＝複利期間の長さ / 貯蓄習慣＝入金力 / 長期保有の継続力 / 高知識＝判断の土台

【出力構成（この順）】
1. 褒めポイントを2つ（必ず Q3 および事実に基づく）
2. 伸びしろの提案を2つ（必ず Q1・Q2 に基づく。類型の核心を言語化する）
3. 前向きな総評を1〜2文

【型フレーズ集（選択と穴埋めのみ。新発明禁止）】
{glossary_rule}
該当する状況があれば、ユーザープロンプトで指定されたレーンのリストから最も合う1つを選び、
文意が通るように文に組み込む。該当がなければ使わない（無理に使わない選択も可）。
1コメントにつき最大1本。フレーズの改変は語尾の活用調整のみ可。
入れる場所は伸びしろ提案パートを推奨。顔文字・絵文字・「(笑)」は使わない。

■ humor レーン（軽い類型のみ）:
{humor_cat}

■ serious レーン（真剣類型のみ。humorレーンの使用は禁止）:
{serious_cat}

【レーン規則】
- リボ・高金利負債、または45歳以上×投資未経験×老後不安 → serious レーンのみ可
- それ以外の軽い類型 → humor レーンのみ可
- 真剣類型に humor レーンのフレーズを使うことは禁止

【厳守ルール】
- 褒めと伸びしろは Q1〜Q3 の分析結果に基づくこと。誰にでも言える一般論だけで埋めない
  （禁止例: 「少額から投資を」「オンライン講座で学習を」だけで終わる）
- 預金一点集中なら「普通預金に偏っていること」や「物価上昇で実質価値が目減りしうること」に触れる
- リボ等の負債があれば、返済・整理を投資より優先する旨を明確にする
- 入力属性の美化・読み替え禁止
  （クイズ正答率が低いなら「これから学ぶ余地が大きい」は可。「関心が高い」等の盛った言い換えは不可）
- 特定の金融商品名・銘柄・利回りの約束は禁止（投資助言にしない）
  ※型フレーズ内の比喩語は例外として可
- 金額・時価総額の数値は書かない（数値は計算ロジック側が正のため）
- 学歴や現状を見下す表現は禁止
- 400字以内
- 出力はコメント本文のみ（Q1〜Q3の分析メモ・見出し・思考過程・フレーズIDは含めない）
"""


# 起動時に組み立て（フレーズ集変更時はプロセス再起動で反映）
SYSTEM_PROMPT = build_system_prompt()


def list_ollama_models() -> list[str]:
    req = urllib.request.Request(
        "http://localhost:11434/api/tags",
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return [m.get("name", "") for m in data.get("models", [])]


def resolve_model() -> str:
    models = list_ollama_models()
    if PREFERRED_MODEL in models:
        return PREFERRED_MODEL
    for name in models:
        if "qwen3" in name.lower() and "30b" in name.lower() and "a3b" in name.lower():
            return name
    for name in models:
        if "qwen3" in name.lower():
            return name
    if models:
        return models[0]
    raise RuntimeError("Ollama に利用可能なモデルがありません")


def build_user_prompt(
    bucket: dict,
    *,
    no_think: bool,
    fix_reason: str | None = None,
) -> str:
    # プロファイル入力（パイロット）: text / hint / phraseLane
    if bucket.get("text") and bucket.get("bucketId"):
        return build_profile_user_prompt(
            bucket, no_think=no_think, fix_reason=fix_reason
        )

    text = (
        "次のユーザー類型について、査定コメントを生成してください。\n"
        f"- 類型ラベル: {bucket['label']}\n"
        f"- 年齢: {bucket['age']}歳\n"
        f"- 年収帯の目安: {bucket['income']}万円前後（参考情報。金額数値はコメントに書かない）\n"
        f"- 学歴: {bucket['edu']}\n"
        f"- 資産状況: {bucket['asset']}\n"
        f"- 金融クイズ正答率: {bucket['quiz']}%\n"
    )
    lane = bucket_phrase_lane(bucket)
    if lane == "serious":
        text += (
            "\n【トーン指定】この類型は真剣対応である。"
            "serious レーンの型フレーズのみ使用可。humor レーンは禁止。"
            "状況に合う serious フレーズがあれば1本だけ組み込み、無ければ使わない。"
            "ポーカー用語への注釈・言い換えは付けない。"
            "全文をだ・である調で統一すること。\n"
        )
    else:
        text += (
            "\n【トーン指定】この類型は軽い類型である。"
            "humor レーンの型フレーズのみ使用可。serious レーンは禁止。"
            "状況に合う humor フレーズがあれば1本だけ組み込み、無ければ使わない。"
            "新しい比喩の発明は禁止。ポーカー用語への注釈・言い換えは付けない。"
            "全文をだ・である調で統一すること。\n"
        )
    if fix_reason:
        text += (
            f"\n【重要】前回の不合格理由: {fix_reason}。"
            "この点を必ず修正すること。\n"
        )
    if no_think:
        text += "\n/no_think\n"
    return text


def build_profile_user_prompt(
    profile: dict,
    *,
    no_think: bool,
    fix_reason: str | None = None,
) -> str:
    suggest = profile.get("suggestedPhraseIds") or []
    suggest_s = "、".join(suggest) if suggest else "なし（無理に使わない）"
    lane = profile.get("phraseLane") or "humor"
    text = (
        "次のユーザー類型について、査定コメントを生成してください。\n"
        f"- バケットID: {profile.get('bucketId')}\n"
        f"- グループ: {profile.get('group')}（{profile.get('groupLabel')}）\n"
        f"- 属性記述: {profile.get('text')}\n"
        f"- コメント核ヒント: {profile.get('hint')}\n"
        f"- 推奨フレーズID（任意）: {suggest_s}\n"
        "金額・時価総額の数値はコメントに書かない。\n"
    )
    if lane == "serious":
        text += (
            "\n【トーン指定】serious レーンの型フレーズのみ使用可。humor レーンは禁止。"
            "状況に合う serious フレーズがあれば1本だけ組み込み、無ければ使わない。"
            "新しい比喩の発明は禁止。ポーカー用語への注釈・言い換えは付けない。"
            "全文をだ・である調で統一すること。\n"
        )
    else:
        text += (
            "\n【トーン指定】humor レーンの型フレーズのみ使用可。serious レーンは禁止。"
            "状況に合う humor フレーズがあれば1本だけ組み込み、無ければ使わない。"
            "新しい比喩の発明は禁止。ポーカー用語への注釈・言い換えは付けない。"
            "フレーズに補足(note)がある場合は、提案本文でその方針に従うこと。"
            "全文をだ・である調で統一すること。\n"
        )
    if fix_reason:
        text += (
            f"\n【重要】前回の不合格理由: {fix_reason}。"
            "この点を必ず修正すること。\n"
        )
    if no_think:
        text += "\n/no_think\n"
    return text


def strip_think_blocks(text: str) -> str:
    """qwen3 などが返す <think>...</think> を除去する。"""
    out = text
    while True:
        start = out.find("<think>")
        if start == -1:
            break
        end = out.find("</think>", start)
        if end == -1:
            out = out[:start]
            break
        out = out[:start] + out[end + len("</think>") :]
    return out.strip()


def generate_comment(
    model: str,
    bucket: dict,
    *,
    no_think: bool,
    fix_reason: str | None = None,
) -> tuple[str | None, str | None, float]:
    payload: dict = {
        "model": model,
        "prompt": build_user_prompt(
            bucket, no_think=no_think, fix_reason=fix_reason
        ),
        "system": build_system_prompt(),
        "stream": False,
        "options": {
            "temperature": 0.7,
        },
    }
    # Ollama の thinking 制御（対応モデル向け）。併せて /no_think も付与済み。
    payload["think"] = not no_think

    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        OLLAMA_URL,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=600) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        elapsed = time.perf_counter() - started
        raw = (data.get("response") or "").strip()
        # think=false でも thinking フィールドに入る場合があるので結合せず本文のみ使う
        comment = strip_think_blocks(raw)
        if not comment:
            return None, "空のレスポンス", elapsed
        return comment, None, elapsed
    except urllib.error.HTTPError as e:
        elapsed = time.perf_counter() - started
        detail = e.read().decode("utf-8", errors="replace")
        # think パラメータ非対応なら、think なしで再試行
        if e.code == 400 and "think" in detail.lower():
            return generate_comment_without_think_field(
                model, bucket, no_think=no_think, fix_reason=fix_reason
            )
        return None, f"HTTP {e.code}: {detail[:300]}", elapsed
    except Exception as e:  # noqa: BLE001 — 1件失敗しても続行
        elapsed = time.perf_counter() - started
        return None, f"{type(e).__name__}: {e}", elapsed


def generate_comment_without_think_field(
    model: str,
    bucket: dict,
    *,
    no_think: bool,
    fix_reason: str | None = None,
) -> tuple[str | None, str | None, float]:
    """think フィールド非対応時のフォールバック（/no_think プロンプトのみ）。"""
    payload = {
        "model": model,
        "prompt": build_user_prompt(
            bucket, no_think=no_think, fix_reason=fix_reason
        ),
        "system": build_system_prompt(),
        "stream": False,
        "options": {"temperature": 0.7},
    }
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        OLLAMA_URL,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=600) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        elapsed = time.perf_counter() - started
        comment = strip_think_blocks((data.get("response") or "").strip())
        if not comment:
            return None, "空のレスポンス", elapsed
        return comment, None, elapsed
    except Exception as e:  # noqa: BLE001
        elapsed = time.perf_counter() - started
        return None, f"{type(e).__name__}: {e}", elapsed


def append_result(path: Path, results: list[dict], item: dict) -> None:
    results.append(item)
    path.write_text(
        json.dumps(results, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Ollama 査定コメント品質検証")
    p.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_RESULTS_PATH,
        help="結果 JSON の保存先",
    )
    p.add_argument(
        "--ids",
        nargs="*",
        default=None,
        help="対象 bucket id（省略時は全件）。部分一致可",
    )
    think = p.add_mutually_exclusive_group()
    think.add_argument(
        "--no-think",
        action="store_true",
        help="thinking 無効（/no_think + think:false）",
    )
    think.add_argument(
        "--think",
        action="store_true",
        help="thinking 有効（既定）",
    )
    p.add_argument(
        "--fresh",
        action="store_true",
        help="既存 output を無視して新規生成",
    )
    p.add_argument(
        "--tag",
        default="",
        help="結果に付与するタグ（例: no_think / think）",
    )
    return p.parse_args()


def match_ids(bucket: dict, id_filters: list[str] | None) -> bool:
    if not id_filters:
        return True
    bid = bucket["id"]
    label = bucket.get("label", "")
    for f in id_filters:
        if f in bid or f in label or bid.startswith(f) or bid.startswith(f.zfill(2)):
            return True
        # "01" / "B01" 形式
        normalized = f.lower().lstrip("b").lstrip("0") or "0"
        if bid.startswith(normalized.zfill(2)):
            return True
    return False


def print_summary(results: list[dict]) -> None:
    successes = [r for r in results if r.get("error") is None and r.get("comment")]
    failures = [r for r in results if r.get("error") is not None or not r.get("comment")]
    avg_seconds = (
        sum(r["seconds"] for r in successes) / len(successes) if successes else 0.0
    )
    estimate_1600 = avg_seconds * FULL_PATTERN_COUNT

    print("=" * 60)
    print(f"成功: {len(successes)} / {len(results)} 件")
    print(f"失敗: {len(failures)} 件")
    print(f"平均生成秒数（成功のみ）: {avg_seconds:.2f} 秒")
    print(
        f"{FULL_PATTERN_COUNT} パターン全生成の推定時間: "
        f"{estimate_1600:.0f} 秒 "
        f"（約 {estimate_1600 / 60:.1f} 分 / {estimate_1600 / 3600:.2f} 時間）"
    )
    print("=" * 60)
    print("\n===== コメント一覧 =====\n")
    for r in results:
        extra = f"  tag={r['tag']}" if r.get("tag") else ""
        think_flag = r.get("no_think")
        think_s = f"  no_think={think_flag}" if think_flag is not None else ""
        print(f"■ {r['id']} | {r['label']}")
        print(f"  model={r['model']}  seconds={r['seconds']}{think_s}{extra}")
        if r.get("error"):
            print(f"  [ERROR] {r['error']}")
        else:
            print(r.get("comment") or "(空)")
        print()


def main() -> None:
    args = parse_args()
    no_think = bool(args.no_think)
    results_path: Path = args.output

    buckets = json.loads(BUCKETS_PATH.read_text(encoding="utf-8"))
    targets = [b for b in buckets if match_ids(b, args.ids)]
    if not targets:
        raise SystemExit(f"対象 bucket が見つかりません: {args.ids}")

    model = resolve_model()
    print(f"使用モデル: {model}")
    print(f"エンドポイント: {OLLAMA_URL}")
    print(f"thinking: {'OFF (/no_think)' if no_think else 'ON'}")
    print(f"出力先: {results_path}")
    print(f"対象: {len(targets)} 件")
    print("-" * 60)

    results: list[dict] = []
    done_ids: set[str] = set()
    if results_path.exists() and not args.fresh:
        try:
            existing = json.loads(results_path.read_text(encoding="utf-8"))
            if isinstance(existing, list):
                results = existing
                done_ids = {r.get("id") for r in results if r.get("id")}
                print(
                    f"既存 {results_path.name} を読み込みました"
                    f"（{len(results)} 件）。未完了分のみ生成します。"
                )
        except json.JSONDecodeError:
            print(f"既存 {results_path.name} が壊れているため新規に書き直します。")
            results = []
            done_ids = set()

    total = len(targets)
    for i, bucket in enumerate(targets, start=1):
        bid = bucket["id"]
        if bid in done_ids:
            print(f"[{i}/{total}] skip {bid} （既存）")
            continue

        print(f"[{i}/{total}] generating {bid} — {bucket['label']} ...", flush=True)
        comment, error, seconds = generate_comment(model, bucket, no_think=no_think)
        item = {
            "id": bid,
            "label": bucket["label"],
            "model": model,
            "seconds": round(seconds, 2),
            "comment": comment,
            "error": error,
            "no_think": no_think,
        }
        if args.tag:
            item["tag"] = args.tag
        append_result(results_path, results, item)
        if error:
            print(f"  ERROR ({seconds:.1f}s): {error}")
        else:
            preview = (comment or "").replace("\n", " ")[:100]
            print(f"  OK ({seconds:.1f}s): {preview}...")

    print_summary(results)


if __name__ == "__main__":
    main()
