#!/usr/bin/env python3
"""Player-eye reviewer: an experienced gamer's eye on one picture, a scene, a still, a clip sheet or an object
(.claude/skills/player-eye/SKILL.md). Standard library only.

  review.py --image PATH [--image PATH ...] --role "name=role" [--role ...] [--note TEXT] [--model sonnet]
  review.py ... --print-prompt      only print the request, so any session can judge with its own eyes

The questions are read from the skill, so there is one copy of them. The judge is `ask-claude --model sonnet --image ...`
when it is on the PATH (one plain API call on the owner's monthly credit). Prints a JSON verdict. Exit codes:
0 verdict printed; 2 bad usage; 3 no judge (credit refused, exit 8 of ask-claude, or ask-claude missing): judge by eye
with the skill; 4 the judge's answer could not be read (printed raw on stderr).
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

SKILL = Path(__file__).resolve().parents[2] / ".claude" / "skills" / "player-eye" / "SKILL.md"
ANSWERS = ("pass", "fail", "unsure")


def read_questions(skill=SKILL):
    """[(id, title, text)] from the skill's "The questions" section: `- **Q1 Title.** text`, text may wrap."""
    body = skill.read_text(encoding="utf-8")
    section = re.search(r"^## The questions\n(.*?)(?=^## )", body, re.S | re.M)
    if not section:
        raise SystemExit(f"no '## The questions' section in {skill}")
    found = re.findall(r"^- \*\*(Q\d) ([^*]+?)\.\*\* (.*?)(?=\n\s*\n|^- \*\*Q\d|\Z)", section.group(1), re.S | re.M)
    if not found:
        raise SystemExit(f"no '- **Q1 Title.** text' items in {skill}")
    return [(q, title, " ".join(text.split())) for q, title, text in found]


def build_prompt(images, roles, note, questions):
    lines = [
        "You are an experienced player of action RPGs who has never seen this game's code or documents. You sit down and look at",
        "the picture the way a player does: do I get what this is and what I can do, do I believe what a body does here, is it the",
        "same everywhere and from frame to frame, does anything make me stop and frown. Answer in a player's plain words (\"why did",
        "the stone just change?\", \"why is he standing in the tree?\"), never developer words like sprite, scale, anchor or frame data.",
        "",
        "Pictures, in the order attached: " + "; ".join(f"{i}. {Path(p).name}" for i, p in enumerate(images, 1)) + ".",
        "What is in the picture, and what each thing is meant to be in the game (judge the picture against it):",
        *[f"- {r}" for r in roles],
    ]
    if note:
        lines += ["Note from the submitter: " + note]
    lines += ["", "Answer these four questions, each pass, fail or unsure, with one line of reason that names what you see:"]
    lines += [f"{q} {title}. {text}" for q, title, text in questions]
    lines += [
        "",
        "Not your job, never judge them: sizes in pixels, palettes, outlines, frame counts (code measures those), art style, colour",
        "or taste, and story text. A question about the look only goes in \"open\"; leave the four answers on logic.",
        "The game's camera looks down at a slant: people are seen from above and slightly in front, objects at a slight angle, all in one",
        "picture style. Do not count that difference of angle as a fault.",
        "Use `unsure` only when the picture itself cannot answer one of the four questions (for example no figure beside the object to",
        "compare size); then say in \"ask\" what one plain question would settle it. Never use `unsure` for how the game works",
        "(what a prompt means, what an unseen action looks like, what the camera is): judge what you can see and put the rest in \"frown\".",
        "\"frown\" is one more line: what would make you stop and frown that the answers did not say, or empty.",
        "",
        "Reply with JSON only, no other text, in exactly this shape:",
        '{"Q1": {"answer": "pass|fail|unsure", "reason": "one line"}, "Q2": {...}, "Q3": {...}, "Q4": {...},',
        ' "frown": "one line or empty", "ask": "the one question for the owner, or empty", "open": ["a look-only question, if any"]}',
    ]
    return "\n".join(lines)


