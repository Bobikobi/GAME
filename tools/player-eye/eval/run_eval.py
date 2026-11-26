#!/usr/bin/env python3
"""Run the player-eye eval (eval/cases.json) and print the agreement table. Standard library only.

  run_eval.py [--runs 2] [--only ID ...] [--log FILE.jsonl] [--out FILE.json]

Each call to the judge is one ask-claude call on the owner's credit: cases x runs. Fields of a case: `images`, `roles`,
`note` are what is sent to the judge; `expect` (pass / fail / unsure), `kind` (the task split: size change, clipping, object logic, clean scene), `expect_q` (for a fail: the questions that may
trip it), `why` and `source` (the label's ground truth and who made it) are never sent. A run agrees on the word when
the verdict word equals `expect`; it agrees on the reason when, for an expected fail, some failing question is in
`expect_q`. A case whose picture is missing is skipped. One JSON line per call goes to the log as it happens, an
unreadable answer counts as a disagreement, and a refused credit stops the run cleanly.
"""
import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE.parent))
import review  # noqa: E402


def resolve(p):
    return p if Path(p).is_absolute() else str(ROOT / p)


def one_run(case, questions):
    images = [resolve(p) for p in case["images"]]
    prompt = review.build_prompt(images, [r.replace("=", ": ", 1) for r in case["roles"]], case.get("note", ""), questions)
    data = review.parse_answer(review.judge(prompt, images, "sonnet"), questions)
    line = review.verdict_line(data, questions)
    failing = [q for q, _, _ in questions if data[q]["answer"] == "fail"]
    return {"word": line.split(": ", 1)[1].split(" - ", 1)[0], "line": line, "failing": failing, "frown": str(data.get("frown") or "")}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--runs", type=int, default=2)
    ap.add_argument("--only", nargs="*", default=[])
    ap.add_argument("--log", default="", help="append one JSON line per call")
    ap.add_argument("--out", default="")
    a = ap.parse_args()
    questions = review.read_questions()
    cases = json.loads((HERE / "cases.json").read_text())
    log = open(a.log, "a") if a.log else None
    rows, calls, word_ok, reason_ok, counted, stopped = [], 0, 0, 0, 0, False
    for case in cases:
        if stopped:
            break
        if a.only and case["id"] not in a.only:
            continue
        if not all(Path(resolve(p)).is_file() for p in case["images"]):
            rows.append({"id": case["id"], "skipped": "picture missing"})
            print(f"{case['id']:30} skipped, picture missing", flush=True)
            continue
        got = []
        for _ in range(a.runs):
            try:
                run = one_run(case, questions)
            except ValueError as err:
                run = {"word": "unreadable", "line": str(err), "failing": [], "frown": ""}
            except SystemExit as stop:
                if stop.code == 3:
                    print("credit refused or no judge: stopping the run", file=sys.stderr)
                    stopped = True
                    break
                run = {"word": "unreadable", "line": f"judge exit {stop.code}", "failing": [], "frown": ""}
            calls += 1
            counted += 1
            word_ok += run["word"] == case["expect"]
            ok_reason = run["word"] == case["expect"] and (case["expect"] != "fail" or bool(set(run["failing"]) & set(case.get("expect_q", run["failing"]))))
            reason_ok += ok_reason
            run["word_ok"], run["reason_ok"] = run["word"] == case["expect"], ok_reason
            got.append(run)
            if log:
                log.write(json.dumps({"id": case["id"], **run}, ensure_ascii=False) + "\n")
                log.flush()
        rows.append({"id": case["id"], "expect": case["expect"], "expect_q": case.get("expect_q"), "source": case.get("source"), "runs": got})
        print(f"{case['id']:30} expect {case['expect']:5} got {[(g['word'], g['failing']) for g in got]}", flush=True)
    both = sum(1 for r in rows if r.get("runs") and len(r["runs"]) == a.runs and all(g["word_ok"] for g in r["runs"]))
    both_reason = sum(1 for r in rows if r.get("runs") and len(r["runs"]) == a.runs and all(g["reason_ok"] for g in r["runs"]))
    n = sum(1 for r in rows if r.get("runs"))
    print(f"\nper-run: word {word_ok}/{counted}, word and reason {reason_ok}/{counted}; cases where all {a.runs} runs agree: word {both}/{n}, word and reason {both_reason}/{n}; {calls} ask-claude calls")
    if a.out:
        Path(a.out).write_text(json.dumps({"calls": calls, "word_ok": word_ok, "reason_ok": reason_ok, "counted": counted, "cases_both_word": both, "cases_both_reason": both_reason, "cases": n, "rows": rows}, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
