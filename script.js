document.addEventListener('DOMContentLoaded', () => {
    const gameBoard = document.getElementById('game-board');
    const rows = 10;
    const cols = 10;
    const mineCount = 15;
    let board = [];
    let isFirstClick = true;

    function createBoard() {
        // Create board array
        for (let i = 0; i < rows; i++) {
            board[i] = [];
            for (let j = 0; j < cols; j++) {
                board[i][j] = {
                    isMine: false,
                    isRevealed: false,
                    isFlagged: false,
                    adjacentMines: 0
                };
            }
        }
    }

    function placeMines(firstRow, firstCol) {
        let minesPlaced = 0;
        while (minesPlaced < mineCount) {
            const row = Math.floor(Math.random() * rows);
            const col = Math.floor(Math.random() * cols);
            if (row === firstRow && col === firstCol) {
                continue;
            }
            if (!board[row][col].isMine) {
                board[row][col].isMine = true;
                minesPlaced++;
            }
        }
    }

    function calculateAdjacentMines() {
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                if (!board[i][j].isMine) {
                    let count = 0;
                    for (let x = -1; x <= 1; x++) {
                        for (let y = -1; y <= 1; y++) {
                            const newRow = i + x;
                            const newCol = j + y;
                            if (newRow >= 0 && newRow < rows && newCol >= 0 && newCol < cols && board[newRow][newCol].isMine) {
                                count++;
                            }
                        }
                    }
                    board[i][j].adjacentMines = count;
                }
            }
        }
    }

    function renderBoard() {
        gameBoard.innerHTML = '';
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.dataset.row = i;
                cell.dataset.col = j;

                cell.addEventListener('click', () => handleCellClick(i, j));
                cell.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    handleRightClick(i, j);
                });

                if (board[i][j].isRevealed) {
                    cell.classList.add('revealed');
                    if (board[i][j].isMine) {
                        cell.classList.add('mine');
                        cell.textContent = '💣';
                    } else if (board[i][j].adjacentMines > 0) {
                        cell.textContent = board[i][j].adjacentMines;
                        cell.dataset.adjacentMines = board[i][j].adjacentMines;
                    }
                } else if (board[i][j].isFlagged) {
                    cell.classList.add('flagged');
                    cell.textContent = '🚩';
                }

                gameBoard.appendChild(cell);
            }
        }
    }

    function handleCellClick(row, col) {
        if (isFirstClick) {
            isFirstClick = false;
            placeMines(row, col);
            calculateAdjacentMines();
        }

        if (board[row][col].isRevealed || board[row][col].isFlagged) {
            return;
        }

        board[row][col].isRevealed = true;

        if (board[row][col].isMine) {
            gameOver();
        } else if (board[row][col].adjacentMines === 0) {
            revealAdjacentCells(row, col);
        }

        checkWinCondition();
        renderBoard();
    }

    function handleRightClick(row, col) {
        if (board[row][col].isRevealed) {
            return;
        }
        board[row][col].isFlagged = !board[row][col].isFlagged;
        renderBoard();
    }

    function revealAdjacentCells(row, col) {
        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                const newRow = row + x;
                const newCol = col + y;
                if (newRow >= 0 && newRow < rows && newCol >= 0 && newCol < cols) {
                    if (!board[newRow][newCol].isRevealed) {
                         handleCellClick(newRow, newCol);
                    }
                }
            }
        }
    }

    function gameOver() {
        alert('Game Over!');
        // Reveal all mines
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                if (board[i][j].isMine) {
                    board[i][j].isRevealed = true;
                }
            }
        }
        renderBoard();
    }

    function checkWinCondition() {
        let revealedCount = 0;
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                if (board[i][j].isRevealed) {
                    revealedCount++;
                }
            }
        }

        if (revealedCount === rows * cols - mineCount) {
            alert('You Win!');
        }
    }

    createBoard();
    renderBoard();
});