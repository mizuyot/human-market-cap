#!/usr/bin/env python3
"""査定コメントのセルフレビュー（Ollama ローカルのみ）"""

from __future__ import annotations

import argparse
import json
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

from generate import (  # noqa: E402
    BUCKETS_PATH,
    DIR,
    OLLAMA_URL,
    resolve_model,
    strip_think_blocks,
)

RESULTS_V2_PATH = DIR / "results-v2.json"
REVIEW_V2_PATH = DIR / "review-v2.json"
FULL_PATTERN_COUNT = 1600

REVIEW_SYSTEM = """あなたは査定コメントの品質検査官です。厳しい基準で不合格を見逃さないこと。
与えられた「バケット属性」と「コメント本文」を照合し、C1〜C9を判定する。
出力は JSON オブジェクトのみ。

【判定ルール】各Ciは「違反なら true / 問題なければ false」

C1_amount_numbers: コメントに金額・時価総額の数値（例: 800万, 10万円, 550万円）が含まれる → true
  ※「〇歳」「20代」は金額ではないので false

C2_product_promise: 特定の金融商品名・銘柄・利回りの約束 → true
  ※「分散」「普通預金」「負債返済」など一般概念は false
  ※型フレーズ比喩の「銘柄」「上場」「防御振り」等は商品推奨ではないので false

C3_attribute_beautify: 属性の美化・事実の読み替え → true
  クイズ正答率の帯が「低」または「中」のとき、入力に学習意欲・関心の明示が無いのに、
  コメントが「学習意欲が高い／伺える」「関心が高い」「学びへの意欲」などと書いていれば必ず true。
  正答率そのものから意欲を読み取るのも美化であり true。
  【具体例→必ず true】正答率帯が中で「金融クイズの正答率から学習意欲も伺えます」
  【falseの例】「これから学ぶ余地が大きい」／正答率帯が「高」で知識を評価／入力に学習意欲の明示あり

C4_broken_japanese: 不自然な日本語・脱字・誤変換・文法破綻 → true
  【必ず違反】「少しずな」（正: 少しずつ）
  比喩表現も含めて、日本語として文法的に成立しているかを判定する。
  比喩だからという理由で文法破綻を見逃さない。
  【必ず違反の例】「知識は未上場株式の高評価を活かし」（主語と比喩の接続が破綻）
  意味が通らない・係り受けが壊れている文は true

C5_condescending: 学歴・現状・知識を見下す表現 → true

C6_humor_personal_attack: ユーモアが人格攻撃・嘲笑になっている → true
  状況の構図を金融用語で比喩化するのはOK
  人物そのものを笑う・馬鹿にする・嘲笑する表現は true
  顔文字・絵文字・「(笑)」があれば true

C7_humor_sensitive_overkill: 真剣類型への humor レーン混入 → true
  対象: リボ・高金利負債 / 45歳以上×投資未経験×老後不安
  これらの類型で humor レーンの比喩・軽口が入っていれば true
  serious レーンの型フレーズ（例: マイナスEV、バンクロール管理）は false
  実務的で真顔の指摘のみなら false

C8_style_mix: 文体混在 → true
  だ・である調とです・ます調が同一コメント内で混在していれば true
  どちらか一方に統一されていれば false（本プロダクトはだ・である調が正）

C9_invented_metaphor: 型フレーズ集にない新しい比喩・造語を発明している → true
  カタログフレーズ（日本銀行券にオールイン、タイトパッシブ、バンクロール、
  ステークスを上げる、マイナスEV、高レートのテーブル、次のゲーム選び 等）の
  組み込みは false。カタログ外の独自キャッチー比喩が目立つ場合は true

【verdict】
checks のいずれかが true → "FAIL" / すべて false → "PASS"

【出力スキーマ】
{"checks":{"C1_amount_numbers":false,"C2_product_promise":false,"C3_attribute_beautify":false,"C4_broken_japanese":false,"C5_condescending":false,"C6_humor_personal_attack":false,"C7_humor_sensitive_overkill":false,"C8_style_mix":false,"C9_invented_metaphor":false},"verdict":"PASS","reason":"..."}
"""


def quiz_band(quiz: int) -> str:
    if quiz <= 40:
        return "低"
    if quiz <= 70:
        return "中"
    return "高"


def build_review_prompt(bucket: dict, comment: str) -> str:
    return (
        "次の査定コメントを検査し、指定の JSON だけを出力してください。\n\n"
        f"【バケット属性】\n"
        f"- id: {bucket['id']}\n"
        f"- label: {bucket['label']}\n"
        f"- 年齢: {bucket['age']}歳\n"
        f"- 年収目安: {bucket['income']}万円前後（コメントに書いてよいかはC1で判定）\n"
        f"- 学歴: {bucket['edu']}\n"
        f"- 資産状況: {bucket['asset']}\n"
        f"- 金融クイズ正答率: {bucket['quiz']}%（帯: {quiz_band(bucket['quiz'])}）\n\n"
        f"【コメント本文】\n{comment}\n"
    )


