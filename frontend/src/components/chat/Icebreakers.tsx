import { useMemo, useState } from "react";
import { IconButton, Tooltip, Menu, MenuItem, Typography, ListSubheader } from "@mui/material";
import AcUnitIcon from "@mui/icons-material/AcUnit";

const GENERAL = [
  "If you could live anywhere for a year, where would it be?",
  "What's something you're weirdly good at?",
  "What's the best thing that happened to you this week?",
  "Coffee, tea, or neither?",
  "What's a movie you can rewatch forever?",
  "What's one skill you wish you'd learned earlier?",
  "What's the most spontaneous thing you've ever done?",
  "Night owl or early bird?",
  "What song is stuck in your head right now?",
  "What's a hot take you'll defend to the end?",
  "What would your perfect day look like?",
  "What's the last thing that made you laugh out loud?",
];

const BY_INTEREST: Record<string, string[]> = {
  music: ["Who's an artist you think deserves way more fans?", "What was the last concert you went to?"],
  movies: ["What's the most underrated movie you've seen?", "Which movie villain was actually right?"],
  gaming: ["What game have you sunk the most hours into?", "Single-player story or competitive multiplayer?"],
  anime: ["Which anime would you recommend to a total beginner?", "Sub or dub — and why?"],
  travel: ["What's the best place you've ever visited?", "Where's next on your travel list?"],
  sports: ["Which team do you support, and how bad is the heartbreak?", "Do you play, watch, or both?"],
  books: ["What book changed how you think?", "What are you reading right now?"],
  tech: ["What's a piece of tech you couldn't live without?", "What app do you wish existed?"],
  food: ["What's your ultimate comfort food?", "What's a dish you can cook really well?"],
  cricket: ["Test cricket or T20?", "Who's the greatest batter of all time?"],
  coding: ["What was the first program you ever wrote?", "Tabs or spaces? Choose carefully."],
  fitness: ["What's your favourite way to stay active?", "Gym, running, or sports?"],
};

interface Props {
  interests: string[];
  disabled?: boolean;
  onPick: (text: string) => void;
}

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Icebreakers({ interests, disabled, onPick }: Props) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [seed, setSeed] = useState(0);

  const { themed, general } = useMemo(() => {
    const themedList = interests
      .flatMap((i) => (BY_INTEREST[i.toLowerCase()] || []).map((q) => ({ q, tag: i })))
      .slice(0, 3);
    return { themed: themedList, general: shuffle(GENERAL).slice(0, 4) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interests, seed]);

  return (
    <>
      <Tooltip title="Icebreakers">
        <span>
          <IconButton size="small" disabled={disabled} aria-label="Icebreakers"
            onClick={(e) => { setSeed((s) => s + 1); setAnchor(e.currentTarget); }}>
            <AcUnitIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "top", horizontal: "left" }} transformOrigin={{ vertical: "bottom", horizontal: "left" }}
        PaperProps={{ sx: { maxWidth: 360 } }}>
        {themed.length > 0 && <ListSubheader sx={{ lineHeight: "28px", fontSize: 11 }}>Based on shared interests</ListSubheader>}
        {themed.map(({ q, tag }) => (
          <MenuItem key={q} onClick={() => { onPick(q); setAnchor(null); }} sx={{ whiteSpace: "normal", fontSize: 13 }}>
            <Typography fontSize={13}>{q} <Typography component="span" fontSize={11} color="text.disabled">#{tag}</Typography></Typography>
          </MenuItem>
        ))}
        <ListSubheader sx={{ lineHeight: "28px", fontSize: 11 }}>Conversation starters</ListSubheader>
        {general.map((q) => (
          <MenuItem key={q} onClick={() => { onPick(q); setAnchor(null); }} sx={{ whiteSpace: "normal", fontSize: 13 }}>{q}</MenuItem>
        ))}
      </Menu>
    </>
  );
}
