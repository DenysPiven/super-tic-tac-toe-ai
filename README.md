# Super Tic-Tac-Toe (Ultimate)

Super Tic-Tac-Toe with AI powered by AlphaZero-like neural network.

## Project structure

- **frontend/** — Web UI (HTML, CSS, JS) with ONNX Runtime for AI inference
- **model/** — ONNX model file (policy_value_net.onnx)

## Setup

1. **Get the ONNX model:**
   - Download a trained PyTorch model (.pt file)
   - Export it to ONNX format:
     ```bash
     python scripts/export_model.py --model_path <path_to_model.pt> --output_path model/policy_value_net.onnx
     ```
   - Or place an existing ONNX file at `model/policy_value_net.onnx`

2. **Deploy:**
   - The frontend uses GitHub Pages
   - Push to `master` branch or use GitHub Actions workflow
   - The workflow will copy the model from `model/` to `frontend/model/` during deployment

## Play

- **Offline mode:** Two players on the same device
- **Online mode:** Create/join rooms via WebRTC (PeerJS)
- **vs AI:** Play against the trained neural network model (requires ONNX model file)

## Rules

[Ultimate tic-tac-toe (Wikipedia)](https://en.wikipedia.org/wiki/Ultimate_tic-tac-toe)


## AI Model

This project uses an AlphaZero-like neural network for Ultimate Tic-Tac-Toe. The model runs in the browser using ONNX Runtime Web.

### Model Format

- **Format:** ONNX (`.onnx` file)
- **Input:** 4x9x9 tensor (current player pieces, opponent pieces, player indicator, legal moves)
- **Output:** Policy logits (81 moves) and state value

### Loading the Model

1. Export PyTorch model to ONNX format using `scripts/export_model.py`:
   ```bash
   python scripts/export_model.py --model_path <model.pt> --output_path model/policy_value_net.onnx
   ```
2. Place the ONNX file at `model/policy_value_net.onnx`
3. The page will automatically load it on page load

## License

See LICENSE file.