def extract_json_object(text: str) -> dict | None:
    text = strip_think_blocks(text).strip()
    if not text:
        return None
    # ```json ... ``` を除去
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence:
        text = fence.group(1)
    try:
        obj = json.loads(text)
        if isinstance(obj, dict):
            return obj
    except json.JSONDecodeError:
        pass
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        try:
            obj = json.loads(text[start : end + 1])
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            return None
    return None


def has_desu_masu(text: str) -> bool:
    return bool(
        re.search(
            r"(です[。．！？\s]|ます[。．！？\s]|でした|ました|でしょう|ましょう|ません|ください)",
            text,
        )
    )


def has_da_dearu(text: str) -> bool:
    return bool(
        re.search(
            r"(である[。．！？\s]|だ[。．！？\s]|であろう|だろう|である。|だ。)",
            text,
        )
    ) or bool(re.search(r"(である|だ)$", text.strip()))


def normalize_verdict(obj: dict) -> dict:
    checks = obj.get("checks") or {}
    # キーゆれ吸収
    normalized = {
        "C1_amount_numbers": bool(
            checks.get("C1_amount_numbers", checks.get("C1", False))
        ),
        "C2_product_promise": bool(
            checks.get("C2_product_promise", checks.get("C2", False))
        ),
        "C3_attribute_beautify": bool(
            checks.get("C3_attribute_beautify", checks.get("C3", False))
        ),
        "C4_broken_japanese": bool(
            checks.get("C4_broken_japanese", checks.get("C4", False))
        ),
        "C5_condescending": bool(
            checks.get("C5_condescending", checks.get("C5", False))
        ),
        "C6_humor_personal_attack": bool(
            checks.get("C6_humor_personal_attack", checks.get("C6", False))
        ),
        "C7_humor_sensitive_overkill": bool(
            checks.get("C7_humor_sensitive_overkill", checks.get("C7", False))
        ),
        "C8_style_mix": bool(
            checks.get("C8_style_mix", checks.get("C8", False))
        ),
        "C9_invented_metaphor": bool(
            checks.get("C9_invented_metaphor", checks.get("C9", False))
        ),
    }
    any_fail = any(normalized.values())
    verdict = str(obj.get("verdict", "")).upper().strip()
    if verdict not in {"PASS", "FAIL"}:
        verdict = "FAIL" if any_fail else "PASS"
    if any_fail:
        verdict = "FAIL"
    else:
        verdict = "PASS"
    reason = str(obj.get("reason") or "").strip() or (
        "違反あり" if verdict == "FAIL" else "問題なし"
    )
    return {"checks": normalized, "verdict": verdict, "reason": reason}


