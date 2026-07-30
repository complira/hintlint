import argparse
import json
import re
import sys
from pathlib import Path

MODEL = {
    "name": "hintlint-keyword-baseline",
    "version": "0.1.0",
    "kind": "advisory-baseline"
}

DESTRUCTIVE = re.compile(r"\b(delete|destroy|drop|truncate|terminate|revoke|remove)\b", re.I)
WRITE = re.compile(r"\b(create|update|insert|save|approve|archive|sync|publish|submit|send)\b", re.I)
EXTERNAL = re.compile(r"\b(send|email|http|url|github|stripe|sendgrid|webhook|publish)\b", re.I)
AMBIGUOUS = re.compile(r"\b(archive|sync|reconcile|rotate|approve|close|submit|publish)\b", re.I)


def read_jsonl(path):
    with Path(path).open("r", encoding="utf8") as handle:
        for line_no, line in enumerate(handle, start=1):
            stripped = line.strip()
            if not stripped:
                continue
            try:
                yield json.loads(stripped)
            except json.JSONDecodeError as exc:
                raise SystemExit(f"invalid JSONL at {path}:{line_no}: {exc}") from exc


def advice_for(record):
    text = " ".join([
        record.get("text", ""),
        record.get("tool", {}).get("name", ""),
        " ".join(record.get("evidence", {}).get("categories", [])),
        " ".join(record.get("evidence", {}).get("sink_kinds", [])),
        " ".join(record.get("evidence", {}).get("unsafe_flows", [])),
    ])
    has_source_evidence = bool(record.get("evidence", {}).get("source_backed"))
    destructive = bool(DESTRUCTIVE.search(text))
    write = destructive or bool(WRITE.search(text))
    external = bool(EXTERNAL.search(text)) or bool(record.get("evidence", {}).get("unsafe_flows"))
    ambiguous = bool(AMBIGUOUS.search(text))

    if has_source_evidence:
        confidence = "needs_review"
        reason = "Source evidence already exists; ML stays advisory and should not override deterministic findings."
    elif ambiguous or write or external:
        confidence = "likely"
        reason = "Keyword baseline found behavior terms that may need human review."
    else:
        confidence = "unknown"
        reason = "Keyword baseline did not find enough evidence for an advisory label."

    return {
        "record_version": "hintlint.ml-advice.v1",
        "tool": record.get("tool", {}).get("name", ""),
        "confidence": confidence,
        "labels": {
            "read_only": not write and not external,
            "writes_internal_state": write and not external,
            "external_side_effect": external,
            "destructive": destructive,
            "open_world": external,
            "requires_human_approval": destructive or external or ambiguous,
        },
        "reason": reason,
        "model": MODEL,
        "features": {
            "has_source_evidence": has_source_evidence,
            "keyword_destructive": destructive,
            "keyword_write": write,
            "keyword_external": external,
            "keyword_ambiguous": ambiguous,
        },
    }


def write_jsonl(path, records):
    output = "\n".join(json.dumps(record, sort_keys=True) for record in records) + "\n"
    if path == "-":
        sys.stdout.write(output)
        return
    Path(path).write_text(output, encoding="utf8")


def main(argv=None):
    parser = argparse.ArgumentParser(description="Run HintLint advisory ML baseline classification.")
    parser.add_argument("--input", required=True, help="HintLint ML feature JSONL path.")
    parser.add_argument("--output", default="-", help="ML advice JSONL path. Defaults to stdout.")
    args = parser.parse_args(argv)

    records = [advice_for(record) for record in read_jsonl(args.input)]
    write_jsonl(args.output, records)


if __name__ == "__main__":
    main()
