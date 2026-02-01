/**
 * Super Tic-Tac-Toe (Ultimate) — frontend game state and DOM.
 * Rules: https://en.wikipedia.org/wiki/Ultimate_tic-tac-toe
 */

// --- State ---
const big = ['', '', '', '', '', '', '', '', ''];
const small = Array.from({ length: 9 }, () => Array(9).fill(''));
const winningCells = [false, false, false, false, false, false, false, false, false];

const CONVERTOR_MAP = {
    0: [1, 1], 1: [1, 2], 2: [1, 3], 3: [2, 1], 4: [2, 2], 5: [2, 3],
    6: [3, 1], 7: [3, 2], 8: [3, 3], 10: [1, 4], 11: [1, 5], 12: [1, 6],
    13: [2, 4], 14: [2, 5], 15: [2, 6], 16: [3, 4], 17: [3, 5], 18: [3, 6],
    20: [1, 7], 21: [1, 8], 22: [1, 9], 23: [2, 7], 24: [2, 8], 25: [2, 9],
    26: [3, 7], 27: [3, 8], 28: [3, 9], 30: [4, 1], 31: [4, 2], 32: [4, 3],
    33: [5, 1], 34: [5, 2], 35: [5, 3], 36: [6, 1], 37: [6, 2], 38: [6, 3],
    40: [4, 4], 41: [4, 5], 42: [4, 6], 43: [5, 4], 44: [5, 5], 45: [5, 6],
    46: [6, 4], 47: [6, 5], 48: [6, 6], 50: [4, 7], 51: [4, 8], 52: [4, 9],
    53: [5, 7], 54: [5, 8], 55: [5, 9], 56: [6, 7], 57: [6, 8], 58: [6, 9],
    60: [7, 1], 61: [7, 2], 62: [7, 3], 63: [8, 1], 64: [8, 2], 65: [8, 3],
    66: [9, 1], 67: [9, 2], 68: [9, 3], 70: [7, 4], 71: [7, 5], 72: [7, 6],
    73: [8, 4], 74: [8, 5], 75: [8, 6], 76: [9, 4], 77: [9, 5], 78: [9, 6],
    80: [7, 7], 81: [7, 8], 82: [7, 9], 83: [8, 7], 84: [8, 8], 85: [8, 9],
    86: [9, 7], 87: [9, 8], 88: [9, 9]
};

let player = 'X';
let availableBig = -1;
let winner = null; // null | 'X' | 'O' | 'draw'

// Mode: 'two' = two players (offline), 'online' = online multiplayer, 'ai' = vs AI bot
let gameMode = 'two';
let humanSide = 'X'; // when vs AI: 'X' or 'O'
let aiTimeoutId = null;
let lastMove = null; // [bigIdx, smallIdx] of last played cell, or null
let showHeatmap = true; // Show AI move probabilities
let currentProbabilities = null; // Map of move indices to probabilities

// Online multiplayer (WebRTC via PeerJS)
let peer = null;
let peerConnection = null;
let onlineRole = null; // 'X' | 'O' | 'spectator' | null
let roomId = null;
let isHost = false;
let creatorRole = null; // Role of room creator
let pendingRoomId = null; // Room ID waiting for role selection

const STORAGE_KEY = 'superTttState';

// ONNX model session (loaded from model/policy_value_net.onnx)
let onnxSession = null;
const MOVE_DIM = 81;

// Mapping from our move index (0-80) to flattened 9x9 board index
// FLAT_INDEX_0 maps state index to 9x9 board position
const FLAT_INDEX_0 = Int32Array.from([
    0,  1,  2,  9, 10, 11, 18, 19, 20,
    3,  4,  5, 12, 13, 14, 21, 22, 23,
    6,  7,  8, 15, 16, 17, 24, 25, 26,
   27, 28, 29, 36, 37, 38, 45, 46, 47,
   30, 31, 32, 39, 40, 41, 48, 49, 50,
   33, 34, 35, 42, 43, 44, 51, 52, 53,
   54, 55, 56, 63, 64, 65, 72, 73, 74,
   57, 58, 59, 66, 67, 68, 75, 76, 77,
   60, 61, 62, 69, 70, 71, 78, 79, 80,
]);

// --- Helpers ---
function convertor(i, j) {
    return CONVERTOR_MAP[i * 10 + j];
}

function checkLine(a, b, c, smallBoard, markBig) {
    if (markBig) {
        if (big[a] && big[a] === big[b] && big[b] === big[c]) {
            winningCells[a] = true;
            winningCells[b] = true;
            winningCells[c] = true;
        }
        return false;
    }
    const idx = typeof smallBoard === 'number' ? small[smallBoard] : smallBoard;
    return idx[a] !== '' && idx[a] === idx[b] && idx[b] === idx[c];
}

function checkSmallWinner(bigIndex) {
    const s = small[bigIndex];
    return (
        checkLine(0, 1, 2, s) || checkLine(3, 4, 5, s) || checkLine(6, 7, 8, s) ||
        checkLine(0, 3, 6, s) || checkLine(1, 4, 7, s) || checkLine(2, 5, 8, s) ||
        checkLine(0, 4, 8, s) || checkLine(2, 4, 6, s)
    );
}

