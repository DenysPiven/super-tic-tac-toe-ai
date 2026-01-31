# Super Tic-Tac-Toe (Ultimate) + AI

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

### Making the bot stronger

- **How many games?**  
  More games → more diverse positions → better generalization.  
  - **5k–20k** — noticeably better than default (500).  
  - **50k–100k** — strong for random-style play; good balance of time vs strength.  
  - **200k+** — diminishing returns unless you also improve data quality (e.g. self-play with the trained policy).

- **How many epochs?**  
  Default 5 is minimal. Use **10–20** so the model actually fits the data. More than ~30 on the same dataset often overfits.

- **Why it works**  
  Data is “random vs random” with rewards: win/loss/draw on the big board + small bonus for winning a small board. The policy learns: “in positions that led to wins, prefer moves like these.” It never sees strong opponents, so it won’t become expert, but it will play much better than pure random.

- **Recommended command** (stronger bot, ~2–5 min on a laptop):

```bash
python -m training.train --games 30000 --epochs 15 --batch 256
```

Then export and run the frontend (see “Use model in frontend” below).

**Use model in frontend:** after training, run `python -m training.export_for_js`, then serve `frontend/` (e.g. `cd frontend && python3 -m http.server 8000`). Open http://localhost:8000, choose “vs AI” — the AI uses `frontend/model/weights.json` if present; otherwise it plays randomly.

## Status

Game core and training pipeline in place; next: use trained policy in frontend or iterative self-play.
