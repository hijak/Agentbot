#!/usr/bin/env python3
"""Small newline-delimited JSON worker for the local Laya-MLX model."""

from __future__ import annotations

import contextlib
import json
import sys
from typing import Any

MODEL_ID = "aac6fef/laya-typed-decisions-mlx"
protocol_out = sys.stdout
agent = None


def load_agent():
    global agent
    if agent is not None:
        return agent
    with contextlib.redirect_stdout(sys.stderr):
        import laya_mlx as laya

        agent = laya.load(MODEL_ID, dtype="float16")
    return agent


def json_default(value: Any):
    if hasattr(value, "tolist"):
        return value.tolist()
    if hasattr(value, "item"):
        return value.item()
    return str(value)


def run_decision(request: dict[str, Any]):
    state = request.get("state")
    instructions = request.get("instructions")
    criteria = request.get("criteria")
    if not isinstance(state, dict) or not isinstance(instructions, str):
        raise ValueError("A decision needs state and instructions.")
    if not isinstance(criteria, dict) or len(criteria) < 2:
        raise ValueError("A decision needs at least two choices.")
    question = {
        "target": {
            "type": "choice",
            "instructions": instructions,
            "criteria": {str(key): str(value) for key, value in criteria.items()},
        }
    }
    with contextlib.redirect_stdout(sys.stderr):
        result = load_agent().predict(state, question)
    answers = result.get("answers", {}) if isinstance(result, dict) else {}
    answer = answers.get("target") if isinstance(answers, dict) else None
    return json.loads(json.dumps(answer, default=json_default, ensure_ascii=False))


for line in sys.stdin:
    request: Any = {}
    try:
        request = json.loads(line)
        if not isinstance(request, dict):
            raise ValueError("Each worker line must be a JSON object.")
        request_id = str(request.get("id", ""))
        answer = run_decision(request)
        response = {"id": request_id, "ok": True, "result": answer}
    except Exception as error:  # Return one bounded failure per request.
        response = {
            "id": str(request.get("id", "")) if isinstance(request, dict) else "",
            "ok": False,
            "error": str(error)[:1000],
        }
    protocol_out.write(json.dumps(response, ensure_ascii=False, separators=(",", ":")) + "\n")
    protocol_out.flush()
