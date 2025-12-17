document.addEventListener('DOMContentLoaded', () => {
    const gameBoard = document.getElementById('game-board');
    const difficultySelect = document.getElementById('difficulty');
    const restartButton = document.getElementById('restart');
    const requireFlagsCheckbox = document.getElementById('require-flags');
    const noGuessCheckbox = document.getElementById('no-guess');
    const seedInput = document.getElementById('seed');
    const newSeedButton = document.getElementById('new-seed');
    const copyLinkButton = document.getElementById('copy-link');
    const mineCounterEl = document.getElementById('mine-counter');
    const timerEl = document.getElementById('timer');
    const statusEl = document.getElementById('status');

    const DIFFICULTIES = {
        normal: { rows: 10, cols: 10, mines: 15 },
        easy: { rows: 9, cols: 9, mines: 10 },
        medium: { rows: 16, cols: 16, mines: 40 },
        hard: { rows: 16, cols: 30, mines: 99 }
    };

    const engineModule = globalThis.Minesweeper;
    if (!engineModule || !engineModule.MinesweeperEngine) {
        statusEl.textContent = 'Error: engine not loaded';
        return;
    }

    const { MinesweeperEngine, generateRandomSeed } = engineModule;

    const REPLAY_HISTORY_KEY = 'minesweeper.replayHistory.v1';
    const MAX_REPLAY_HISTORY = 50;

    let engine = null;
    let cellEls = [];
    let timerIntervalId = null;
    let startTimeMs = 0;
    let pendingAutoStart = null;
    let lastLoadedSeed = null;

    function stopTimer() {
        if (timerIntervalId !== null) {
            clearInterval(timerIntervalId);
            timerIntervalId = null;
        }
    }

    function updateTimer() {
        if (!engine || engine.status !== 'playing') return;
        timerEl.textContent = String(Math.floor((Date.now() - startTimeMs) / 1000));
    }

    function startTimer() {
        stopTimer();
        startTimeMs = Date.now();
        updateTimer();
        timerIntervalId = setInterval(updateTimer, 1000);
    }

    function updateMineCounter() {
        if (!engine) return;
        mineCounterEl.textContent = String(engine.mineCount - engine.flaggedCount);
    }

    function updateCopyLinkButtonState() {
        if (!copyLinkButton) return;

        const enabled = Boolean(engine && engine.startRow !== null && engine.startCol !== null);
        copyLinkButton.disabled = !enabled;
        copyLinkButton.title = enabled ? 'Copies a link that replays this exact board' : 'Start a game to enable';
    }

    function buildDomGrid() {
        gameBoard.innerHTML = '';
        gameBoard.style.gridTemplateColumns = `repeat(${engine.cols}, var(--cell-size))`;
        gameBoard.style.gridTemplateRows = `repeat(${engine.rows}, var(--cell-size))`;

        const fragment = document.createDocumentFragment();
        cellEls = Array.from({ length: engine.rows }, () =>
            Array.from({ length: engine.cols }, () => null)
        );

        for (let r = 0; r < engine.rows; r++) {
            for (let c = 0; c < engine.cols; c++) {
                const cellEl = document.createElement('div');
                cellEl.className = 'cell';
                cellEl.dataset.row = String(r);
                cellEl.dataset.col = String(c);
                fragment.appendChild(cellEl);
                cellEls[r][c] = cellEl;
            }
        }

        gameBoard.appendChild(fragment);
    }

    function renderCell(row, col) {
        const state = engine.getCell(row, col);
        const el = cellEls[row][col];

        const treatAsRevealed =
            state.isRevealed || (engine.status === 'lost' && (state.isMine || state.isFlagged));
        el.classList.toggle('revealed', treatAsRevealed);
        el.classList.toggle('flagged', !state.isRevealed && state.isFlagged);

        const showMine = state.isMine && (state.isRevealed || engine.status === 'lost');
        el.classList.toggle('mine', showMine);

        const wrongFlag = engine.status === 'lost' && state.isFlagged && !state.isMine;
        el.classList.toggle('wrong-flag', wrongFlag);

        el.textContent = '';
        delete el.dataset.adjacentMines;

        if (wrongFlag) {
            el.textContent = '❌';
            return;
        }

        if (showMine) {
            el.textContent = '💣';
            return;
        }

        if (!state.isRevealed && state.isFlagged) {
            el.textContent = '🚩';
            return;
        }

        if (state.isRevealed && !state.isMine && state.adjacentMines > 0) {
            el.textContent = String(state.adjacentMines);
            el.dataset.adjacentMines = String(state.adjacentMines);
        }
    }

    function renderAllCells() {
        for (let r = 0; r < engine.rows; r++) {
            for (let c = 0; c < engine.cols; c++) {
                renderCell(r, c);
            }
        }
    }

    function getCellFromEventTarget(target) {
        const elementTarget = target?.nodeType === Node.TEXT_NODE ? target.parentElement : target;
        const cellEl = elementTarget?.closest?.('.cell');
        if (!cellEl || !gameBoard.contains(cellEl)) return null;

        const row = Number(cellEl.dataset.row);
        const col = Number(cellEl.dataset.col);
        if (!Number.isInteger(row) || !Number.isInteger(col)) return null;

        return { row, col };
    }

    function updateStatusUi() {
        if (engine.status === 'ready') {
            statusEl.textContent = 'Ready (click a cell to start)';
        } else if (engine.startRow !== null && engine.startCol !== null) {
            statusEl.textContent = `${engine.message} (start ${engine.startRow},${engine.startCol})`;
        } else {
            statusEl.textContent = engine.message;
        }
        gameBoard.classList.toggle('disabled', engine.status === 'won' || engine.status === 'lost');
    }

    function updateUrlFromState() {
        try {
            const params = new URLSearchParams();
            params.set('difficulty', difficultySelect.value);
            params.set('seed', seedInput.value.trim());
            if (noGuessCheckbox.checked) params.set('noguess', '1');
            if (requireFlagsCheckbox.checked) params.set('requireFlags', '1');
            if (engine && engine.startRow !== null && engine.startCol !== null) {
                params.set('start', `${engine.startRow},${engine.startCol}`);
            }

            const newUrl = params.toString().length > 0 ? `${location.pathname}?${params.toString()}` : location.pathname;
            history.replaceState(null, '', newUrl);
        } catch {
        }
    }

    function getReplayUrl() {
        const url = new URL(location.href);
        url.search = '';
        url.hash = '';

        url.searchParams.set('difficulty', difficultySelect.value);
        url.searchParams.set('seed', engine ? engine.seed : seedInput.value.trim());

        if (engine ? engine.noGuess : noGuessCheckbox.checked) url.searchParams.set('noguess', '1');
        if (engine ? engine.requireFlagsToWin : requireFlagsCheckbox.checked) url.searchParams.set('requireFlags', '1');

        if (engine && engine.startRow !== null && engine.startCol !== null) {
            url.searchParams.set('start', `${engine.startRow},${engine.startCol}`);
        }

        return url.toString();
    }

    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
        }

        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            textarea.style.top = '0';
            document.body.appendChild(textarea);
            textarea.select();
            const ok = document.execCommand('copy');
            textarea.remove();
            return ok;
        } catch {
            return false;
        }
    }

    async function handleCopyReplayLink() {
        if (!engine || engine.startRow === null || engine.startCol === null) return;

        const url = getReplayUrl();
        const ok = await copyToClipboard(url);
        if (!ok) {
            window.prompt('Copy replay link:', url);
            return;
        }

        const prevText = copyLinkButton.textContent;
        copyLinkButton.textContent = 'Copied!';
        copyLinkButton.disabled = true;
        setTimeout(() => {
            copyLinkButton.textContent = prevText;
            updateCopyLinkButtonState();
        }, 1200);
    }

    gameBoard.addEventListener('click', (e) => {
        const coords = getCellFromEventTarget(e.target);
        if (!coords) return;
        const prevStatus = engine.status;
        const result = engine.click(coords.row, coords.col);

        if (result.started) {
            startTimer();
            recordReplayStart({
                difficulty: difficultySelect.value,
                seed: engine.seed,
                noGuess: Boolean(noGuessCheckbox.checked),
                requireFlags: Boolean(requireFlagsCheckbox.checked),
                startRow: engine.startRow,
                startCol: engine.startCol
            });
            updateUrlFromState();
            updateCopyLinkButtonState();
        }

        if (engine.status === 'won' || engine.status === 'lost') {
            stopTimer();
            renderAllCells();
        } else {
            for (const [r, c] of result.changed) renderCell(r, c);
        }

        if (prevStatus !== engine.status) updateStatusUi();
        updateMineCounter();
    });

    gameBoard.addEventListener('contextmenu', (e) => {
        const coords = getCellFromEventTarget(e.target);
        if (!coords) return;
        e.preventDefault();
        const prevStatus = engine.status;
        const result = engine.toggleFlag(coords.row, coords.col);

        for (const [r, c] of result.changed) renderCell(r, c);
        updateMineCounter();

        if (prevStatus !== engine.status) {
            stopTimer();
            renderAllCells();
            updateStatusUi();
        }
    });

    function parseStartParam(value) {
        const match = /^\s*(\d+)\s*,\s*(\d+)\s*$/.exec(value ?? '');
        if (!match) return null;
        return { row: Number(match[1]), col: Number(match[2]) };
    }

    function loadReplayHistory() {
        try {
            const raw = localStorage.getItem(REPLAY_HISTORY_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed.filter((entry) => {
                return (
                    entry &&
                    typeof entry.difficulty === 'string' &&
                    typeof entry.seed === 'string' &&
                    typeof entry.noGuess === 'boolean' &&
                    typeof entry.requireFlags === 'boolean' &&
                    Number.isInteger(entry.startRow) &&
                    Number.isInteger(entry.startCol) &&
                    Number.isFinite(entry.timestamp)
                );
            });
        } catch {
            return [];
        }
    }

    function saveReplayHistory(history) {
        try {
            localStorage.setItem(REPLAY_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_REPLAY_HISTORY)));
        } catch {
        }
    }

    function recordReplayStart({ difficulty, seed, noGuess, requireFlags, startRow, startCol }) {
        if (startRow === null || startCol === null) return;
        if (!Number.isInteger(startRow) || !Number.isInteger(startCol)) return;

        const history = loadReplayHistory();
        const filtered = history.filter(
            (entry) =>
                !(
                    entry.seed === seed &&
                    entry.difficulty === difficulty &&
                    entry.noGuess === noGuess &&
                    entry.startRow === startRow &&
                    entry.startCol === startCol
                )
        );

        filtered.unshift({
            difficulty,
            seed,
            noGuess,
            requireFlags,
            startRow,
            startCol,
            timestamp: Date.now()
        });

        saveReplayHistory(filtered);
    }

    function findReplayEntry(seed) {
        const history = loadReplayHistory();
        return history.find((entry) => entry.seed === seed) ?? null;
    }

    function parseSeedAndStart(value) {
        const trimmed = String(value ?? '').trim();
        if (trimmed.length === 0) return { seed: '', start: null };

        const atIndex = trimmed.lastIndexOf('@');
        if (atIndex !== -1) {
            const afterAt = trimmed.slice(atIndex + 1);
            const start = parseStartParam(afterAt);
            if (start) {
                return { seed: trimmed.slice(0, atIndex).trim(), start };
            }
        }

        return { seed: trimmed, start: null };
    }

    function applyUrlParams() {
        const params = new URLSearchParams(location.search);
        const difficulty = params.get('difficulty');
        const seed = params.get('seed');
        const noGuess = params.get('noguess');
        const requireFlags = params.get('requireFlags');
        const start = params.get('start');

        if (difficulty && Object.prototype.hasOwnProperty.call(DIFFICULTIES, difficulty)) {
            difficultySelect.value = difficulty;
        }

        if (typeof seed === 'string') {
            seedInput.value = seed;
        }

        noGuessCheckbox.checked = noGuess === '1';
        requireFlagsCheckbox.checked = requireFlags === '1';

        pendingAutoStart = parseStartParam(start);
    }

    function ensureSeedValue() {
        const trimmed = seedInput.value.trim();
        if (trimmed.length > 0) {
            seedInput.value = trimmed;
            return trimmed;
        }

        const generated = generateRandomSeed();
        seedInput.value = generated;
        return generated;
    }

    function resetGame() {
        const parsedSeed = parseSeedAndStart(seedInput.value);
        if (parsedSeed.start) {
            pendingAutoStart = pendingAutoStart ?? parsedSeed.start;
        }
        seedInput.value = parsedSeed.seed;

        const seed = ensureSeedValue();

        const seedChanged = seed !== lastLoadedSeed;
        if (!pendingAutoStart && seedChanged) {
            const replay = findReplayEntry(seed);
            if (replay) {
                if (Object.prototype.hasOwnProperty.call(DIFFICULTIES, replay.difficulty)) {
                    difficultySelect.value = replay.difficulty;
                }
                noGuessCheckbox.checked = replay.noGuess;
                requireFlagsCheckbox.checked = replay.requireFlags;
                pendingAutoStart = { row: replay.startRow, col: replay.startCol };
            }
        }

        const config = DIFFICULTIES[difficultySelect.value] ?? DIFFICULTIES.normal;
        engine = new MinesweeperEngine({
            rows: config.rows,
            cols: config.cols,
            mines: config.mines,
            seed,
            noGuess: Boolean(noGuessCheckbox.checked),
            requireFlagsToWin: Boolean(requireFlagsCheckbox.checked)
        });
        lastLoadedSeed = seed;

        stopTimer();
        timerEl.textContent = '0';

        buildDomGrid();
        renderAllCells();
        updateMineCounter();
        updateStatusUi();
        updateCopyLinkButtonState();
        updateUrlFromState();

        if (pendingAutoStart) {
            const { row, col } = pendingAutoStart;
            pendingAutoStart = null;
            const result = engine.click(row, col);
            if (result.started) startTimer();
            for (const [r, c] of result.changed) renderCell(r, c);
            if (engine.status === 'won' || engine.status === 'lost') {
                stopTimer();
                renderAllCells();
            }
            if (result.started) {
                recordReplayStart({
                    difficulty: difficultySelect.value,
                    seed: engine.seed,
                    noGuess: Boolean(noGuessCheckbox.checked),
                    requireFlags: Boolean(requireFlagsCheckbox.checked),
                    startRow: engine.startRow,
                    startCol: engine.startCol
                });
            }
            updateMineCounter();
            updateStatusUi();
            updateCopyLinkButtonState();
            updateUrlFromState();
        }
    }

    function setRequireFlagsToWin(enabled) {
        if (!engine) return;
        const prevStatus = engine.status;
        const result = engine.setRequireFlagsToWin(enabled);
        if (result.statusChanged || prevStatus !== engine.status) {
            stopTimer();
            renderAllCells();
            updateStatusUi();
        }
        updateMineCounter();
        updateUrlFromState();
    }

    difficultySelect.addEventListener('change', resetGame);
    restartButton.addEventListener('click', resetGame);
    seedInput.addEventListener('change', resetGame);
    seedInput.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        resetGame();
    });
    noGuessCheckbox.addEventListener('change', resetGame);
    requireFlagsCheckbox.addEventListener('change', () => setRequireFlagsToWin(Boolean(requireFlagsCheckbox.checked)));
    newSeedButton.addEventListener('click', () => {
        seedInput.value = generateRandomSeed();
        resetGame();
    });
    copyLinkButton?.addEventListener('click', handleCopyReplayLink);

    applyUrlParams();
    resetGame();
});