function checkBigWinner() {
    winningCells.fill(false);
    checkLine(0, 4, 8, null, true);
    checkLine(2, 4, 6, null, true);
    for (let k = 0; k < 3; k++) {
        checkLine(3 * k, 3 * k + 1, 3 * k + 2, null, true);
        checkLine(k, k + 3, k + 6, null, true);
    }
    return winningCells.some(Boolean);
}

function getLegalMoves() {
    if (availableBig === -2) return [];
    const boards = availableBig === -1
        ? [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(i => !big[i])
        : [availableBig];
    const moves = [];
    for (const i of boards) {
        for (let j = 0; j < 9; j++) {
            if (small[i][j] === '') moves.push([i, j]);
        }
    }
    return moves;
}

function setCellContent(el, symbol) {
    el.textContent = symbol;
    el.classList.add(symbol.toLowerCase(), 'lastTurn');
}

function setCellContentSilent(el, symbol) {
    el.textContent = symbol;
    el.classList.add(symbol.toLowerCase());
}

function updateStatus() {
    const statusEl = document.getElementById('status');
    if (!statusEl) return;
    if (winner === 'X') statusEl.textContent = "X wins!";
    else if (winner === 'O') statusEl.textContent = "O wins!";
    else if (winner === 'draw') statusEl.textContent = "Draw!";
    else if (gameMode === 'online') {
        if (onlineRole === 'spectator') {
            statusEl.textContent = `Watching: ${player}'s turn`;
        } else if (!peerConnection || !peerConnection.open) {
            statusEl.textContent = onlineRole ? `Connecting... (You are ${onlineRole})` : "Not connected";
        } else if (player !== onlineRole) {
            statusEl.textContent = `Waiting for opponent... (You are ${onlineRole})`;
        } else {
            statusEl.textContent = `Your turn (${onlineRole})`;
        }
    }
    else if (gameMode === 'ai' && player !== humanSide) statusEl.textContent = onnxSession ? "AI thinking…" : "AI model not loaded";
    else statusEl.textContent = `${player}'s turn`;
}

function setGameOver() {
    document.querySelector('.game').classList.add('game-over');
}

// --- Persist state to localStorage ---
function saveState() {
    try {
        const state = {
            gameMode,
            humanSide,
            big: [...big],
            small: small.map(row => [...row]),
            player,
            availableBig,
            winner,
            lastMove
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        // ignore quota / private mode
    }
}

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (!data || !Array.isArray(data.big) || !Array.isArray(data.small)) return false;
        if (data.big.length !== 9 || data.small.length !== 9) return false;
        for (let i = 0; i < 9; i++) {
            big[i] = data.big[i] === 'X' || data.big[i] === 'O' ? data.big[i] : '';
            if (!Array.isArray(data.small[i]) || data.small[i].length !== 9) return false;
            for (let j = 0; j < 9; j++) {
                small[i][j] = data.small[i][j] === 'X' || data.small[i][j] === 'O' ? data.small[i][j] : '';
            }
        }
        gameMode = data.gameMode === 'ai' ? 'ai' : 'two';
        humanSide = data.humanSide === 'X' ? 'X' : 'O';
        player = data.player === 'O' ? 'O' : 'X';
        availableBig = typeof data.availableBig === 'number' && data.availableBig >= -2 && data.availableBig <= 8 ? data.availableBig : -1;
        winner = data.winner === 'X' || data.winner === 'O' || data.winner === 'draw' ? data.winner : null;
        lastMove = Array.isArray(data.lastMove) && data.lastMove.length === 2
            && data.lastMove[0] >= 0 && data.lastMove[0] <= 8 && data.lastMove[1] >= 0 && data.lastMove[1] <= 8
            ? data.lastMove : null;
        if (winner) checkBigWinner();
        return true;
    } catch (e) {
        return false;
    }
}

function syncModeUI() {
    document.getElementById('modeTwo').classList.toggle('active', gameMode === 'two');
    document.getElementById('modeOnline').classList.toggle('active', gameMode === 'online');
    document.getElementById('modeAi').classList.toggle('active', gameMode === 'ai');
    document.getElementById('sideRow').classList.toggle('hidden', gameMode !== 'ai');
    document.getElementById('onlinePanel').classList.toggle('hidden', gameMode !== 'online');
    document.getElementById('sideX').classList.toggle('active', humanSide === 'X');
    document.getElementById('sideO').classList.toggle('active', humanSide === 'O');
}

// --- Board build (init + new game) ---
function resetState() {
    big.fill('');
    for (let i = 0; i < 9; i++) small[i].fill('');
    winningCells.fill(false);
    player = 'X';
    availableBig = -1;
    winner = null;
    lastMove = null;
}

