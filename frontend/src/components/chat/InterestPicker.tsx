import { useState } from "react";
import {
  Box, TextField, Chip, Typography, Stack, InputAdornment,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

const SUGGESTIONS = [
  "Music", "Gaming", "Cricket", "Bollywood", "Coding", "Travel", "Cooking",
  "Fitness", "Books", "Movies", "Anime", "Photography", "Art", "Business",
  "Tech", "Fashion", "Sports", "Yoga", "Dance", "Poetry",
];

interface InterestPickerProps {
  interests: string[];
  onChange: (interests: string[]) => void;
  max?: number;
}

export default function InterestPicker({ interests, onChange, max = 5 }: InterestPickerProps) {
  const [input, setInput] = useState("");

  const add = (tag: string) => {
    const clean = tag.trim().slice(0, 20);
    if (!clean || interests.includes(clean) || interests.length >= max) return;
    onChange([...interests, clean]);
    setInput("");
  };

  const remove = (tag: string) => onChange(interests.filter((i) => i !== tag));

  const handleKey = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      add(input);
    }
  };

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
        Add interests to match with like-minded people ({interests.length}/{max})
      </Typography>

      {/* Selected interests */}
      {interests.length > 0 && (
        <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mb: 1.5 }}>
          {interests.map((i) => (
            <Chip key={i} label={i} size="small" color="primary" onDelete={() => remove(i)} />
          ))}
        </Stack>
      )}

      {/* Input */}
      <TextField
        size="small"
        fullWidth
        placeholder="Type an interest and press Enter…"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKey}
        disabled={interests.length >= max}
        InputProps={{
          endAdornment: input ? (
            <InputAdornment position="end">
              <AddIcon sx={{ cursor: "pointer", color: "primary.main" }} onClick={() => add(input)} />
            </InputAdornment>
          ) : null,
        }}
        sx={{ mb: 1.5 }}
      />

      {/* Suggestions */}
      <Stack direction="row" flexWrap="wrap" gap={0.5}>
        {SUGGESTIONS.filter((s) => !interests.includes(s)).slice(0, 12).map((s) => (
          <Chip key={s} label={s} size="small" variant="outlined"
            onClick={() => add(s)}
            sx={{ cursor: "pointer", "&:hover": { bgcolor: "rgba(108,99,255,0.1)" } }} />
        ))}
      </Stack>
    </Box>
  );
}
