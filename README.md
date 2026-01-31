# Super Tic-Tac-Toe (Ultimate)

Super Tic-Tac-Toe with an AI mode trained via self-play (millions of games against itself).

## Project structure

- **frontend/** — Web UI (HTML, CSS, JS)
- **core/** — Game engine (rules, state, legal moves)
- **training/** — Model training (Python, self-play, reinforcement learning)

## Deploy & play

1. **One-time:** In the repo **Settings → Pages**, set **Source** to **GitHub Actions**.
2. Push to `master` (or run **Actions → Deploy to GitHub Pages → Run workflow**). The workflow trains the model (~3–5 min) and deploys the frontend.
3. **Play:** https://denyspiven.github.io/super-tic-tac-toe-ai/

## Rules

[Ultimate tic-tac-toe (Wikipedia)](https://en.wikipedia.org/wiki/Ultimate_tic-tac-toe)

## Replay

- Export bot games: `python -m core.export_replay` (one game to `frontend/replays/`) or `python -m core.export_replay --count 5` (five games). Updates `frontend/replays/list.json`.
- To see the replay list in the UI, serve the frontend from `frontend/` (e.g. `cd frontend && python3 -m http.server 8000`, then open http://localhost:8000). Choose a replay from the dropdown, then use Play / Pause, Previous / Next, or the slider to scrub.

## Training

From project root:

```bash
pip install -r training/requirements.txt
python -m training.train --games 500 --epochs 5 --batch 256
```

- **state_encoder.py** — encode State to vector (101 dims), move to index 0..80
- **data_collector.py** — self-play with random bot; (state, move, reward), reward +1/−1/0 for win/loss/draw
- **model.py** — policy MLP (state → 81 logits), reward-weighted cross-entropy loss
- **train.py** — collect games, train policy, save to `training/checkpoints/policy.pt`

Options: `--games`, `--epochs`, `--batch`, `--lr`, `--hidden`, `--layers`, `--save`.

### Training on large datasets

- **How many games?**  
  More games → more diverse positions → better generalization.  
  - **5k–20k** — noticeably better than default (500).  
  - **50k–100k** — strong for random-style play; good balance of time vs strength.  
  - **100k–500k** — very strong, can reach 70–80% win rate vs random.  
  - **500k+** — diminishing returns unless you also improve data quality (e.g. self-play with the trained policy).

- **How many epochs?**  
  Default 5 is minimal. Use **10–20** so the model actually fits the data. More than ~30 on the same dataset often overfits.

- **Why it works**  
  Data is "random vs random" with rewards: win/loss/draw on the big board + small bonus for winning a small board. The policy learns: "in positions that led to wins, prefer moves like these." It never sees strong opponents, so it won't become expert, but it will play much better than pure random.

- **Training options:**

**Local training:**
```bash
# Strong bot (~2–5 min on laptop)
python -m training.train --games 30000 --epochs 15 --batch 256

# Very strong bot (~10–20 min on laptop)
python -m training.train --games 100000 --epochs 20 --batch 256

# Maximum strength (~1–2 hours on laptop)
python -m training.train --games 500000 --epochs 25 --batch 256
```

**GitHub Actions (cloud training):**
1. Go to **Actions → Train Model → Run workflow**
2. Set parameters:
   - `games`: 100000 (or more)
   - `epochs`: 20
3. Click "Run workflow"
4. Wait ~1–2 hours for completion
5. Model will be automatically exported and committed to `frontend/model/weights.json`

### Downloading trained model from GitHub

After training completes on GitHub Actions, the model is automatically saved to `frontend/model/weights.json` in the repository.

**To download the updated model:**

```bash
# Option 1: Pull latest changes (recommended)
git pull origin master

# Option 2: Download directly from GitHub
# Go to: https://github.com/DenysPiven/super-tic-tac-toe-ai/blob/master/frontend/model/weights.json
# Click "Raw" button, then save the file

# Option 3: Using curl
curl -o frontend/model/weights.json \
  https://raw.githubusercontent.com/DenysPiven/super-tic-tac-toe-ai/master/frontend/model/weights.json
```

The model file is ~3.7MB and contains all neural network weights in JSON format.

### Evaluating model strength

Test your trained model against a random bot:

```bash
# Test 100 games (default)
python -m training.evaluate

# Test more games for better statistics
python -m training.evaluate --games 1000

# Test model from GitHub (weights.json)
python -m training.evaluate --weights-json frontend/model/weights.json --games 1000

# Test only as X or O
python -m training.evaluate --games 500 --as-x
python -m training.evaluate --games 500 --as-o

# Use specific checkpoint
python -m training.evaluate --checkpoint training/checkpoints/policy.pt --games 500
```

**Interpreting results:**
- **~50% win rate** = model is as good as random (needs more training)
- **60–70% win rate** = good model, learned basic strategy
- **70–80% win rate** = very good, strong tactical play
- **80%+ win rate** = excellent, near-optimal for this training method

**Note:** These percentages are against a random bot. A model with 70%+ win rate will feel very strong when playing against humans.

**Use model in frontend:** after training, run `python -m training.export_for_js`, then serve `frontend/` (e.g. `cd frontend && python3 -m http.server 8000`). Open http://localhost:8000, choose "vs AI" — the AI uses `frontend/model/weights.json` if present; otherwise it plays randomly.

## Status

Game core and training pipeline in place; next: use trained policy in frontend or iterative self-play.
