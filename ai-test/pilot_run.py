#!/usr/bin/env python3
"""パイロット100件: 生成 → 検査 → FAIL再生成（Ollama localhost のみ）"""

from __future__ import annotations

import json
import time
from pathlib import Path

from generate import generate_comment, resolve_model
from review import review_comment

DIR = Path(__file__).resolve().parent
PILOT_PATH = DIR / "pilot-100.json"
RESULTS_PATH = DIR / "pilot-results.json"
REVIEW_PATH = DIR / "pilot-review.json"
MAX_RETRIES = 2


def profile_as_bucket(profile: dict) -> dict:
    """review / generate 共用の辞書へ正規化。"""
    return {
        **profile,
        "id": profile.get("pilotId") or profile.get("bucketId"),
        "label": profile.get("groupLabel") or profile.get("bucketId"),
        "age": 30,
        "asset": profile.get("text") or "",
        "quiz": {"low": 20, "mid": 60, "high": 90}.get(
            (profile.get("axes") or {}).get("quizBand"), 60
        ),
    }


def save(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    if not PILOT_PATH.exists():
        raise SystemExit(f"missing {PILOT_PATH} — run pilot-sample.ts first")

    pilots: list[dict] = json.loads(PILOT_PATH.read_text(encoding="utf-8"))
    model = resolve_model()
    print(f"model={model} pilots={len(pilots)}")

    results: list[dict] = []
    if RESULTS_PATH.exists():
        try:
            results = json.loads(RESULTS_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            results = []
    done = {r.get("pilotId") for r in results if r.get("comment") and not r.get("error")}

    # —— 生成 ——
    for i, profile in enumerate(pilots, start=1):
        pid = profile["pilotId"]
        if pid in done:
            print(f"[{i}/100] skip {pid}")
            continue
        print(f"[{i}/100] gen {pid} {profile.get('bucketId')} {profile.get('spotlight') or ''}", flush=True)
        bucket = profile_as_bucket(profile)
        comment, error, seconds = generate_comment(model, bucket, no_think=False)
        item = {
            **profile,
            "model": model,
            "seconds": round(seconds, 2),
            "comment": comment,
            "error": error,
            "needs_human": False,
        }
        results = [r for r in results if r.get("pilotId") != pid]
        results.append(item)
        save(RESULTS_PATH, results)
        if error:
            print(f"  ERROR {seconds:.1f}s {error}")
        else:
            print(f"  OK {seconds:.1f}s {(comment or '')[:80].replace(chr(10), ' ')}...")

    # —— 検査＋再生成 ——
    results = json.loads(RESULTS_PATH.read_text(encoding="utf-8"))
    by_id = {r["pilotId"]: r for r in results}
    reviews: list[dict] = []
    if REVIEW_PATH.exists():
        try:
            reviews = json.loads(REVIEW_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            reviews = []
    reviewed_ids = {r.get("pilotId") for r in reviews if r.get("verdict")}
    fixed = sum(1 for r in results if r.get("regen_attempt") and not r.get("needs_human"))
    needs_human = sum(1 for r in results if r.get("needs_human"))

    # 疑似 buckets for review (need id matching occupation fields minimally)
    fake_bucket_base = {
        "edu": "大学卒",
        "income": 500,
    }

    for i, profile in enumerate(pilots, start=1):
        pid = profile["pilotId"]
        item = by_id.get(pid)
        if pid in reviewed_ids:
            print(f"[{i}/100] skip-review {pid}", flush=True)
            continue
        if not item or not item.get("comment"):
            reviews.append({
                "id": pid,
                "pilotId": pid,
                "bucketId": profile.get("bucketId"),
                "verdict": "ERROR",
                "reason": "コメントなし",
                "checks": {},
                "seconds": 0,
            })
            reviewed_ids.add(pid)
            save(REVIEW_PATH, reviews)
            continue

        bucket = {
            **fake_bucket_base,
            "id": profile["bucketId"],
            "label": profile.get("groupLabel", ""),
            "age": 35,
            "asset": profile.get("text", ""),
            "quiz": 30 if (profile.get("axes") or {}).get("quizBand") == "low" else 60,
        }
        # G8/serious: C7判定用 — phraseLane serious なら humor混入チェックを緩和するため
        # asset 文字列に類型情報を残す
        print(f"[{i}/100] review {pid}...", flush=True)
        judgment, sec = review_comment(model, bucket, item["comment"])
        attempt = 0
        while judgment.get("verdict") == "FAIL" and attempt < MAX_RETRIES:
            attempt += 1
            reason = judgment.get("reason") or "FAIL"
            print(f"  FAIL → regen {attempt}: {reason[:100]}", flush=True)
            comment, error, gsec = generate_comment(
                model,
                profile_as_bucket(profile),
                no_think=False,
                fix_reason=reason,
            )
            if error or not comment:
                judgment = {"verdict": "ERROR", "reason": error or "空", "checks": {}}
                break
            item = {
                **item,
                "comment": comment,
                "seconds": round(gsec, 2),
                "error": None,
                "regen_attempt": attempt,
            }
            by_id[pid] = item
            judgment, sec = review_comment(model, bucket, comment)
            print(f"  re-review {judgment.get('verdict')} ({sec:.1f}s)", flush=True)

        if judgment.get("verdict") == "PASS":
            if attempt:
                fixed += 1
            item["needs_human"] = False
        else:
            needs_human += 1
            item["needs_human"] = True
            item["tag"] = "pilot-needs-human"

        by_id[pid] = item
        reviews = [r for r in reviews if r.get("pilotId") != pid]
        reviews.append({
            "id": pid,
            "pilotId": pid,
            "bucketId": profile.get("bucketId"),
            "spotlight": profile.get("spotlight"),
            "seconds": round(sec, 2),
            "model": model,
            "comment": item.get("comment"),
            **judgment,
            "needs_human": item.get("needs_human", False),
        })
        reviewed_ids.add(pid)
        # 逐次保存
        save(RESULTS_PATH, [by_id[p["pilotId"]] for p in pilots if p["pilotId"] in by_id])
        save(REVIEW_PATH, reviews)

    results = [by_id[p["pilotId"]] for p in pilots if p["pilotId"] in by_id]
    save(RESULTS_PATH, results)
    save(REVIEW_PATH, reviews)

    pass_n = sum(1 for r in reviews if r.get("verdict") == "PASS")
    human_n = sum(1 for r in results if r.get("needs_human"))
    gen_secs = [r["seconds"] for r in results if isinstance(r.get("seconds"), (int, float))]
    avg = sum(gen_secs) / len(gen_secs) if gen_secs else 0
    print("=" * 60)
    print(f"PASS: {pass_n}/100")
    print(f"再生成で改善: {fixed}")
    print(f"needs_human: {human_n}")
    print(f"平均生成秒数: {avg:.2f}")
    print(f"1395件フル生成推定: {avg * 1395 / 3600:.2f} 時間")
    print("=" * 60)

    # スポットライト全文
    print("\n===== 難所6件 =====\n")
    for r in results:
        if not r.get("spotlight"):
            continue
        print(f"■ {r['pilotId']} | {r['spotlight']} | {r['bucketId']}")
        print(f"  lane={r.get('phraseLane')} suggest={r.get('suggestedPhraseIds')}")
        print(r.get("comment") or "(empty)")
        print()


if __name__ == "__main__":
    t0 = time.time()
    main()
    print(f"elapsed_min={(time.time() - t0) / 60:.1f}")
