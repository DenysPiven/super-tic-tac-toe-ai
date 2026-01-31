"""
Evaluate trained model by playing against random bot.
Run: python -m training.evaluate [--games 100] [--checkpoint checkpoints/policy.pt]
"""

import argparse
import json
import random
import sys
from pathlib import Path

import numpy as np
import torch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.game import (
    State,
    get_legal_moves,
    get_result,
    initial_state,
    is_terminal,
    make_move,
)
from training.model import PolicyNet
from training.state_encoder import STATE_DIM, encode_state, move_to_index

CHECKPOINT_DIR = Path(__file__).resolve().parent / "checkpoints"
WEIGHTS_JSON = Path(__file__).resolve().parent.parent / "frontend" / "model" / "weights.json"


def load_model_from_json(json_path: Path, device: torch.device) -> PolicyNet:
    """Load model from weights.json (frontend format)."""
    with open(json_path, 'r') as f:
        data = json.load(f)
    
    hidden = data.get("hidden", 256)
    num_layers = data.get("num_layers", 3)
    model = PolicyNet(hidden=hidden, num_layers=num_layers)
    
    # Reconstruct state dict from JSON layers
    state_dict = {}
    layer_idx = 0
    
    # Process backbone layers
    for i in range(num_layers):
        # Linear layer
        linear_data = data["layers"][layer_idx]
        state_dict[f"backbone.{i*3}.weight"] = torch.tensor(linear_data["weight"], dtype=torch.float32).T
        state_dict[f"backbone.{i*3}.bias"] = torch.tensor(linear_data["bias"], dtype=torch.float32)
        layer_idx += 1
        
        # ReLU (no params)
        layer_idx += 1
        
        # LayerNorm
        ln_data = data["layers"][layer_idx]
        state_dict[f"backbone.{i*3+2}.weight"] = torch.tensor(ln_data["weight"], dtype=torch.float32)
        state_dict[f"backbone.{i*3+2}.bias"] = torch.tensor(ln_data["bias"], dtype=torch.float32)
        layer_idx += 1
    
    # Head layer
    head_data = data["layers"][layer_idx]
    state_dict["head.weight"] = torch.tensor(head_data["weight"], dtype=torch.float32).T
    state_dict["head.bias"] = torch.tensor(head_data["bias"], dtype=torch.float32)
    
    model.load_state_dict(state_dict, strict=True)
    model.eval()
    return model


def load_model(checkpoint_path: Path, device: torch.device) -> PolicyNet:
    """Load trained model from checkpoint (.pt file)."""
    ckpt = torch.load(checkpoint_path, map_location=device, weights_only=True)
    state_dict = ckpt.get("state_dict", ckpt)
    model = PolicyNet(hidden=256, num_layers=3)
    model.load_state_dict(state_dict, strict=True)
    model.eval()
    return model


