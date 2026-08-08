#!/usr/bin/env python3
"""FAIL コメントの再生成＋再検査（Ollama ローカルのみ）"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from generate import (  # noqa: E402
    BUCKETS_PATH,
    DIR,
    generate_comment,
    resolve_model,
)
from review import (  # noqa: E402
    RESULTS_V2_PATH,
    REVIEW_V2_PATH,
    review_comment,
    run_review,
    save_reviews,
)

MAX_RETRIES = 2


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def upsert_result(results: list[dict], item: dict) -> list[dict]:
    out = []
    replaced = False
    for r in results:
        if r.get("id") == item["id"]:
            out.append(item)
            replaced = True
        else:
            out.append(r)
    if not replaced:
        out.append(item)
    return out


def upsert_review(reviews: list[dict], item: dict) -> list[dict]:
    return upsert_result(reviews, item)


def main() -> None:
    p = argparse.ArgumentParser(description="FAIL件の再生成と再検査")
    p.add_argument("--results", type=Path, default=RESULTS_V2_PATH)
    p.add_argument("--review", type=Path, default=REVIEW_V2_PATH)
    p.add_argument("--max-retries", type=int, default=MAX_RETRIES)
    p.add_argument(
        "--ensure-review",
        action="store_true",
        help="review が無い／不足なら先に全件検査する",
    )
    args = p.parse_args()

    if args.ensure_review or not args.review.exists():
        print(">>> 先に全件セルフレビューを実行します")
        run_review(results_path=args.results, review_path=args.review)

    reviews = load_json(args.review)
    results = load_json(args.results)
    buckets = {b["id"]: b for b in load_json(BUCKETS_PATH)}
    results_by_id = {r["id"]: r for r in results}

    fail_ids = [r["id"] for r in reviews if r.get("verdict") == "FAIL"]
    print(f"再生成対象(FAIL): {len(fail_ids)} 件 → {fail_ids}")

    model = resolve_model()
    fixed_count = 0
    needs_human_count = 0
    still_fail: list[str] = []

    review_by_id = {r["id"]: r for r in reviews}

    for bid in fail_ids:
        bucket = buckets.get(bid)
        if not bucket:
            print(f"skip {bid}: bucket なし")
            continue
        review_rec = review_by_id[bid]
        reason = review_rec.get("reason") or "品質基準に不合格"
        original = results_by_id.get(bid, {})
        print("-" * 60)
        print(f"再生成: {bid} | 理由: {reason}")

        passed = False
        last_reason = reason
        last_comment = original.get("comment")
        last_review = review_rec
        gen_seconds_total = 0.0

        for attempt in range(1, args.max_retries + 1):
            print(f"  attempt {attempt}/{args.max_retries} ...", flush=True)
            comment, error, seconds = generate_comment(
                model,
                bucket,
                no_think=False,
                fix_reason=last_reason,
            )
            gen_seconds_total += seconds
            if error or not comment:
                last_reason = error or "空コメント"
                print(f"    生成ERROR ({seconds:.1f}s): {last_reason}")
                continue

            judgment, rev_seconds = review_comment(model, bucket, comment)
            print(
                f"    再検査 {judgment['verdict']} ({rev_seconds:.1f}s): "
                f"{judgment.get('reason', '')[:120]}"
            )
            last_comment = comment
            last_review = {
                "id": bid,
                "label": bucket["label"],
                "comment": comment,
                "seconds": round(rev_seconds, 2),
                "model": model,
                "regen_attempt": attempt,
                **judgment,
            }
            last_reason = judgment.get("reason") or last_reason

            updated = {
                **original,
                "id": bid,
                "label": bucket["label"],
                "model": model,
                "seconds": round(seconds, 2),
                "comment": comment,
                "error": None,
                "no_think": False,
                "tag": "v2-regen",
                "regen_attempt": attempt,
                "regen_fix_reason": reason if attempt == 1 else last_reason,
            }
            # needs_human は一旦クリア
            updated.pop("needs_human", None)

            results = upsert_result(results, updated)
            write_json(args.results, results)
            results_by_id[bid] = updated

            reviews = upsert_review(reviews, last_review)
            save_reviews(args.review, reviews)
            review_by_id[bid] = last_review

            if judgment.get("verdict") == "PASS":
                passed = True
                fixed_count += 1
                print(f"    → PASS に到達（attempt {attempt}）")
                break

            # 次の試行用に最新の不合格理由を渡す
            last_reason = judgment.get("reason") or last_reason

        if not passed:
            needs_human_count += 1
            still_fail.append(bid)
            updated = {
                **results_by_id.get(bid, {}),
                "id": bid,
                "label": bucket["label"],
                "comment": last_comment,
                "needs_human": True,
                "tag": "v2-needs-human",
            }
            results = upsert_result(results, updated)
            write_json(args.results, results)
            last_review = {
                **last_review,
                "verdict": last_review.get("verdict") or "FAIL",
                "needs_human": True,
            }
            reviews = upsert_review(reviews, last_review)
            save_reviews(args.review, reviews)
            print(f"    → needs_human フラグ付与")

    # 最終集計
    reviews = load_json(args.review)
    results = load_json(args.results)
    pass_n = sum(1 for r in reviews if r.get("verdict") == "PASS")
    fail_n = sum(1 for r in reviews if r.get("verdict") == "FAIL")
    err_n = sum(1 for r in reviews if r.get("verdict") == "ERROR")
    human_n = sum(1 for r in results if r.get("needs_human"))
    review_secs = [r["seconds"] for r in reviews if isinstance(r.get("seconds"), (int, float))]
    avg_review = sum(review_secs) / len(review_secs) if review_secs else 0.0

    print("=" * 60)
    print("===== 最終レポート =====")
    print(f"PASS件数: {pass_n}")
    print(f"再生成で直った件数: {fixed_count}")
    print(f"needs_human件数: {human_n} {still_fail}")
    print(f"残FAIL: {fail_n} / ERROR: {err_n}")
    print(f"検査1件あたり平均秒数: {avg_review:.2f} 秒")
    print(
        f"1600件検査の推定時間: {avg_review * 1600:.0f} 秒 "
        f"（約 {avg_review * 1600 / 3600:.2f} 時間）"
    )
    print("=" * 60)


if __name__ == "__main__":
    main()