function buildBoard() {
    const area = document.getElementById('area');
    if (!area) return;
    area.innerHTML = '';
    document.querySelector('.game')?.classList.remove('game-over');
    clearHeatmap(); // Clear heatmap when rebuilding board
    
    // Update probabilities after board is built
    if (showHeatmap && onnxSession && winner === null) {
        setTimeout(() => updateProbabilitiesForCurrentPlayer(), 100);
    }

    for (let i = 0; i < 9; i++) {
        const bigCell = document.createElement('div');
        bigCell.className = 'cell bigCell available';
        bigCell.id = String(i);
        area.appendChild(bigCell);

        if (!big[i]) {
            for (let j = 0; j < 9; j++) {
                const smallCell = document.createElement('div');
                smallCell.className = 'cell smallCell';
                smallCell.id = String(j);
                if (small[i][j]) setCellContentSilent(smallCell, small[i][j]);
                bigCell.appendChild(smallCell);
            }
        } else {
            setCellContentSilent(bigCell, big[i]);
        }
    }

    if (lastMove) {
        const [bi, sj] = lastMove;
        if (big[bi]) {
            document.querySelectorAll('.bigCell')[bi]?.classList.add('lastTurn');
        } else {
            document.querySelectorAll('.bigCell')[bi]?.children[sj]?.classList.add('lastTurn');
        }
    }

    updateAvailability();
    updateStatus();
}

function updateAvailability() {
    document.querySelectorAll('.bigCell').forEach(el => {
        el.classList.remove('available', 'won');
    });
    if (winner) {
        document.querySelectorAll('.bigCell').forEach(el => {
            if (winningCells[Number(el.id)]) el.classList.add('available');
        });
        document.querySelectorAll('.bigCell').forEach(el => el.classList.add('won'));
        return;
    }
    if (availableBig === -1) {
        document.querySelectorAll('.bigCell').forEach(el => el.classList.add('available'));
    } else if (availableBig >= 0) {
        document.querySelectorAll('.bigCell')[availableBig]?.classList.add('available');
    }
}

// --- Move logic ---
function applyMove(bigIdx, smallIdx, skipOnline = false) {
    if (winner !== null) return;
    if (availableBig !== -1 && availableBig !== bigIdx) return;
    if (small[bigIdx][smallIdx] !== '') return;
    
    clearHeatmap(); // Clear heatmap when move is applied
    
    // In online mode, send move to peer
    if (gameMode === 'online' && !skipOnline && peerConnection && peerConnection.open) {
        if (player !== onlineRole) return; // Not your turn
        peerConnection.send(JSON.stringify({
            type: 'move',
            big_idx: bigIdx,
            small_idx: smallIdx
        }));
    }

    document.querySelectorAll('.cell').forEach(el => el.classList.remove('lastTurn'));

    small[bigIdx][smallIdx] = player;
    lastMove = [bigIdx, smallIdx];
    const smallEl = document.querySelectorAll('.bigCell')[bigIdx].children[smallIdx];
    if (smallEl) setCellContent(smallEl, player);

    if (checkSmallWinner(bigIdx)) {
        big[bigIdx] = player;
        const bigEl = document.querySelectorAll('.bigCell')[bigIdx];
        if (bigEl?.children?.length) {
            bigEl.innerHTML = '';
            bigEl.className = 'cell bigCell ' + player.toLowerCase();
            bigEl.textContent = player;
            bigEl.classList.add('lastTurn');
        }
        if (checkBigWinner()) {
            winner = player;
            availableBig = -2;
            updateAvailability();
            updateStatus();
            setGameOver();
            return;
        }
    }

    // Next board = where we played inside the small board (smallIdx 0–8 = big board 0–8).
    // See: https://en.wikipedia.org/wiki/Ultimate_tic-tac-toe
    const nextBoard = smallIdx;
    const nextBoardHasEmpty = big[nextBoard] === '' && small[nextBoard].some(c => c === '');
    availableBig = (big[nextBoard] !== '' || !nextBoardHasEmpty) ? -1 : nextBoard;

    player = player === 'X' ? 'O' : 'X';

    const moves = getLegalMoves();
    if (moves.length === 0) {
        winner = 'draw';
        updateAvailability();
        updateStatus();
        setGameOver();
        return;
    }

    updateAvailability();
    updateStatus();
    saveState();
    
    // Update heatmap for current player after move
    if (showHeatmap && onnxSession && winner === null) {
        updateProbabilitiesForCurrentPlayer();
    }
    
    // Send state to peer in online mode and save room state
    if (gameMode === 'online' && peerConnection && peerConnection.open) {
        sendGameState();
        saveRoomState();
    }

    // If vs AI and it's AI's turn, schedule AI move
    if (gameMode === 'ai' && winner === null && player !== humanSide) {
        scheduleAiMove();
    }
}

