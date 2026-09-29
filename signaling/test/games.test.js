const test = require("node:test");
const assert = require("node:assert");
const games = require("../lib/games");

function play(game, moves) {
  for (const [player, cell] of moves) {
    const err = games.move(game, player, cell);
    if (err) return err;
  }
  return null;
}

test("inviter moves first in the first round", () => {
  const g = games.start(games.newGame("a"), "a", "b");
  assert.strictEqual(g.x, "a");
  assert.strictEqual(g.turn, "a");
});

test("turn order is enforced", () => {
  const g = games.start(games.newGame("a"), "a", "b");
  assert.strictEqual(games.move(g, "b", 0), "Not your turn");
  assert.strictEqual(games.move(g, "a", 0), null);
  assert.strictEqual(games.move(g, "b", 0), "Cell already taken");
  assert.strictEqual(games.move(g, "b", 9), "Invalid cell");
});

test("detects a win and keeps score", () => {
  const g = games.start(games.newGame("a"), "a", "b");
  assert.strictEqual(play(g, [["a", 0], ["b", 3], ["a", 1], ["b", 4], ["a", 2]]), null);
  assert.strictEqual(g.status, "over");
  assert.strictEqual(g.winner, "a");
  assert.deepStrictEqual(g.line, [0, 1, 2]);
  assert.strictEqual(g.score.a, 1);
  assert.strictEqual(games.move(g, "b", 5), "Game is not in progress");
});

test("detects a draw", () => {
  const g = games.start(games.newGame("a"), "a", "b");
  // X O X / X O O / O X X
  play(g, [["a", 0], ["b", 1], ["a", 2], ["b", 4], ["a", 3], ["b", 5], ["a", 7], ["b", 6], ["a", 8]]);
  assert.strictEqual(g.status, "over");
  assert.strictEqual(g.winner, "draw");
});

test("first player alternates on rematch", () => {
  const g = games.start(games.newGame("a"), "a", "b");
  assert.strictEqual(g.x, "a");
  games.start(g, "a", "b");
  assert.strictEqual(g.x, "b");
});