def model_move(state: State, model: PolicyNet, device: torch.device) -> tuple[int, int] | None:
    """Get model's move for given state."""
    moves = get_legal_moves(state)
    if not moves:
        return None
    
    with torch.no_grad():
        enc = encode_state(state)
        x = torch.from_numpy(enc).unsqueeze(0).to(device)
        logits = model(x).cpu().numpy()[0]
        
        # Mask illegal moves
        legal_set = {move_to_index(m) for m in moves}
        best_idx = -1
        best_score = -1e9
        for idx in range(81):
            if idx in legal_set and logits[idx] > best_score:
                best_score = logits[idx]
                best_idx = idx
        
        if best_idx < 0:
            return random.choice(moves)
        
        return (best_idx // 9, best_idx % 9)


def play_game(model: PolicyNet, device: torch.device, model_plays: str = "X") -> str:
    """
    Play one game: model vs random bot.
    model_plays: "X" or "O" - which side the model plays.
    Returns: "X", "O", or "draw"
    """
    state = initial_state()
    
    while not is_terminal(state):
        moves = get_legal_moves(state)
        if not moves:
            break
        
        if state.current_player == model_plays:
            move = model_move(state, model, device)
        else:
            move = random.choice(moves)
        
        if move is None:
            break
        
        state = make_move(state, move)
    
    result = get_result(state)
    return result or "draw"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--games", type=int, default=100, help="Number of test games")
    ap.add_argument("--checkpoint", type=str, default="", help="Checkpoint path (.pt file)")
    ap.add_argument("--weights-json", type=str, default="", help="Weights JSON path (frontend/model/weights.json)")
    ap.add_argument("--as-x", action="store_true", help="Test model playing as X (default: test both X and O)")
    ap.add_argument("--as-o", action="store_true", help="Test model playing as O (default: test both X and O)")
    args = ap.parse_args()
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")
    
    # Determine which model to load
    if args.weights_json:
        model_path = Path(args.weights_json)
        if not model_path.exists():
            print(f"Error: Weights JSON not found: {model_path}")
            sys.exit(1)
        print(f"Loading model from JSON: {model_path}")
        model = load_model_from_json(model_path, device)
    elif args.checkpoint:
        checkpoint_path = Path(args.checkpoint)
        if not checkpoint_path.exists():
            print(f"Error: Checkpoint not found: {checkpoint_path}")
            sys.exit(1)
        print(f"Loading model from checkpoint: {checkpoint_path}")
        model = load_model(checkpoint_path, device)
    else:
        # Try checkpoint first, then weights.json
        checkpoint_path = CHECKPOINT_DIR / "policy.pt"
        if checkpoint_path.exists():
            print(f"Loading model from checkpoint: {checkpoint_path}")
            model = load_model(checkpoint_path, device)
        elif WEIGHTS_JSON.exists():
            print(f"Loading model from JSON: {WEIGHTS_JSON}")
            model = load_model_from_json(WEIGHTS_JSON, device)
        else:
            print(f"Error: No model found. Tried:")
            print(f"  - {checkpoint_path}")
            print(f"  - {WEIGHTS_JSON}")
            sys.exit(1)
    print(f"Testing {args.games} games...")
    
    # Determine which sides to test
    test_x = args.as_x or (not args.as_x and not args.as_o)
    test_o = args.as_o or (not args.as_x and not args.as_o)
    
    results = {"X": {"wins": 0, "losses": 0, "draws": 0}, "O": {"wins": 0, "losses": 0, "draws": 0}}
    
    if test_x:
        print("\nTesting as X...")
        for i in range(args.games):
            result = play_game(model, device, model_plays="X")
            if result == "X":
                results["X"]["wins"] += 1
            elif result == "O":
                results["X"]["losses"] += 1
            else:
                results["X"]["draws"] += 1
            if (i + 1) % 10 == 0:
                print(f"  {i + 1}/{args.games} games")
    
    if test_o:
        print("\nTesting as O...")
        for i in range(args.games):
            result = play_game(model, device, model_plays="O")
            if result == "O":
                results["O"]["wins"] += 1
            elif result == "X":
                results["O"]["losses"] += 1
            else:
                results["O"]["draws"] += 1
            if (i + 1) % 10 == 0:
                print(f"  {i + 1}/{args.games} games")
    
    # Print results
    print("\n" + "=" * 50)
    print("RESULTS")
    print("=" * 50)
    
    total_games = 0
    total_wins = 0
    total_losses = 0
    total_draws = 0
    
    for side in ["X", "O"]:
        if (side == "X" and test_x) or (side == "O" and test_o):
            wins = results[side]["wins"]
            losses = results[side]["losses"]
            draws = results[side]["draws"]
            total = wins + losses + draws
            win_rate = (wins / total * 100) if total > 0 else 0
            
            print(f"\nPlaying as {side}:")
            print(f"  Wins:   {wins:4d} ({win_rate:5.1f}%)")
            print(f"  Losses: {losses:4d} ({(losses/total*100) if total > 0 else 0:5.1f}%)")
            print(f"  Draws:  {draws:4d} ({(draws/total*100) if total > 0 else 0:5.1f}%)")
            print(f"  Total:  {total:4d} games")
            
            total_games += total
            total_wins += wins
            total_losses += losses
            total_draws += draws
    
    if total_games > 0:
        overall_win_rate = total_wins / total_games * 100
        print(f"\nOverall:")
        print(f"  Win rate: {overall_win_rate:.1f}%")
        print(f"  Expected vs random: ~50% (if model is good)")
        print(f"  >60% = good, >70% = very good, >80% = excellent")


if __name__ == "__main__":
    main()