// --- State encoding for ONNX model (4x9x9 format) ---
function encodeStateForModel() {
    // Create 4x9x9 array (324 elements total)
    const stateArray = new Float32Array(324);
    
    // Channel 2: current player indicator (+1 for X, -1 for O)
    const isX = player === 'X';
    stateArray.fill(isX ? 1 : -1, 162, 243);
    
    // Channels 0 and 1: current player's pieces and opponent's pieces
    const xi = isX ? FLAT_INDEX_0 : FLAT_INDEX_0.map(v => v + 81);
    const oi = isX ? FLAT_INDEX_0.map(v => v + 81) : FLAT_INDEX_0;
    
    // Fill channels 0 and 1 based on small boards
    for (let si = 0; si < 81; si++) {
        const bigIdx = Math.floor(si / 9);
        const smallIdx = si % 9;
        const cell = small[bigIdx][smallIdx];
        if (cell === 'X') {
            stateArray[xi[si]] = 1;
        } else if (cell === 'O') {
            stateArray[oi[si]] = 1;
        }
    }
    
    // Channel 3: legal moves
    const legalMoves = getLegalMoves();
    for (const [bigIdx, smallIdx] of legalMoves) {
        const si = bigIdx * 9 + smallIdx;
        if (si < FLAT_INDEX_0.length) {
            stateArray[FLAT_INDEX_0[si] + 243] = 1;
        }
    }
    
    return stateArray;
}

// --- ONNX model inference ---
async function getPolicyLogits(stateArray) {
    if (!onnxSession) return null;
    
    try {
        // Create input tensor: (1, 4, 9, 9)
        const inputTensor = new ort.Tensor('float32', stateArray, [1, 4, 9, 9]);
        const feeds = { input: inputTensor };
        
        // Run inference
        const predictions = await onnxSession.run(feeds);
        const policyLogits = predictions.policy_logits.data; // (1, 81) flattened
        
        // Convert to array and extract first batch
        return Array.from(policyLogits);
    } catch (error) {
        console.error('ONNX inference error:', error);
        return null;
    }
}

function moveIndexToMove(idx) {
    return [Math.floor(idx / 9), idx % 9];
}

// --- AI: ONNX model inference ---
async function getAiMove() {
    const moves = getLegalMoves();
    if (moves.length === 0 || !onnxSession) return null;
    
    const stateArray = encodeStateForModel();
    const logits = await getPolicyLogits(stateArray);
    if (!logits) return null;
    
    // Map model logits (9x9 board) to our move indices (big_idx * 9 + small_idx)
    const legalSet = new Set(moves.map(([i, j]) => i * 9 + j));
    let bestIdx = -1;
    let bestScore = -1e9;
    
    // Calculate probabilities for heatmap
    const moveProbs = new Map();
    const legalLogits = [];
    const legalIndices = [];
    
    for (let idx = 0; idx < MOVE_DIM; idx++) {
        if (!legalSet.has(idx)) continue;
        const flatIdx = FLAT_INDEX_0[idx];
        if (flatIdx < logits.length) {
            legalLogits.push(logits[flatIdx]);
            legalIndices.push(idx);
            if (logits[flatIdx] > bestScore) {
                bestScore = logits[flatIdx];
            bestIdx = idx;
        }
    }
    }
    
    // Convert logits to probabilities using softmax
    if (legalLogits.length > 0) {
        const maxLogit = Math.max(...legalLogits);
        const expLogits = legalLogits.map(l => Math.exp(l - maxLogit));
        const sumExp = expLogits.reduce((a, b) => a + b, 0);
        legalIndices.forEach((idx, i) => {
            moveProbs.set(idx, expLogits[i] / sumExp);
        });
    }
    
    // Note: heatmap is updated separately via updateProbabilitiesForCurrentPlayer
    return bestIdx >= 0 ? moveIndexToMove(bestIdx) : null;
}

// Update probabilities for current player (works in all game modes)
async function updateProbabilitiesForCurrentPlayer() {
    if (!onnxSession || winner !== null) {
        clearHeatmap();
        return;
    }
    
    const moves = getLegalMoves();
    if (moves.length === 0) {
        clearHeatmap();
        return;
    }
    
    const stateArray = encodeStateForModel();
    const logits = await getPolicyLogits(stateArray);
    if (!logits) {
        clearHeatmap();
        return;
    }
    
    // Map model logits to move indices
    const legalSet = new Set(moves.map(([i, j]) => i * 9 + j));
    const moveProbs = new Map();
    const legalLogits = [];
    const legalIndices = [];
    
    for (let idx = 0; idx < MOVE_DIM; idx++) {
        if (!legalSet.has(idx)) continue;
        const flatIdx = FLAT_INDEX_0[idx];
        if (flatIdx < logits.length) {
            legalLogits.push(logits[flatIdx]);
            legalIndices.push(idx);
        }
    }
    
    // Convert logits to probabilities using softmax
    if (legalLogits.length > 0) {
        const maxLogit = Math.max(...legalLogits);
        const expLogits = legalLogits.map(l => Math.exp(l - maxLogit));
        const sumExp = expLogits.reduce((a, b) => a + b, 0);
        legalIndices.forEach((idx, i) => {
            moveProbs.set(idx, expLogits[i] / sumExp);
        });
    }
    
    currentProbabilities = moveProbs;
    updateHeatmap();
}