def call_ollama_json(model: str, prompt: str) -> tuple[str, float, str | None]:
    payload = {
        "model": model,
        "system": REVIEW_SYSTEM,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "think": True,
        "options": {"temperature": 0.0},
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
        with urllib.request.urlopen(req, timeout=180) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        elapsed = time.perf_counter() - started
        # qwen3 + format=json では JSON が thinking 側に入ることがある
        raw = (data.get("response") or "").strip()
        if not raw:
            raw = (data.get("thinking") or "").strip()
        return raw, elapsed, None
    except urllib.error.HTTPError as e:
        elapsed = time.perf_counter() - started
        detail = e.read().decode("utf-8", errors="replace")
        if e.code == 400 and "think" in detail.lower():
            return call_ollama_json_no_think_field(model, prompt)
        return "", elapsed, f"HTTP {e.code}: {detail[:300]}"
    except Exception as e:  # noqa: BLE001
        elapsed = time.perf_counter() - started
        return "", elapsed, f"{type(e).__name__}: {e}"


def call_ollama_json_no_think_field(
    model: str, prompt: str
) -> tuple[str, float, str | None]:
    payload = {
        "model": model,
        "system": REVIEW_SYSTEM,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.0},
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
        with urllib.request.urlopen(req, timeout=180) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        elapsed = time.perf_counter() - started
        raw = (data.get("response") or "").strip()
        if not raw:
            raw = (data.get("thinking") or "").strip()
        return raw, elapsed, None
    except Exception as e:  # noqa: BLE001
        elapsed = time.perf_counter() - started
        return "", elapsed, f"{type(e).__name__}: {e}"


def is_humor_sensitive_bucket(bucket: dict) -> bool:
    """serious レーン類型（humor フレーズ禁止）。"""
    from generate import bucket_phrase_lane

    return bucket_phrase_lane(bucket) == "serious"


def humor_lane_fingerprints() -> list[str]:
    """humor レーンフレーズの特徴部分（真剣類型への混入検出用）。"""
    try:
        from generate import load_humor_phrases

        fps = []
        for p in load_humor_phrases():
            if p.get("lane") != "humor":
                continue
            phrase = p.get("phrase") or ""
            # 先頭〜読点/。までを指紋に
            for sep in ("。", "。", "——", ":"):
                if sep in phrase:
                    phrase = phrase.split(sep)[0]
                    break
            chunk = phrase[:24].strip()
            if chunk:
                fps.append(chunk)
            # 特徴語も追加
            for key in (
                "オールイン",
                "タイトパッシブ",
                "ブラインド",
                "バンクロールがない",
                "ステーキング",
                "バリューハンド",
                "ポーカーマシーン",
                "資本市場というゲーム",
                "ステークスを上げる",
                "タイトパッシブ",
                "オールイン",
            ):
                if key in (p.get("phrase") or ""):
                    fps.append(key)
        return list(dict.fromkeys(fps))
    except Exception:  # noqa: BLE001
        return [
            "オールイン",
            "タイトパッシブ",
            "ブラインド",
            "ステーキング",
            "バリューハンド",
            "ポーカーマシーン",
            "ステークスを上げる",
        ]


def apply_deterministic_overrides(
    bucket: dict, comment: str, judgment: dict
) -> dict:
    """LLMが見落とす典型違反を補完（検査プロンプトの具体例と対応）。"""
    if judgment.get("verdict") == "ERROR":
        return judgment
    checks = dict(judgment.get("checks") or {})
    reasons: list[str] = []
    band = quiz_band(bucket["quiz"])
    asset = str(bucket.get("asset") or "")
    has_motivation_in_input = any(
        k in asset for k in ("学習意欲", "関心が高い", "学ぶ意欲")
    )
    beautify_phrases = (
        "学習意欲も伺え",
        "学習意欲が伺え",
        "学習意欲が高い",
        "関心が高い",
        "学びへの意欲",
        "学習意欲が光",
    )
    if band in {"低", "中"} and not has_motivation_in_input:
        if any(p in comment for p in beautify_phrases) or (
            "学習意欲" in comment and "学ぶ余地" not in comment
        ):
            checks["C3_attribute_beautify"] = True
            reasons.append("C3: クイズ帯が低/中なのに学習意欲・関心を美化している")
    if "少しずな" in comment:
        checks["C4_broken_japanese"] = True
        reasons.append("C4: 脱字『少しずな』")

    if any(m in comment for m in ("(笑)", "（笑）")) or re.search(
        "[\U0001F300-\U0001FAFF]", comment
    ):
        checks["C6_humor_personal_attack"] = True
        reasons.append("C6: 顔文字・絵文字・(笑)が含まれる")

    if is_humor_sensitive_bucket(bucket) and any(
        m in comment for m in humor_lane_fingerprints()
    ):
        checks["C7_humor_sensitive_overkill"] = True
        reasons.append("C7: 真剣類型に humor レーンのフレーズが入っている")

    # C8: ですます と だ・である の混在
    if has_desu_masu(comment) and has_da_dearu(comment):
        checks["C8_style_mix"] = True
        reasons.append("C8: です・ます調とだ・である調が混在")
    elif has_desu_masu(comment) and not has_da_dearu(comment):
        checks["C8_style_mix"] = True
        reasons.append("C8: です・ます調になっておりだ・である調に統一されていない")

    if re.search(r"\bH\d{2}\b", comment) or "H11の" in comment or "型フレーズ" in comment:
        checks["C4_broken_japanese"] = True
        reasons.append("C4: フレーズIDやメタ表現が本文に残っている")

    for k, v in (judgment.get("checks") or {}).items():
        checks.setdefault(k, False)
        if v:
            checks[k] = True
    for key in (
        "C1_amount_numbers",
        "C2_product_promise",
        "C3_attribute_beautify",
        "C4_broken_japanese",
        "C5_condescending",
        "C6_humor_personal_attack",
        "C7_humor_sensitive_overkill",
        "C8_style_mix",
        "C9_invented_metaphor",
    ):
        checks.setdefault(key, False)

    any_fail = any(bool(v) for v in checks.values())
    verdict = "FAIL" if any_fail else "PASS"
    reason = judgment.get("reason") or ""
    if reasons:
        reason = " / ".join(
            reasons + ([reason] if reason and reason != "問題なし" else [])
        )
    elif not reason:
        reason = "問題なし" if verdict == "PASS" else "違反あり"
    return {"checks": checks, "verdict": verdict, "reason": reason}


def review_comment(
    model: str, bucket: dict, comment: str
) -> tuple[dict, float]:
    """1件検査。戻り値: (review_recordの判定部, seconds)"""
    raw, seconds, err = call_ollama_json(model, build_review_prompt(bucket, comment))
    if err:
        return {
            "checks": {},
            "verdict": "ERROR",
            "reason": err,
            "raw": raw,
        }, seconds
    obj = extract_json_object(raw)
    if not obj:
        return {
            "checks": {},
            "verdict": "ERROR",
            "reason": "判定JSONのパースに失敗",
            "raw": raw[:500],
        }, seconds
    try:
        normalized = normalize_verdict(obj)
        normalized = apply_deterministic_overrides(bucket, comment, normalized)
        return normalized, seconds
    except Exception as e:  # noqa: BLE001
        return {
            "checks": {},
            "verdict": "ERROR",
            "reason": f"判定正規化失敗: {e}",
            "raw": raw[:500],
        }, seconds


def load_buckets() -> dict[str, dict]:
    buckets = json.loads(BUCKETS_PATH.read_text(encoding="utf-8"))
    return {b["id"]: b for b in buckets}


def save_reviews(path: Path, reviews: list[dict]) -> None:
    path.write_text(
        json.dumps(reviews, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def print_fail_summary(reviews: list[dict]) -> None:
    bad = [r for r in reviews if r.get("verdict") in {"FAIL", "ERROR"}]
    print("=" * 60)
    print(f"FAIL/ERROR: {len(bad)} / {len(reviews)} 件")
    for r in bad:
        print(f"  - {r['id']} [{r['verdict']}] {r.get('reason', '')}")
    print("=" * 60)


def run_review(
    *,
    results_path: Path = RESULTS_V2_PATH,
    review_path: Path = REVIEW_V2_PATH,
    only_ids: set[str] | None = None,
    merge_existing: bool = False,
) -> list[dict]:
    model = resolve_model()
    buckets = load_buckets()
    results = json.loads(results_path.read_text(encoding="utf-8"))

    reviews: list[dict] = []
    by_id: dict[str, dict] = {}
    if merge_existing and review_path.exists():
        try:
            existing = json.loads(review_path.read_text(encoding="utf-8"))
            if isinstance(existing, list):
                reviews = existing
                by_id = {r["id"]: r for r in reviews if r.get("id")}
        except json.JSONDecodeError:
            reviews = []
            by_id = {}

    targets = [
        r
        for r in results
        if r.get("comment") and (only_ids is None or r.get("id") in only_ids)
    ]

    print(f"使用モデル: {model}")
    print(f"検査対象: {len(targets)} 件")
    print(f"出力先: {review_path}")
    print("-" * 60)

    for i, item in enumerate(targets, start=1):
        bid = item["id"]
        bucket = buckets.get(bid)
        if not bucket:
            record = {
                "id": bid,
                "label": item.get("label"),
                "verdict": "ERROR",
                "reason": "buckets.json に該当IDなし",
                "checks": {},
                "seconds": 0.0,
                "comment": item.get("comment"),
            }
        else:
            print(
                f"[{i}/{len(targets)}] reviewing {bid} — {bucket['label']} ...",
                flush=True,
            )
            judgment, seconds = review_comment(model, bucket, item["comment"])
            record = {
                "id": bid,
                "label": bucket["label"],
                "comment": item["comment"],
                "seconds": round(seconds, 2),
                "model": model,
                **judgment,
            }
            print(
                f"  {record['verdict']} ({seconds:.1f}s): {record.get('reason', '')[:120]}"
            )

        by_id[bid] = record
        # 元の results 順を保つ
        reviews = []
        result_ids = [r["id"] for r in results]
        for rid in result_ids:
            if rid in by_id:
                reviews.append(by_id[rid])
        for rid, rec in by_id.items():
            if rid not in result_ids:
                reviews.append(rec)
        save_reviews(review_path, reviews)

    # 集計
    timed = [r for r in reviews if isinstance(r.get("seconds"), (int, float))]
    avg = sum(r["seconds"] for r in timed) / len(timed) if timed else 0.0
    print_fail_summary(reviews)
    print(f"検査1件あたり平均秒数: {avg:.2f} 秒")
    print(
        f"1600件検査の推定時間: {avg * FULL_PATTERN_COUNT:.0f} 秒 "
        f"（約 {avg * FULL_PATTERN_COUNT / 3600:.2f} 時間）"
    )
    return reviews


def main() -> None:
    p = argparse.ArgumentParser(description="査定コメントセルフレビュー")
    p.add_argument("--results", type=Path, default=RESULTS_V2_PATH)
    p.add_argument("--output", type=Path, default=REVIEW_V2_PATH)
    p.add_argument("--ids", nargs="*", default=None)
    args = p.parse_args()
    only = set(args.ids) if args.ids else None
    run_review(
        results_path=args.results,
        review_path=args.output,
        only_ids=only,
        merge_existing=bool(only),
    )


if __name__ == "__main__":
    main()
