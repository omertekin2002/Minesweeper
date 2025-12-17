const test = require('node:test');
const assert = require('node:assert/strict');

const {
    MinesweeperEngine,
    createSeededRng,
    isSolvableBySimpleRules
} = require('../engine.js');

function getMineIndices(engine) {
    const indices = [];
    for (let r = 0; r < engine.rows; r++) {
        for (let c = 0; c < engine.cols; c++) {
            if (engine.board[r][c].isMine) indices.push(r * engine.cols + c);
        }
    }
    indices.sort((a, b) => a - b);
    return indices;
}

function countNeighborMines(engine, row, col) {
    let count = 0;
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const r = row + dr;
            const c = col + dc;
            if (r < 0 || r >= engine.rows || c < 0 || c >= engine.cols) continue;
            if (engine.board[r][c].isMine) count++;
        }
    }
    return count;
}

test('createSeededRng is deterministic', () => {
    const rngA1 = createSeededRng('abc');
    const rngA2 = createSeededRng('abc');
    const seq1 = Array.from({ length: 8 }, () => rngA1());
    const seq2 = Array.from({ length: 8 }, () => rngA2());
    assert.deepEqual(seq1, seq2);

    const rngB = createSeededRng('abcd');
    const seq3 = Array.from({ length: 8 }, () => rngB());
    assert.notDeepEqual(seq1, seq3);
});

test('minefield is deterministic for same seed and first click', () => {
    const config = {
        rows: 10,
        cols: 10,
        mines: 15,
        seed: 'same-seed',
        noGuess: false,
        requireFlagsToWin: false
    };

    const engine1 = new MinesweeperEngine(config);
    engine1.click(3, 3);

    const engine2 = new MinesweeperEngine(config);
    engine2.click(3, 3);

    assert.deepEqual(getMineIndices(engine1), getMineIndices(engine2));
});

test('first click safe zone has no mines', () => {
    const engine = new MinesweeperEngine({
        rows: 10,
        cols: 10,
        mines: 15,
        seed: 'safe-zone',
        noGuess: false
    });

    engine.click(0, 0);
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const r = 0 + dr;
            const c = 0 + dc;
            if (r < 0 || r >= engine.rows || c < 0 || c >= engine.cols) continue;
            assert.equal(engine.board[r][c].isMine, false);
        }
    }
});

test('adjacentMines matches actual neighboring mine count', () => {
    const engine = new MinesweeperEngine({
        rows: 10,
        cols: 10,
        mines: 15,
        seed: 'adjacent-check',
        noGuess: false
    });

    engine.click(4, 4);

    for (let r = 0; r < engine.rows; r++) {
        for (let c = 0; c < engine.cols; c++) {
            const cell = engine.board[r][c];
            if (cell.isMine) continue;
            assert.equal(cell.adjacentMines, countNeighborMines(engine, r, c));
        }
    }
});

test('noGuess generation produces a board solvable by simple rules', () => {
    const engine = new MinesweeperEngine({
        rows: 9,
        cols: 9,
        mines: 10,
        seed: 'seed-0',
        noGuess: true,
        maxGenerateAttempts: 120
    });

    engine.click(4, 4);

    assert.equal(engine.generation.usedFallback, false);
    assert.equal(
        isSolvableBySimpleRules(engine.board, engine.rows, engine.cols, engine.mineCount, engine.startRow, engine.startCol),
        true
    );
});