function updateHeatmap() {
    if (!currentProbabilities || !showHeatmap) {
        clearHeatmap();
        return;
    }
    
    // Find max probability for normalization
    const maxProb = Math.max(...Array.from(currentProbabilities.values()));
    
    // Apply heatmap to each cell
    currentProbabilities.forEach((prob, moveIdx) => {
        const bigIdx = Math.floor(moveIdx / 9);
        const smallIdx = moveIdx % 9;
        const bigCell = document.getElementById('area')?.querySelector(`.bigCell[id="${bigIdx}"]`);
        if (!bigCell) return;
        
        const smallCell = bigCell.querySelector(`.smallCell[id="${smallIdx}"]`);
        if (!smallCell || smallCell.textContent !== '') return; // Skip occupied cells
        
        // Normalize probability (0-1) and convert to opacity/intensity
        const intensity = maxProb > 0 ? prob / maxProb : 0;
        const opacity = 0.3 + intensity * 0.5; // 0.3 to 0.8 opacity
        
        // Apply heatmap style
        smallCell.style.backgroundColor = `rgba(125, 207, 255, ${opacity})`;
        smallCell.style.setProperty('--heatmap-opacity', opacity);
        smallCell.classList.add('heatmap-cell');
        
        // Add probability text (0 to 1)
        const probValue = prob.toFixed(2);
        if (!smallCell.querySelector('.prob-label')) {
            const label = document.createElement('span');
            label.className = 'prob-label';
            label.textContent = probValue;
            smallCell.appendChild(label);
        } else {
            smallCell.querySelector('.prob-label').textContent = probValue;
        }
    });
}

function clearHeatmap() {
    const area = document.getElementById('area');
    if (!area) return;
    
    area.querySelectorAll('.heatmap-cell').forEach(cell => {
        cell.style.backgroundColor = '';
        cell.style.setProperty('--heatmap-opacity', '');
        cell.classList.remove('heatmap-cell');
        const label = cell.querySelector('.prob-label');
        if (label) label.remove();
    });
    currentProbabilities = null;
}

function scheduleAiMove() {
    if (aiTimeoutId) clearTimeout(aiTimeoutId);
    aiTimeoutId = setTimeout(async () => {
        aiTimeoutId = null;
        const move = await getAiMove();
        if (move && winner === null) {
            applyMove(move[0], move[1]);
        }
    }, 500);
}

function cancelAiMove() {
    if (aiTimeoutId) {
        clearTimeout(aiTimeoutId);
        aiTimeoutId = null;
    }
}

// --- Online multiplayer (WebRTC via PeerJS) ---
function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createRoom() {
    if (typeof Peer === 'undefined') {
        alert('PeerJS library not loaded. Please refresh the page.');
        return;
    }
    
    if (peer) {
        peer.destroy();
    }
    
    // Generate new roomId if not restoring
    if (!roomId) {
        roomId = generateRoomId();
    }
    isHost = true;
    if (!onlineRole) {
        onlineRole = 'X';
    }
    if (!creatorRole) {
        creatorRole = onlineRole;
    }
    
    // Use roomId as Peer ID - this allows clients to connect using roomId
    // If ID is taken on reconnect, we'll handle it in error handler
    peer = new Peer(roomId, {
        host: '0.peerjs.com',
        port: 443,
        path: '/',
        secure: true
    });
    
    peer.on('open', (id) => {
        document.getElementById('roomIdDisplay').textContent = roomId;
        document.getElementById('creatorRoleDisplay').textContent = creatorRole;
        document.getElementById('creatorRole').classList.remove('hidden');
        document.getElementById('roomInfo').classList.remove('hidden');
        document.getElementById('joinForm').classList.add('hidden');
        document.getElementById('roleModal').classList.add('hidden');
        document.getElementById('roomStatus').textContent = 'Waiting for opponent...';
        // Save state with actual Peer ID
        saveRoomState();
        updateStatus();
    });
    
    peer.on('connection', (conn) => {
        peerConnection = conn;
            peerConnection.on('open', () => {
                // Send creator role (with Peer ID for reconnection) and game state
                peerConnection.send(JSON.stringify({
                    type: 'creator_role',
                    role: creatorRole,
                    peerId: peer.id
                }));
                document.getElementById('roomStatus').textContent = 'Connected! You are ' + creatorRole;
                sendGameState();
            });
        peerConnection.on('data', handlePeerData);
        peerConnection.on('close', () => {
            document.getElementById('roomStatus').textContent = 'Opponent disconnected';
            peerConnection = null;
        });
    });
    
    peer.on('error', (err) => {
        // If ID is taken (on reconnect), wait a bit and try again with roomId
        // This can happen if the previous connection hasn't fully closed yet
        if (err.type === 'peer-unavailable' || err.message.includes('taken') || err.message.includes('ID')) {
            document.getElementById('roomStatus').textContent = 'Reconnecting...';
            setTimeout(() => {
                peer.destroy();
                peer = new Peer(roomId, {
                    host: '0.peerjs.com',
                    port: 443,
                    path: '/',
                    secure: true
                });
                peer.on('open', (id) => {
                    document.getElementById('roomIdDisplay').textContent = roomId;
                    document.getElementById('creatorRoleDisplay').textContent = creatorRole;
                    document.getElementById('creatorRole').classList.remove('hidden');
                    document.getElementById('roomInfo').classList.remove('hidden');
                    document.getElementById('joinForm').classList.add('hidden');
                    document.getElementById('roleModal').classList.add('hidden');
                    document.getElementById('roomStatus').textContent = 'Waiting for opponent...';
                    saveRoomState();
                    updateStatus();
                });
                peer.on('connection', (conn) => {
                    peerConnection = conn;
                    peerConnection.on('open', () => {
                        peerConnection.send(JSON.stringify({
                            type: 'creator_role',
                            role: creatorRole,
                            peerId: peer.id
                        }));
                        document.getElementById('roomStatus').textContent = 'Connected! You are ' + creatorRole;
                        sendGameState();
                    });
                    peerConnection.on('data', handlePeerData);
                    peerConnection.on('close', () => {
                        document.getElementById('roomStatus').textContent = 'Opponent disconnected';
                        peerConnection = null;
                    });
                });
                peer.on('error', (err2) => {
                    document.getElementById('roomStatus').textContent = 'Room ID is taken. Please create a new room.';
                    alert('Room ID is already in use. Please create a new room.');
                });
            }, 1000);
    } else {
            alert('Connection error: ' + err.message);
        }
    });
}

