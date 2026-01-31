"""
Policy network: state -> logits over 81 moves.
Trained with reward-weighted cross-entropy (good moves up, bad moves down).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import torch
import torch.nn as nn

from training.state_encoder import STATE_DIM, MOVE_DIM


class PolicyNet(nn.Module):
    """MLP: state (STATE_DIM) -> logits (81)."""

    def __init__(self, hidden: int = 256, num_layers: int = 3):
        super().__init__()
        layers = []
        dims = [STATE_DIM] + [hidden] * num_layers
        for i in range(len(dims) - 1):
            layers.append(nn.Linear(dims[i], dims[i + 1]))
            layers.append(nn.ReLU())
            layers.append(nn.LayerNorm(dims[i + 1]))
        self.backbone = nn.Sequential(*layers)
        self.head = nn.Linear(hidden, MOVE_DIM)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (batch, STATE_DIM)
        h = self.backbone(x)
        return self.head(h)  # (batch, 81)


def policy_loss(
    logits: torch.Tensor,
    move_idx: torch.Tensor,
    reward: torch.Tensor,
    legal_mask: torch.Tensor | None = None,
) -> torch.Tensor:
    """
    Reward-weighted cross-entropy: we want to increase P(move) when reward > 0.
    loss = -reward * log(softmax(logits)[move]). Mean over batch.
    If legal_mask is set, mask illegal logits with -1e9 before softmax.
    """
    if legal_mask is not None:
        logits = logits.masked_fill(legal_mask == 0, -1e9)
    log_probs = nn.functional.log_softmax(logits, dim=-1)
    # Gather log prob of chosen move
    move_idx = move_idx.long().clamp(0, MOVE_DIM - 1)
    chosen_log_prob = log_probs.gather(1, move_idx.unsqueeze(1)).squeeze(1)
    # Negative reward * log prob -> minimize when reward positive (good move)
    return -(reward * chosen_log_prob).mean()
