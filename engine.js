(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.Minesweeper = factory();
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
    function xmur3(str) {
        let h = 1779033703 ^ str.length;
        for (let i = 0; i < str.length; i++) {
            h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
            h = (h << 13) | (h >>> 19);
        }
        return function () {
            h = Math.imul(h ^ (h >>> 16), 2246822507);
            h = Math.imul(h ^ (h >>> 13), 3266489909);
            h ^= h >>> 16;
            return h >>> 0;
        };
    }

    function mulberry32(seedInt) {
        let a = seedInt >>> 0;
        return function () {
            let t = (a += 0x6d2b79f5);
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function createSeededRng(seed) {
        const seedString = String(seed ?? '');
        const hash = xmur3(seedString);
        return mulberry32(hash());
    }

    function randomInt(rng, maxExclusive) {
        return Math.floor(rng() * maxExclusive);
    }

    function generateRandomSeed() {
        if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
            const arr = new Uint32Array(2);
            crypto.getRandomValues(arr);
            return `${arr[0].toString(16)}${arr[1].toString(16)}`;
        }

        if (typeof require === 'function') {
            try {
                const nodeCrypto = require('crypto');
                return nodeCrypto.randomBytes(8).toString('hex');
            } catch {
            }
        }

        const randomPart = Math.floor(Math.random() * 1e9).toString(16);
        return `${Date.now().toString(16)}${randomPart}`;
    }

    function inBounds(rows, cols, row, col) {
        return row >= 0 && row < rows && col >= 0 && col < cols;
    }

    function getNeighbors(rows, cols, row, col) {
        const neighbors = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = row + dr;
                const nc = col + dc;
                if (inBounds(rows, cols, nr, nc)) neighbors.push([nr, nc]);
            }
        }
        return neighbors;
    }

    function getSafeZoneSet(rows, cols, firstRow, firstCol) {
        const safe = new Set();
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const r = firstRow + dr;
                const c = firstCol + dc;
                if (!inBounds(rows, cols, r, c)) continue;
                safe.add(r * cols + c);
            }
        }
        return safe;
    }

    function shuffleInPlace(array, rng) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = randomInt(rng, i + 1);
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    function createEmptyBoard(rows, cols) {
        return Array.from({ length: rows }, () =>
            Array.from({ length: cols }, () => ({
                isMine: false,
                adjacentMines: 0,
                isRevealed: false,
                isFlagged: false
            }))
        );
    }

    function placeMines(board, rows, cols, mineCount, firstRow, firstCol, rng) {
        const safe = getSafeZoneSet(rows, cols, firstRow, firstCol);
        const available = [];

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const idx = r * cols + c;
                if (!safe.has(idx)) available.push(idx);
            }
        }

        const minesToPlace = Math.min(mineCount, available.length);
        shuffleInPlace(available, rng);

        for (let i = 0; i < minesToPlace; i++) {
            const idx = available[i];
            const r = Math.floor(idx / cols);
            const c = idx % cols;
            board[r][c].isMine = true;
        }

        return minesToPlace;
    }

    function calculateAdjacentMines(board, rows, cols) {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = board[r][c];
                if (cell.isMine) continue;

                let count = 0;
                for (const [nr, nc] of getNeighbors(rows, cols, r, c)) {
                    if (board[nr][nc].isMine) count++;
                }
                cell.adjacentMines = count;
            }
        }
    }

    function isSolvableBySimpleRules(board, rows, cols, mineCount, startRow, startCol) {
        const revealed = Array.from({ length: rows }, () => Array(cols).fill(false));
        const flagged = Array.from({ length: rows }, () => Array(cols).fill(false));

        let revealedSafeCount = 0;

        function revealFrom(startCells) {
            const queue = [...startCells];
            let queueIndex = 0;

            while (queueIndex < queue.length) {
                const [row, col] = queue[queueIndex++];
                if (flagged[row][col] || revealed[row][col]) continue;

                const cell = board[row][col];
                if (cell.isMine) return false;

                revealed[row][col] = true;
                revealedSafeCount++;

                if (cell.adjacentMines === 0) {
                    for (const [nr, nc] of getNeighbors(rows, cols, row, col)) {
                        if (!flagged[nr][nc] && !revealed[nr][nc]) queue.push([nr, nc]);
                    }
                }
            }

            return true;
        }

        if (!inBounds(rows, cols, startRow, startCol)) return false;
        if (!revealFrom([[startRow, startCol]])) return false;

        let progress = true;
        while (progress) {
            progress = false;

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (!revealed[r][c]) continue;
                    const cell = board[r][c];
                    if (cell.adjacentMines === 0) continue;

                    let flaggedNeighbors = 0;
                    const unrevealedUnflagged = [];
                    for (const [nr, nc] of getNeighbors(rows, cols, r, c)) {
                        if (flagged[nr][nc]) flaggedNeighbors++;
                        else if (!revealed[nr][nc]) unrevealedUnflagged.push([nr, nc]);
                    }

                    if (unrevealedUnflagged.length === 0) continue;

                    if (flaggedNeighbors === cell.adjacentMines) {
                        if (!revealFrom(unrevealedUnflagged)) return false;
                        progress = true;
                        continue;
                    }

                    if (flaggedNeighbors + unrevealedUnflagged.length === cell.adjacentMines) {
                        for (const [nr, nc] of unrevealedUnflagged) {
                            if (!flagged[nr][nc]) {
                                flagged[nr][nc] = true;
                                progress = true;
                            }
                        }
                    }
                }
            }
        }

        return revealedSafeCount === rows * cols - mineCount;
    }

    async function generateMinefield({
        rows,
        cols,
        mineCount,
        startRow,
        startCol,
        rng,
        noGuess,
        maxAttempts
    }) {
        const attempts = Math.max(1, maxAttempts ?? 1);
        let lastBoard = null;
        let lastMineCount = mineCount;

        // Performance optimization: Use requestIdleCallback if available
        const useIdleCallback = typeof requestIdleCallback === 'function';

        for (let attempt = 1; attempt <= attempts; attempt++) {
            const board = createEmptyBoard(rows, cols);
            const minesPlaced = placeMines(board, rows, cols, mineCount, startRow, startCol, rng);
            calculateAdjacentMines(board, rows, cols);

            lastBoard = board;
            lastMineCount = minesPlaced;

            if (!noGuess) {
                return { board, minesPlaced, attemptCount: 1, usedFallback: false };
            }

            // Performance optimization: Use idle time for solvability checks
            if (isSolvableBySimpleRules(board, rows, cols, minesPlaced, startRow, startCol)) {
                return { board, minesPlaced, attemptCount: attempt, usedFallback: false };
            }

            // Yield to main thread if this is taking too long
            if (attempt % 5 === 0 && useIdleCallback) {
                await new Promise((resolve) => {
                    requestIdleCallback(resolve, { timeout: 100 });
                });
            }
        }

        return { board: lastBoard, minesPlaced: lastMineCount, attemptCount: attempts, usedFallback: true };
    }

    class MinesweeperEngine {
        constructor({
            rows,
            cols,
            mines,
            seed,
            noGuess = false,
            requireFlagsToWin = false,
            maxGenerateAttempts
        }) {
            this.reset({
                rows,
                cols,
                mines,
                seed,
                noGuess,
                requireFlagsToWin,
                maxGenerateAttempts
            });
        }

        reset({ rows, cols, mines, seed, noGuess, requireFlagsToWin, maxGenerateAttempts }) {
            this.rows = rows;
            this.cols = cols;
            this.mineCount = mines;
            this.seed = seed && String(seed).trim().length > 0 ? String(seed) : generateRandomSeed();
            this.noGuess = Boolean(noGuess);
            this.requireFlagsToWin = Boolean(requireFlagsToWin);
            this.maxGenerateAttempts = maxGenerateAttempts ?? null;

            this.status = 'ready';
            this.message = 'Ready';
            this.startRow = null;
            this.startCol = null;
            this.generation = { attemptCount: 0, usedFallback: false };

            this.flaggedCount = 0;
            this.revealedSafeCount = 0;
            this._rng = createSeededRng(this.seed);
            this.board = createEmptyBoard(this.rows, this.cols);
        }

        getCell(row, col) {
            return this.board[row][col];
        }

        _setStatus(status, message) {
            this.status = status;
            this.message = message;
        }

        _defaultMaxAttempts() {
            const cellCount = this.rows * this.cols;
            if (cellCount <= 100) return 80;
            if (cellCount <= 256) return 50;
            if (cellCount <= 480) return 25;
            return 15;
        }

        async _startIfNeeded(firstRow, firstCol) {
            if (this.status !== 'ready') return null;

            this.startRow = firstRow;
            this.startCol = firstCol;

            const maxAttempts = this.noGuess
                ? Number.isInteger(this.maxGenerateAttempts)
                    ? this.maxGenerateAttempts
                    : this._defaultMaxAttempts()
                : 1;

            const result = await generateMinefield({
                rows: this.rows,
                cols: this.cols,
                mineCount: this.mineCount,
                startRow: firstRow,
                startCol: firstCol,
                rng: this._rng,
                noGuess: this.noGuess,
                maxAttempts
            });

            this.board = result.board;
            this.mineCount = result.minesPlaced;
            this.generation = { attemptCount: result.attemptCount, usedFallback: result.usedFallback };

            this._setStatus('playing', result.usedFallback ? 'Playing (no-guess fallback)' : 'Playing');
            return result;
        }

        _revealFrom(startCells) {
            const changed = [];
            const queue = [...startCells];
            let queueIndex = 0;

            while (queueIndex < queue.length) {
                const [row, col] = queue[queueIndex++];
                if (!inBounds(this.rows, this.cols, row, col)) continue;

                const cell = this.board[row][col];
                if (cell.isRevealed || cell.isFlagged) continue;

                cell.isRevealed = true;
                changed.push([row, col]);

                if (cell.isMine) {
                    this._setStatus('lost', 'Game Over');
                    return { hitMine: true, changed };
                }

                this.revealedSafeCount++;

                if (cell.adjacentMines === 0) {
                    for (const [nr, nc] of getNeighbors(this.rows, this.cols, row, col)) {
                        const neighbor = this.board[nr][nc];
                        if (!neighbor.isRevealed && !neighbor.isFlagged) queue.push([nr, nc]);
                    }
                }
            }

            return { hitMine: false, changed };
        }

        _checkWinCondition() {
            if (this.status !== 'playing') return false;

            const safeCellsTotal = this.rows * this.cols - this.mineCount;
            if (this.revealedSafeCount !== safeCellsTotal) return false;

            if (this.requireFlagsToWin) {
                if (this.flaggedCount !== this.mineCount) return false;
                for (let r = 0; r < this.rows; r++) {
                    for (let c = 0; c < this.cols; c++) {
                        const cell = this.board[r][c];
                        if (cell.isFlagged && !cell.isMine) return false;
                    }
                }
            }

            this._setStatus('won', 'You Win!');

            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    const cell = this.board[r][c];
                    if (cell.isMine) cell.isFlagged = true;
                }
            }
            this.flaggedCount = this.mineCount;
            return true;
        }

        async click(row, col) {
            const prevStatus = this.status;
            const started = prevStatus === 'ready';

            if (this.status === 'won' || this.status === 'lost') {
                return { changed: [], started: false, statusChanged: false };
            }

            if (!inBounds(this.rows, this.cols, row, col)) {
                return { changed: [], started: false, statusChanged: false };
            }

            const cell = this.board[row][col];

            if (cell.isFlagged) {
                return { changed: [], started: false, statusChanged: false };
            }

            let minefieldResult = null;
            if (this.status === 'ready') {
                minefieldResult = await this._startIfNeeded(row, col);
            }

            const currentCell = this.board[row][col];
            if (currentCell.isRevealed) {
                if (this.status === 'playing' && currentCell.adjacentMines > 0) {
                    const chordResult = this.chord(row, col);
                    return {
                        ...chordResult,
                        started,
                        minefield: minefieldResult,
                        statusChanged: prevStatus !== this.status
                    };
                }
                return { changed: [], started, minefield: minefieldResult, statusChanged: prevStatus !== this.status };
            }

            const revealResult = this._revealFrom([[row, col]]);
            if (!revealResult.hitMine) {
                this._checkWinCondition();
            }

            return {
                changed: revealResult.changed,
                started,
                minefield: minefieldResult,
                statusChanged: prevStatus !== this.status
            };
        }

        chord(row, col) {
            const prevStatus = this.status;
            if (this.status !== 'playing') {
                return { changed: [], statusChanged: false };
            }

            if (!inBounds(this.rows, this.cols, row, col)) {
                return { changed: [], statusChanged: false };
            }

            const cell = this.board[row][col];
            if (!cell.isRevealed || cell.adjacentMines === 0) {
                return { changed: [], statusChanged: false };
            }

            let flaggedNeighbors = 0;
            const candidates = [];
            for (const [nr, nc] of getNeighbors(this.rows, this.cols, row, col)) {
                const neighbor = this.board[nr][nc];
                if (neighbor.isFlagged) flaggedNeighbors++;
                else if (!neighbor.isRevealed) candidates.push([nr, nc]);
            }

            if (flaggedNeighbors !== cell.adjacentMines || candidates.length === 0) {
                return { changed: [], statusChanged: false };
            }

            const revealResult = this._revealFrom(candidates);
            if (!revealResult.hitMine) {
                this._checkWinCondition();
            }

            return { changed: revealResult.changed, statusChanged: prevStatus !== this.status };
        }

        toggleFlag(row, col) {
            const prevStatus = this.status;
            if (this.status === 'won' || this.status === 'lost') {
                return { changed: [], statusChanged: false };
            }

            if (!inBounds(this.rows, this.cols, row, col)) {
                return { changed: [], statusChanged: false };
            }

            const cell = this.board[row][col];
            if (cell.isRevealed) {
                return { changed: [], statusChanged: false };
            }

            cell.isFlagged = !cell.isFlagged;
            this.flaggedCount += cell.isFlagged ? 1 : -1;
            this._checkWinCondition();
            return { changed: [[row, col]], statusChanged: prevStatus !== this.status };
        }

        setRequireFlagsToWin(enabled) {
            const prevStatus = this.status;
            this.requireFlagsToWin = Boolean(enabled);
            this._checkWinCondition();
            return { statusChanged: prevStatus !== this.status };
        }
    }

    return {
        MinesweeperEngine,
        createSeededRng,
        generateRandomSeed,
        isSolvableBySimpleRules
    };
});
