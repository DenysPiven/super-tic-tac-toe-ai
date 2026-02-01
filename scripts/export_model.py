"""
Export PyTorch model to ONNX format for use in frontend.
Usage: python scripts/export_model.py --model_path <path_to_pt_file> --output_path core/model/policy_value_net.onnx
"""

import argparse
import sys
from pathlib import Path

# Add utttai to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "utttai"))

import torch
from utttpy.selfplay.policy_value_network import PolicyValueNetwork
from utttpy.game.helpers import get_state_ndarray_4x9x9
from utttpy.game.ultimate_tic_tac_toe import UltimateTicTacToe


def export_model(model_path: Path, output_path: Path) -> None:
    """Export PyTorch model to ONNX format."""
    print(f"Loading model from: {model_path}")
    device = torch.device("cpu")
    
    # Load model
    model = PolicyValueNetwork(onnx_export=True)
    state_dict = torch.load(model_path, map_location=device, weights_only=True)
    
    # Filter state dict to match model architecture
    model_keys = set(model.state_dict().keys())
    filtered_state_dict = {k: v for k, v in state_dict.items() if k in model_keys}
    model.load_state_dict(filtered_state_dict, strict=False)
    model.eval()
    
    # Create dummy input (4x9x9)
    dummy_uttt = UltimateTicTacToe()
    dummy_input = get_state_ndarray_4x9x9(dummy_uttt)
    dummy_input = torch.from_numpy(dummy_input).unsqueeze(0).float()  # (1, 4, 9, 9)
    
    print(f"Exporting to: {output_path}")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Export to ONNX
    torch.onnx.export(
        model,
        dummy_input,
        str(output_path),
        export_params=True,
        opset_version=12,
        do_constant_folding=True,
        input_names=["input"],
        output_names=["policy_logits", "state_value"],
        verbose=True,
    )
    
    print(f"✅ Model exported successfully to {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Export PyTorch model to ONNX")
    parser.add_argument(
        "--model_path",
        type=Path,
        required=True,
        help="Path to PyTorch model file (.pt)"
    )
    parser.add_argument(
        "--output_path",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "model" / "policy_value_net.onnx",
        help="Output ONNX file path (default: frontend/model/policy_value_net.onnx)"
    )
    args = parser.parse_args()
    
    if not args.model_path.exists():
        print(f"❌ Error: Model file not found: {args.model_path}")
        sys.exit(1)
    
    export_model(args.model_path, args.output_path)


if __name__ == "__main__":
    main()