function joinRoomById(id, selectedRole = null) {
    if (typeof Peer === 'undefined') {
        alert('PeerJS library not loaded. Please refresh the page.');
            return;
        }
    
    if (peer) {
        peer.destroy();
    }
    
    roomId = id.toUpperCase();
    isHost = false;
    
    // If no role selected, show selection UI
    if (!selectedRole) {
        const savedState = loadRoomState(id);
        if (savedState && savedState.creatorRole) {
            pendingRoomId = id.toUpperCase();
            showRoleSelection(savedState.creatorRole);
            return;
        }
        // Default to O if no saved state
        onlineRole = 'O';
    } else {
        onlineRole = selectedRole;
    }
    
    peer = new Peer(undefined, {
        host: '0.peerjs.com',
        port: 443,
        path: '/',
        secure: true
    });
    
    peer.on('open', () => {
        // Try connecting to roomId first (host uses roomId as Peer ID)
        // If we have saved peerId, try that too as fallback
        const savedState = loadRoomState(id);
        const peerIdToConnect = savedState?.peerId || roomId;
        peerConnection = peer.connect(peerIdToConnect);
        
        if (peerConnection) {
            peerConnection.on('open', () => {
                document.getElementById('roomIdDisplay').textContent = roomId;
                if (creatorRole) {
                    document.getElementById('creatorRoleDisplay').textContent = creatorRole;
                    document.getElementById('creatorRole').classList.remove('hidden');
                }
                document.getElementById('roomInfo').classList.remove('hidden');
                document.getElementById('joinForm').classList.add('hidden');
                document.getElementById('roleModal').classList.add('hidden');
                document.getElementById('roomStatus').textContent = 'Connected! You are ' + onlineRole;
                saveRoomState();
                updateStatus();
            });
            peerConnection.on('data', handlePeerData);
            peerConnection.on('close', () => {
                document.getElementById('roomStatus').textContent = 'Host disconnected';
                peerConnection = null;
            });
        }
    });
    
    peer.on('error', (err) => {
        if (err.type === 'peer-unavailable') {
            document.getElementById('roomStatus').textContent = 'Room not found. Please check the room ID.';
            setTimeout(() => {
                alert('Room not found. Please check the room ID.');
            }, 100);
        } else {
            document.getElementById('roomStatus').textContent = 'Connection error: ' + err.message;
            setTimeout(() => {
                alert('Connection error: ' + err.message);
            }, 100);
        }
    });
}

function showRoleSelection(creatorRoleValue) {
    creatorRole = creatorRoleValue;
    document.getElementById('joinForm').classList.add('hidden');
    document.getElementById('roleModal').classList.remove('hidden');
    if (creatorRole) {
        document.getElementById('creatorInfo').textContent = `Room creator plays: ${creatorRole}`;
    }
    // Highlight available roles
    const roleButtons = document.querySelectorAll('#roleModal .btn-mode');
    roleButtons.forEach(btn => {
        btn.classList.remove('active');
        const role = btn.dataset.role;
        if (role === creatorRole) {
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
            btn.disabled = true;
        } else {
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.disabled = false;
        }
    });
}

function selectRole(role) {
    if (pendingRoomId) {
        // Update button states
        document.querySelectorAll('#roleModal .btn-mode').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.role === role) {
                btn.classList.add('active');
            }
        });
        document.getElementById('roleModal').classList.add('hidden');
        joinRoomById(pendingRoomId, role);
        pendingRoomId = null;
    }
}

function handlePeerData(data) {
    try {
        const msg = JSON.parse(data);
        
        if (msg.type === 'move') {
            applyMove(msg.big_idx, msg.small_idx, true); // skipOnline = true to avoid loop
        } else if (msg.type === 'state') {
            loadGameStateFromPeer(msg.state);
        } else if (msg.type === 'reset') {
            resetState();
            buildBoard();
        } else if (msg.type === 'creator_role') {
            creatorRole = msg.role;
            if (document.getElementById('creatorRoleDisplay')) {
                document.getElementById('creatorRoleDisplay').textContent = creatorRole;
                document.getElementById('creatorRole').classList.remove('hidden');
            }
            // If host sent their Peer ID, save it for reconnection
            if (msg.peerId) {
                const savedState = loadRoomState(roomId);
                if (savedState) {
                    savedState.peerId = msg.peerId;
                    localStorage.setItem(`room_${roomId}`, JSON.stringify(savedState));
                }
            }
            saveRoomState();
        }
    } catch (e) {
        // Error handling peer data
    }
}

