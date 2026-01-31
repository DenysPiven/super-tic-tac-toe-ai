"""
Encode game State to a fixed-size vector for the neural network.
State: big (9), small (9x9), current_player, available_big.
Values: 0 empty, +1 X, -1 O (from current player view: +1 me, -1 opponent).
"""

import sys
from pathlib import Path

import numpy as np

# Add project root for core
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.game import State

# State vector: big 9 + small 81 + current_player 1 + available_big 10 one-hot = 101
STATE_DIM = 9 + 81 + 1 + 10
MOVE_DIM = 81  # move index = big_idx * 9 + small_idx


def move_to_index(move: tuple[int, int]) -> int:
    """Convert (big_idx, small_idx) to index 0..80."""
    i, j = move
    return i * 9 + j


def index_to_move(idx: int) -> tuple[int, int]:
    """Convert index 0..80 to (big_idx, small_idx)."""
    return idx // 9, idx % 9


def encode_state(state: State) -> np.ndarray:
    """
    Encode state to vector of shape (STATE_DIM,).
    From current player's view: +1 = my piece, -1 = opponent, 0 = empty.
    """
    out = np.zeros(STATE_DIM, dtype=np.float32)
    me = 1.0 if state.current_player == "X" else -1.0
    opp = -1.0 if state.current_player == "X" else 1.0

    # Big board (9)
    for i in range(9):
        if state.big[i] == "X":
            out[i] = me
        elif state.big[i] == "O":
            out[i] = opp

    # Small boards (81)
    for i in range(9):
        for j in range(9):
            cell = state.small[i][j]
            idx = 9 + i * 9 + j
            if cell == "X":
                out[idx] = me
            elif cell == "O":
                out[idx] = opp

    # Current player: +1 X, -1 O (redundant with "me" but explicit)
    out[90] = me

    # Available big: one-hot 10 (index 91 = any, 92..100 = board 0..8)
    ab = state.available_big
    if ab == -1:
        out[91] = 1.0
    elif 0 <= ab <= 8:
        out[92 + ab] = 1.0

    return out


def legal_mask(state: State) -> np.ndarray:
    """Return boolean array of shape (81,) — True where move is legal."""
    from core.game import get_legal_moves

    mask = np.zeros(MOVE_DIM, dtype=np.float32)
    for move in get_legal_moves(state):
        mask[move_to_index(move)] = 1.0
    return mask
