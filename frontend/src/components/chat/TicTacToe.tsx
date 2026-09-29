import { Box, Button, Paper, Stack, Typography, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

export interface GameState {
  status: "invited" | "playing" | "over";
  inviter: string;
  x: string | null;
  o: string | null;
  board: (null | "X" | "O")[];
  turn: string | null;
  winner: string | null;
  line: number[] | null;
  score: Record<string, number>;
}

interface Props {
  game: GameState;
  myId: string;
  onAction: (action: "accept" | "decline" | "quit" | "move" | "rematch", cell?: number) => void;
}

// State lives on the server; this component only renders it and sends intents.
export default function TicTacToe({ game, myId, onAction }: Props) {
  const iInvited = game.inviter === myId;
  const myMark = game.x === myId ? "X" : game.o === myId ? "O" : null;
  const myTurn = game.status === "playing" && game.turn === myId;
  const myScore = game.score?.[myId] || 0;
  const theirScore = Object.entries(game.score || {}).filter(([k]) => k !== myId).reduce((a, [, v]) => a + v, 0);

  let status = "";
  if (game.status === "invited") status = iInvited ? "Waiting for the stranger to accept…" : "The stranger wants to play tic-tac-toe!";
  else if (game.status === "playing") status = myTurn ? `Your turn (${myMark})` : "Stranger's turn…";
  else if (game.winner === "draw") status = "It's a draw!";
  else status = game.winner === myId ? "You win! 🎉" : "Stranger wins!";

  return (
    <Paper elevation={0} sx={{ mx: 1.5, my: 1, p: 1.5, borderRadius: 2, border: "1px solid rgba(108,99,255,0.3)", bgcolor: "rgba(108,99,255,0.06)" }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
        <Typography fontSize={13} fontWeight={700}>❌⭕ Tic-tac-toe</Typography>
        <Stack direction="row" alignItems="center" spacing={1}>
          {(myScore > 0 || theirScore > 0) && (
            <Typography fontSize={12} color="text.secondary">You {myScore} – {theirScore} Stranger</Typography>
          )}
          <IconButton size="small" onClick={() => onAction("quit")} aria-label="Close game"><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
        </Stack>
      </Stack>

      <Typography fontSize={12.5} color={game.status === "over" ? "primary.light" : "text.secondary"} mb={1}>{status}</Typography>

      {game.status === "invited" && !iInvited && (
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="contained" onClick={() => onAction("accept")}>Play</Button>
          <Button size="small" onClick={() => onAction("decline")}>No thanks</Button>
        </Stack>
      )}

      {game.status !== "invited" && (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 44px)", gap: 0.5 }}>
          {game.board.map((cell, i) => {
            const winning = game.line?.includes(i);
            return (
              <Box key={i} component="button" type="button"
                disabled={!myTurn || !!cell}
                onClick={() => onAction("move", i)}
                aria-label={`Cell ${i + 1}${cell ? `, ${cell}` : ""}`}
                sx={{
                  width: 44, height: 44, borderRadius: 1, border: "1px solid rgba(255,255,255,0.12)",
                  bgcolor: winning ? "rgba(76,175,80,0.25)" : "rgba(255,255,255,0.04)",
                  color: cell === "X" ? "#6C63FF" : "#FF6584", fontSize: 22, fontWeight: 800,
                  cursor: myTurn && !cell ? "pointer" : "default",
                  "&:hover:enabled": { bgcolor: "rgba(108,99,255,0.15)" },
                }}>
                {cell}
              </Box>
            );
          })}
        </Box>
      )}

      {game.status === "over" && (
        <Button size="small" variant="outlined" sx={{ mt: 1 }} onClick={() => onAction("rematch")}>Rematch</Button>
      )}
    </Paper>
  );
}
