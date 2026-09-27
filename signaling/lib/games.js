// Server-authoritative tic-tac-toe so neither client can cheat.

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function newGame(inviterId) {
  return { status: "invited", inviter: inviterId, x: null, o: null, board: Array(9).fill(null), turn: null, winner: null, line: null, score: {} };
}

function start(game, inviterId, accepterId) {
  // Alternate who goes first between rounds
  const inviterFirst = !game.lastFirst || game.lastFirst !== inviterId;
  game.x = inviterFirst ? inviterId : accepterId;
  game.o = inviterFirst ? accepterId : inviterId;
  game.lastFirst = game.x;
  game.board = Array(9).fill(null);
  game.turn = game.x;
  game.winner = null;
  game.line = null;
  game.status = "playing";
  return game;
}

// Returns an error string, or null when the move was applied.
function move(game, playerId, cell) {
  if (game.status !== "playing") return "Game is not in progress";
  if (game.turn !== playerId) return "Not your turn";
  if (!Number.isInteger(cell) || cell < 0 || cell > 8) return "Invalid cell";
  if (game.board[cell]) return "Cell already taken";

  const mark = playerId === game.x ? "X" : "O";
  game.board[cell] = mark;

  for (const line of LINES) {
    if (line.every((i) => game.board[i] === mark)) {
      game.status = "over";
      game.winner = playerId;
      game.line = line;
      game.score[playerId] = (game.score[playerId] || 0) + 1;
      return null;
    }
  }
  if (game.board.every(Boolean)) {
    game.status = "over";
    game.winner = "draw";
    return null;
  }
  game.turn = playerId === game.x ? game.o : game.x;
  return null;
}

function publicState(game) {
  if (!game) return null;
  const { status, inviter, x, o, board, turn, winner, line, score } = game;
  return { status, inviter, x, o, board, turn, winner, line, score };
}

module.exports = { newGame, start, move, publicState };
