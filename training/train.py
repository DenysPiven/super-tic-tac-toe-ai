"""
Train policy network on self-play data.
1. Collect games with random bot -> (state, move, reward)
2. Train policy with reward-weighted cross-entropy.
Run from project root: python -m training.train [--games 1000] [--epochs 5] [--batch 256]
"""

import argparse
import sys
from pathlib import Path

import numpy as np
import torch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from training.state_encoder import STATE_DIM, encode_state, legal_mask
from training.data_collector import collect_games
from training.model import PolicyNet, policy_loss

CHECKPOINT_DIR = Path(__file__).resolve().parent / "checkpoints"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--games", type=int, default=500, help="Number of self-play games to collect")
    ap.add_argument("--epochs", type=int, default=5, help="Training epochs on collected data")
    ap.add_argument("--batch", type=int, default=256, help="Batch size")
    ap.add_argument("--lr", type=float, default=1e-3, help="Learning rate")
    ap.add_argument("--hidden", type=int, default=256, help="Hidden size")
    ap.add_argument("--layers", type=int, default=3, help="Number of hidden layers")
    ap.add_argument("--save", type=str, default="", help="Save path (default: checkpoints/policy.pt)")
    ap.add_argument("--small-bonus", type=float, default=0.15, help="Bonus when move wins a small board (default 0.15)")
    args = ap.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("Device:", device)
    print("Small-board bonus:", args.small_bonus)

    # Collect data (reward = terminal win/loss/draw + small_bonus if move won a small board)
    print("Collecting", args.games, "games...")
    samples = list(collect_games(args.games, small_bonus=args.small_bonus))
    print("Samples:", len(samples))

    states = np.stack([s[0] for s in samples], axis=0)
    moves = np.array([s[1] for s in samples], dtype=np.int64)
    rewards = np.array([s[2] for s in samples], dtype=np.float32)
    masks = np.stack([s[3] for s in samples], axis=0)

    X = torch.from_numpy(states)
    move_idx = torch.from_numpy(moves)
    reward = torch.from_numpy(rewards)
    legal_masks = torch.from_numpy(masks)

    model = PolicyNet(hidden=args.hidden, num_layers=args.layers).to(device)
    opt = torch.optim.Adam(model.parameters(), lr=args.lr)

    n = len(samples)
    for epoch in range(args.epochs):
        perm = torch.randperm(n, device=device if X.is_cuda else None)
        total_loss = 0.0
        batches = 0
        for start in range(0, n, args.batch):
            end = min(start + args.batch, n)
            idx = perm[start:end]
            x = X[idx].to(device)
            m = move_idx[idx].to(device)
            r = reward[idx].to(device)
            mask_batch = legal_masks[idx].to(device)
            logits = model(x)
            loss = policy_loss(logits, m, r, legal_mask=mask_batch)
            opt.zero_grad()
            loss.backward()
            opt.step()
            total_loss += loss.item()
            batches += 1
        avg = total_loss / batches
        print(f"Epoch {epoch + 1}/{args.epochs} loss={avg:.4f}")

    save_path = Path(args.save) if args.save else CHECKPOINT_DIR / "policy.pt"
    save_path.parent.mkdir(parents=True, exist_ok=True)
    torch.save({"state_dict": model.state_dict(), "STATE_DIM": STATE_DIM}, save_path)
    print("Saved:", save_path)


if __name__ == "__main__":
    main()
