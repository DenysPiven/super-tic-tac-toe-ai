"""
Ultimate Tic-Tac-Toe game core.
Rules: https://en.wikipedia.org/wiki/Ultimate_tic-tac-toe

State is immutable. Use get_legal_moves(), make_move(), is_terminal(), get_result()
for training and inference.
"""

from dataclasses import dataclass
from typing import Literal

Player = Literal["X", "O"]
Result = Literal["X", "O", "draw"]
# Move = (big_idx, small_idx), each 0..8
Move = tuple[int, int]

# Winning lines for a 3x3 board (indices 0..8)
_LINES_3 = [
    (0, 1, 2), (3, 4, 5), (6, 7, 8),  # rows
    (0, 3, 6), (1, 4, 7), (2, 5, 8),  # cols
    (0, 4, 8), (2, 4, 6),              # diags
]


@dataclass(frozen=True)
class State:
    """Immutable game state."""

    big: tuple[str, ...]  # 9 cells: '', 'X', or 'O'
    small: tuple[tuple[str, ...], ...]  # 9x9
    current_player: Player
    available_big: int  # -1 = any, 0..8 = must play in that board, -2 = game over

    def __post_init__(self) -> None:
        assert len(self.big) == 9
        assert len(self.small) == 9 and all(len(row) == 9 for row in self.small)
        assert self.current_player in ("X", "O")
        assert -2 <= self.available_big <= 8


def initial_state() -> State:
    return State(
        big=("",) * 9,
        small=tuple((("",) * 9) for _ in range(9)),
        current_player="X",
        available_big=-1,
    )


def _check_line_3(cells: tuple[str, ...], a: int, b: int, c: int) -> bool:
    return cells[a] != "" and cells[a] == cells[b] and cells[b] == cells[c]


def _small_winner(small_board: tuple[str, ...]) -> str | None:
    for a, b, c in _LINES_3:
        if _check_line_3(small_board, a, b, c):
            return small_board[a]
    return None


def _big_winner(big: tuple[str, ...]) -> str | None:
    for a, b, c in _LINES_3:
        if big[a] != "" and big[a] == big[b] and big[b] == big[c]:
            return big[a]
    return None


def get_legal_moves(state: State) -> list[Move]:
    """Return list of (big_idx, small_idx) legal moves."""
    if state.available_big == -2:
        return []
    if state.available_big == -1:
        boards = [i for i in range(9) if state.big[i] == ""]
    else:
        boards = [state.available_big]
    moves: list[Move] = []
    for i in boards:
        for j in range(9):
            if state.small[i][j] == "":
                moves.append((i, j))
    return moves


def make_move(state: State, move: Move) -> State:
    """Return new state after playing move. Assumes move is legal."""
    i, j = move
    player = state.current_player

    # Update small board
    new_row = list(state.small[i])
    new_row[j] = player
    new_small = list(state.small)
    new_small[i] = tuple(new_row)
    new_small_t = tuple(new_small)

    # Check if small board is won (if draw: full but no line — big cell stays "")
    new_big_list = list(state.big)
    if _small_winner(new_small_t[i]):
        new_big_list[i] = player
    # else: small board draw or not finished → big[i] unchanged ("" or already set)
    new_big = tuple(new_big_list)

    # Game over?
    if _big_winner(new_big):
        return State(
            big=new_big,
            small=new_small_t,
            current_player="O" if player == "X" else "X",
            available_big=-2,
        )

    # Next board = where we played (small_idx)
    next_big = j
    next_has_empty = new_big[next_big] == "" and any(
        new_small_t[next_big][k] == "" for k in range(9)
    )
    available_big = -1 if (new_big[next_big] != "" or not next_has_empty) else next_big

    next_player: Player = "O" if player == "X" else "X"

    return State(
        big=new_big,
        small=new_small_t,
        current_player=next_player,
        available_big=available_big,
    )


def is_terminal(state: State) -> bool:
    """True if game is over (win or draw)."""
    if state.available_big == -2:
        return True
    return len(get_legal_moves(state)) == 0


def get_result(state: State) -> Result | None:
    """
    Return winner ('X' or 'O') or 'draw' if terminal, else None.
    Call only when is_terminal(state) is True.
    """
    if not is_terminal(state):
        return None
    if state.available_big == -2:
        w = _big_winner(state.big)
        return w if w else "draw"
    # No legal moves and no big winner
    return "draw"


if __name__ == "__main__":
    import random

    state = initial_state()
    while not is_terminal(state):
        moves = get_legal_moves(state)
        move = random.choice(moves)
        state = make_move(state, move)
    print("Result:", get_result(state))
    print("Legal moves count at start:", len(get_legal_moves(initial_state())))