function sendGameState() {
    if (peerConnection && peerConnection.open) {
        peerConnection.send(JSON.stringify({
            type: 'state',
            state: {
                big: [...big],
                small: small.map(row => [...row]),
                current_player: player,
                available_big: availableBig,
                winner: winner
            }
        }));
    }
}

function loadGameStateFromPeer(stateData) {
    for (let i = 0; i < 9; i++) {
        big[i] = stateData.big[i] || '';
    }
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            small[i][j] = stateData.small[i][j] || '';
        }
    }
    player = stateData.current_player || 'X';
    availableBig = stateData.available_big !== undefined ? stateData.available_big : -1;
    winner = stateData.winner || null;
    buildBoard();
    updateAvailability();
    updateStatus();
}

function leaveRoom() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (peer) {
        peer.destroy();
        peer = null;
    }
    // Clear saved room state
    if (roomId) {
        localStorage.removeItem(`room_${roomId}`);
    }
    roomId = null;
    onlineRole = null;
    creatorRole = null;
    isHost = false;
    pendingRoomId = null;
    document.getElementById('roomInfo').classList.add('hidden');
    document.getElementById('joinForm').classList.add('hidden');
    document.getElementById('roleModal').classList.add('hidden');
    if (gameMode === 'online') {
        resetState();
        buildBoard();
    }
}

function copyRoomLink() {
    if (!roomId) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
        const btn = document.getElementById('copyRoomId');
        const original = btn.textContent;
        btn.textContent = '✓';
        setTimeout(() => { btn.textContent = original; }, 2000);
    });
}

function saveRoomState() {
    if (!roomId) return;
    try {
        const state = {
            roomId,
            creatorRole,
            onlineRole,
            isHost,
            peerId: peer?.id || null, // Save actual Peer ID for reconnection
            gameState: {
                big: [...big],
                small: small.map(row => [...row]),
                player,
                availableBig,
                winner,
                lastMove
            }
        };
        localStorage.setItem(`room_${roomId}`, JSON.stringify(state));
    } catch (e) {
        // Ignore storage errors
    }
}

function loadRoomState(roomIdToLoad) {
    if (!roomIdToLoad) return null;
    try {
        const saved = localStorage.getItem(`room_${roomIdToLoad.toUpperCase()}`);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        // Ignore parse errors
    }
    return null;
}

function restoreRoomState(savedState) {
    if (!savedState) return;
    roomId = savedState.roomId;
    creatorRole = savedState.creatorRole;
    onlineRole = savedState.onlineRole;
    isHost = savedState.isHost;
    
    if (savedState.gameState) {
        const gs = savedState.gameState;
        for (let i = 0; i < 9; i++) {
            big[i] = gs.big[i] || '';
        }
        for (let i = 0; i < 9; i++) {
            for (let j = 0; j < 9; j++) {
                small[i][j] = gs.small[i][j] || '';
            }
        }
        player = gs.player || 'X';
        availableBig = gs.availableBig !== undefined ? gs.availableBig : -1;
        winner = gs.winner || null;
        lastMove = gs.lastMove || null;
        buildBoard();
        updateAvailability();
        updateStatus();
    }
}

// --- Events ---
document.getElementById('area')?.addEventListener('click', (e) => {
    if (!e.target.classList.contains('smallCell')) return;
    if (gameMode === 'ai' && player !== humanSide) return; // not human's turn
    if (gameMode === 'online' && (player !== onlineRole || onlineRole === 'spectator')) return; // not your turn or spectator
    const bigCell = e.target.closest('.bigCell');
    if (!bigCell) return;
    const i = parseInt(bigCell.id, 10);
    const j = parseInt(e.target.id, 10);
    applyMove(i, j);
});

document.getElementById('newGame')?.addEventListener('click', () => {
    cancelAiMove();
    if (gameMode === 'online' && peerConnection && peerConnection.open) {
        peerConnection.send(JSON.stringify({ type: 'reset' }));
        resetState();
        buildBoard();
    } else {
    resetState();
    buildBoard();
    saveState();
    if (gameMode === 'ai' && humanSide === 'O') scheduleAiMove(); // X goes first
    }
});

document.getElementById('modeTwo')?.addEventListener('click', () => {
    cancelAiMove();
    leaveRoom();
    gameMode = 'two';
    syncModeUI();
    saveState();
    updateStatus();
});

document.getElementById('modeOnline')?.addEventListener('click', () => {
    if (typeof Peer === 'undefined') {
        alert('PeerJS library not loaded. Please check your internet connection and refresh the page.');
        return;
    }
    cancelAiMove();
    gameMode = 'online';
    syncModeUI();
    updateStatus();
});

document.getElementById('modeAi')?.addEventListener('click', () => {
    cancelAiMove();
    leaveRoom();
    gameMode = 'ai';
    syncModeUI();
    saveState();
    updateStatus();
});