def parse_answer(text, questions):
    """The judge's JSON (it may wrap it in a code fence) checked against the questions."""
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        raise ValueError("no JSON object in the answer")
    data = json.loads(match.group(0))
    for q, _, _ in questions:
        entry = data.get(q)
        if not isinstance(entry, dict) or str(entry.get("answer", "")).lower() not in ANSWERS:
            raise ValueError(f"{q} has no pass, fail or unsure answer")
        entry["answer"] = entry["answer"].lower()
        entry["reason"] = " ".join(str(entry.get("reason", "")).split())
    return data


def verdict_line(data, questions):
    """The first failing question decides; with none failing, any unsure; else pass (the skill's rule)."""
    for q, _, _ in questions:
        if data[q]["answer"] == "fail":
            return f"Player eye: fail - {q} {data[q]['reason']}"
    for q, _, _ in questions:
        if data[q]["answer"] == "unsure":
            ask = str(data.get("ask") or "").strip() or data[q]["reason"]
            return f"Player eye: unsure - {ask}"
    return "Player eye: pass"


def judge(prompt, images, model):
    """ask-claude's answer text; SystemExit 3 when there is no judge to ask."""
    if not shutil.which("ask-claude"):
        raise SystemExit("player-eye: no ask-claude on this machine - judge by eye with the skill (use --print-prompt).") from None
    cmd = ["ask-claude", "--model", model]
    for p in images:
        cmd += ["--image", p]
    done = subprocess.run(cmd, input=prompt, capture_output=True, text=True)
    if done.returncode == 8:
        print("player-eye: ask-claude refused (credit refused or past its mark) - judge by eye with the skill (use --print-prompt).", file=sys.stderr)
        raise SystemExit(3)
    if done.returncode != 0:
        print(f"player-eye: ask-claude failed with exit {done.returncode}: {done.stderr.strip()}", file=sys.stderr)
        raise SystemExit(4)
    return done.stdout


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--image", action="append", default=[], metavar="PATH", help="a picture; repeat for more (one still, a sheet, or frames)")
    ap.add_argument("--role", action="append", default=[], metavar="name=role", help="an object in the picture and its role; repeat")
    ap.add_argument("--note", default="", help="anything the judge needs that the picture cannot say (e.g. the figure's size)")
    ap.add_argument("--model", default="sonnet", choices=["haiku", "sonnet", "opus"])
    ap.add_argument("--print-prompt", action="store_true", help="print the request and stop, to judge with your own eyes")
    a = ap.parse_args(argv)
    if not a.image:
        ap.error("give at least one --image PATH")
    if not a.role:
        ap.error('give at least one --role "name=role"')
    bad = [r for r in a.role if "=" not in r or not r.split("=", 1)[0].strip() or not r.split("=", 1)[1].strip()]
    if bad:
        ap.error(f'--role wants "name=role", got: {bad[0]}')
    missing = [p for p in a.image if not Path(p).is_file()]
    if missing:
        ap.error(f"no such picture: {missing[0]}")
    roles = [f"{r.split('=', 1)[0].strip()}: {r.split('=', 1)[1].strip()}" for r in a.role]
    questions = read_questions()
    prompt = build_prompt(a.image, roles, a.note, questions)
    if a.print_prompt:
        print(prompt)
        return 0
    raw = judge(prompt, a.image, a.model)
    try:
        data = parse_answer(raw, questions)
    except ValueError as err:
        print(f"player-eye: could not read the judge's answer ({err}):\n{raw}", file=sys.stderr)
        return 4
    out = {q: data[q] for q, _, _ in questions}
    out["frown"] = str(data.get("frown") or "").strip()
    out["open"] = [str(x) for x in data.get("open") or []]
    out["verdict"] = verdict_line(data, questions)
    print(json.dumps(out, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
