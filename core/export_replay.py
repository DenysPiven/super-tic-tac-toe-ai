"""
Run one bot-vs-bot game and save to frontend/replays/ with list.json for UI.
Usage: python -m core.export_replay [--count N]
Saves replays to frontend/replays/<timestamp>.json and updates replays/list.json.
"""

import json
import random
import sys
from datetime import datetime
from pathlib import Path

from core.game import get_legal_moves, get_result, initial_state, is_terminal, make_move

REPLAYS_DIR = Path(__file__).resolve().parent.parent / "frontend" / "replays"
LIST_FILE = REPLAYS_DIR / "list.json"


def run_one_game() -> tuple[list[list[int]], str, int]:
    state = initial_state()
    moves: list[list[int]] = []
    while not is_terminal(state):
        moves = get_legal_moves(state)
        if not moves:
            break
        move = random.choice(moves)
        moves.append([move[0], move[1]])
        state = make_move(state, move)
    result = get_result(state) or "draw"
    return moves, result, len(moves)


def ensure_list() -> list[dict]:
    if LIST_FILE.exists():
        data = json.loads(LIST_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    return []


def run_and_export(count: int = 1) -> None:
    REPLAYS_DIR.mkdir(parents=True, exist_ok=True)
    entries = ensure_list()
    for idx in range(count):
        moves, result, steps = run_one_game()
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        suffix = f"_{idx + 1}" if count > 1 else ""
        filename = f"replay_{ts}{suffix}.json"
        path = REPLAYS_DIR / filename
        path.write_text(
            json.dumps({"moves": moves, "result": result, "steps": steps}, indent=2),
            encoding="utf-8",
        )
        entries.append({
            "file": filename,
            "result": result,
            "steps": steps,
            "date": ts,
        })
        print("Saved:", path.name, "| moves:", steps, "| result:", result)
    LIST_FILE.write_text(json.dumps(entries, indent=2), encoding="utf-8")
    print("List:", LIST_FILE)


if __name__ == "__main__":
    count = 1
    if len(sys.argv) > 1 and sys.argv[1] == "--count" and len(sys.argv) > 2:
        count = int(sys.argv[2])
    elif len(sys.argv) > 1 and sys.argv[1].isdigit():
        count = int(sys.argv[1])
    run_and_export(count)