document.getElementById('createRoom')?.addEventListener('click', createRoom);
document.getElementById('joinRoom')?.addEventListener('click', () => {
    document.getElementById('joinForm').classList.toggle('hidden');
});
document.getElementById('joinRoomBtn')?.addEventListener('click', () => {
    const roomId = document.getElementById('roomIdInput').value.trim().toUpperCase();
    if (roomId.length === 6) {
        // Check for saved state first
        const savedState = loadRoomState(roomId);
        if (savedState && savedState.creatorRole) {
            // Show role selection with creator info
            pendingRoomId = roomId;
            showRoleSelection(savedState.creatorRole);
        } else {
            // No saved state, connect and wait for creator role
            pendingRoomId = roomId;
            joinRoomById(roomId, null);
        }
    } else {
        alert('Room ID must be 6 characters');
    }
});

document.getElementById('selectRoleX')?.addEventListener('click', () => selectRole('X'));
document.getElementById('selectRoleO')?.addEventListener('click', () => selectRole('O'));
document.getElementById('selectRoleSpectator')?.addEventListener('click', () => selectRole('spectator'));
document.getElementById('roomIdInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('joinRoomBtn').click();
    }
});
document.getElementById('copyRoomId')?.addEventListener('click', copyRoomLink);
document.getElementById('leaveRoom')?.addEventListener('click', leaveRoom);

document.getElementById('sideX')?.addEventListener('click', () => {
    humanSide = 'X';
    document.getElementById('sideX').classList.add('active');
    document.getElementById('sideO').classList.remove('active');
    saveState();
    updateStatus();
});

document.getElementById('sideO')?.addEventListener('click', () => {
    humanSide = 'O';
    document.getElementById('sideO').classList.add('active');
    document.getElementById('sideX').classList.remove('active');
    saveState();
    updateStatus();
});

// --- Load ONNX model for AI ---
async function loadPolicyModel() {
    if (typeof ort === 'undefined') {
        console.error('ONNX Runtime not loaded');
        return;
    }
    
    try {
        // Try model/ first (for GitHub Pages), then ../model/ (for local dev)
        try {
            onnxSession = await ort.InferenceSession.create('model/policy_value_net.onnx');
        } catch (e) {
            onnxSession = await ort.InferenceSession.create('../model/policy_value_net.onnx');
        }
        console.log('ONNX model loaded successfully');
    } catch (error) {
        console.error('Failed to load ONNX model:', error);
        console.log('Make sure model/policy_value_net.onnx exists');
    }
}

loadPolicyModel();

// --- Heatmap toggle ---
document.getElementById('heatmapToggle')?.addEventListener('click', () => {
    showHeatmap = true;
    document.getElementById('heatmapToggle').classList.add('active');
    document.querySelector('[data-heatmap="off"]')?.classList.remove('active');
    // Update probabilities when enabling
    if (onnxSession && winner === null) {
        updateProbabilitiesForCurrentPlayer();
    }
});

document.querySelector('[data-heatmap="off"]')?.addEventListener('click', () => {
    showHeatmap = false;
    document.getElementById('heatmapToggle')?.classList.remove('active');
    document.querySelector('[data-heatmap="off"]').classList.add('active');
    clearHeatmap();
});

// Check for room ID in URL
const urlParams = new URLSearchParams(window.location.search);
const roomParam = urlParams.get('room');

if (roomParam) {
    gameMode = 'online';
    syncModeUI();
    // Check for saved state
    const savedState = loadRoomState(roomParam);
    if (savedState) {
        // Restore saved state
        restoreRoomState(savedState);
        // Show room info immediately
        document.getElementById('roomIdDisplay').textContent = savedState.roomId;
        if (savedState.creatorRole) {
            document.getElementById('creatorRoleDisplay').textContent = savedState.creatorRole;
            document.getElementById('creatorRole').classList.remove('hidden');
        }
        document.getElementById('roomInfo').classList.remove('hidden');
        document.getElementById('roomStatus').textContent = 'Reconnecting...';
        // Try to reconnect
        setTimeout(() => {
            if (savedState.isHost) {
                // Restore as host - recreate room with same ID
                // Note: Peer ID will be different, but roomId stays the same
                roomId = savedState.roomId;
                creatorRole = savedState.creatorRole;
                onlineRole = savedState.onlineRole;
                isHost = true;
                createRoom();
            } else {
                // Restore as client - reconnect with saved role
                if (savedState.onlineRole && savedState.onlineRole !== 'spectator') {
                    joinRoomById(roomParam, savedState.onlineRole);
                } else {
                    // Show role selection if no role saved or was spectator
                    showRoleSelection(savedState.creatorRole);
                    pendingRoomId = roomParam.toUpperCase();
                }
            }
        }, 500);
    } else {
        // New connection, wait for creator role
        setTimeout(() => {
            joinRoomById(roomParam, null);
        }, 500);
    }
} else if (loadState()) {
    syncModeUI();
    buildBoard();
    if (gameMode === 'ai' && winner === null && player !== humanSide) scheduleAiMove();
} else {
    buildBoard();
}
