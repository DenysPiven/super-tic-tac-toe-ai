"""
Self-play data collection: run games with random bot, record (state, move, reward).

Reward structure:
- **Terminal** (main): +1 win big board, -1 loss, 0 draw. Winning the big board matters most.
- **Intermediate**: small bonus when a move wins a small board (captures a big cell).
  Teaches that taking small boards is good; big-board win stays the main goal.
"""

import random
import sys
from pathlib import Path
from typing import Iterator

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.game import (
    State,
    get_legal_moves,
    get_result,
    initial_state,
    is_terminal,
    make_move,
)
from training.state_encoder import encode_state, legal_mask, move_to_index, STATE_DIM

# Bonus when this move wins a small board (captures one of the 9 big cells).
# Kept smaller than 1.0 so big-board win/loss stays the main signal.
SMALL_BOARD_BONUS = 0.15

# One sample: (state_vector, move_index, reward, legal_mask)
Sample = tuple[np.ndarray, int, float, np.ndarray]


def collect_one_game(small_bonus: float = SMALL_BOARD_BONUS) -> list[Sample]:
    """
    Play one random vs random game. Return list of (state_enc, move_idx, reward, legal_mask).
    Reward = terminal (win/loss/draw) + small_bonus if that move won a small board.
    """
    state = initial_state()
    trajectory: list[tuple[np.ndarray, int, bool, np.ndarray]] = []  # (enc, move_idx, won_small, mask)

    while not is_terminal(state):
        moves = get_legal_moves(state)
        if not moves:
            break
        move = random.choice(moves)
        enc = encode_state(state)
        move_idx = move_to_index(move)
        mask = legal_mask(state)
        big_before = state.big
        state = make_move(state, move)
        i = move[0]
        won_small = big_before[i] == "" and state.big[i] != ""
        trajectory.append((enc, move_idx, won_small, mask))

    result = get_result(state)
    if result == "draw":
        terminal = [0.0] * len(trajectory)
    else:
        terminal = []
        for k in range(len(trajectory)):
            if k % 2 == 0:  # X moved
                t = 1.0 if result == "X" else (-1.0 if result == "O" else 0.0)
            else:  # O moved
                t = 1.0 if result == "O" else (-1.0 if result == "X" else 0.0)
            terminal.append(t)

    return [
        (enc, move_idx, t + (small_bonus if won_small else 0.0), mask)
        for (enc, move_idx, won_small, mask), t in zip(trajectory, terminal)
    ]


def collect_games(n_games: int, small_bonus: float | None = None) -> Iterator[Sample]:
    """Yield (state, move, reward) samples from n_games self-play games."""
    bonus = small_bonus if small_bonus is not None else SMALL_BOARD_BONUS
    for _ in range(n_games):
        for sample in collect_one_game(small_bonus=bonus):
            yield sample


if __name__ == "__main__":
    samples = list(collect_one_game())
    print("Game length:", len(samples))
    if samples:
        s, m, r, mask = samples[0]
        print("State shape:", s.shape, "move:", m, "reward:", r, "mask sum:", mask.sum())
