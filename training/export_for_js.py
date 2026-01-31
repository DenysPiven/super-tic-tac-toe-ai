"""
Export trained policy.pt to JSON for frontend inference.
Saves weights to frontend/model/weights.json.
Run: python -m training.export_for_js [path/to/policy.pt]
"""

import json
import sys
from pathlib import Path

import torch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from training.model import PolicyNet
from training.state_encoder import STATE_DIM, MOVE_DIM

OUT_PATH = Path(__file__).resolve().parent.parent / "frontend" / "model" / "weights.json"


def export(checkpoint_path: Path) -> None:
    ckpt = torch.load(checkpoint_path, map_location="cpu", weights_only=True)
    state_dict = ckpt.get("state_dict", ckpt)
    model = PolicyNet(hidden=256, num_layers=3)
    model.load_state_dict(state_dict, strict=True)
    model.eval()

    out = {"STATE_DIM": STATE_DIM, "MOVE_DIM": MOVE_DIM, "hidden": 256, "num_layers": 3, "layers": []}

    # Backbone: Linear, ReLU, LayerNorm repeated 3 times
    for name, module in model.backbone.named_children():
        if isinstance(module, torch.nn.Linear):
            w = module.weight.detach().numpy()
            b = module.bias.detach().numpy()
            out["layers"].append({"type": "linear", "weight": w.T.tolist(), "bias": b.tolist()})
        elif isinstance(module, torch.nn.ReLU):
            out["layers"].append({"type": "relu"})
        elif isinstance(module, torch.nn.LayerNorm):
            out["layers"].append({
                "type": "layernorm",
                "weight": module.weight.detach().numpy().tolist(),
                "bias": module.bias.detach().numpy().tolist(),
            })

    # Head
    w = model.head.weight.detach().numpy()
    b = model.head.bias.detach().numpy()
    out["layers"].append({"type": "linear", "weight": w.T.tolist(), "bias": b.tolist()})

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(out), encoding="utf-8")
    print("Exported to", OUT_PATH)


if __name__ == "__main__":
    default = Path(__file__).resolve().parent / "checkpoints" / "policy.pt"
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else default
    if not path.exists():
        print("Not found:", path)
        sys.exit(1)
    export(path)
