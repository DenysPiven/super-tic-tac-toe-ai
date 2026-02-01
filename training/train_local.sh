#!/bin/bash
# Local training script - trains model and saves weights to git
# Usage: ./training/train_local.sh [--games 15000] [--epochs 10] [--batch 256]

set -e  # Exit on error

# Default values (same as GitHub Actions pipeline)
GAMES=${GAMES:-15000}
EPOCHS=${EPOCHS:-10}
BATCH=${BATCH:-256}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --games)
            GAMES="$2"
            shift 2
            ;;
        --epochs)
            EPOCHS="$2"
            shift 2
            ;;
        --batch)
            BATCH="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: ./training/train_local.sh [--games 15000] [--epochs 10] [--batch 256]"
            exit 1
            ;;
    esac
done

START_TIME=$(date)
echo "=========================================="
echo "Starting local model training"
echo "Games: $GAMES"
echo "Epochs: $EPOCHS"
echo "Batch size: $BATCH"
echo "Start time: $START_TIME"
echo "=========================================="

# Check if we're in the right directory
if [ ! -f "training/train.py" ]; then
    echo "Error: Please run this script from the project root directory"
    exit 1
fi

# Install dependencies if needed
echo "Checking dependencies..."
pip install -q -r training/requirements.txt

# Train the model
echo ""
echo "Training model (this will take a very long time)..."
python3 -m training.train --games $GAMES --epochs $EPOCHS --batch $BATCH

# Export model for frontend
echo ""
echo "Exporting model to frontend/model/weights.json..."
python3 -m training.export_for_js

# Show status
echo ""
echo "=========================================="
echo "Model exported to frontend/model/weights.json"
echo ""
echo "To commit and push, run:"
echo "  git add frontend/model/weights.json"
echo "  git commit -m 'Update trained model ($GAMES games, $EPOCHS epochs) [skip ci]'"
echo "  git push"
echo "=========================================="

END_TIME=$(date)
echo ""
echo "=========================================="
echo "Training complete!"
echo "Start time: $START_TIME"
echo "End time: $END_TIME"
echo "=========================================="
