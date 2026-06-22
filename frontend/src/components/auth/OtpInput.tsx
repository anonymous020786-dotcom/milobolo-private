import { useRef, KeyboardEvent, ClipboardEvent } from "react";
import { Box, TextField } from "@mui/material";

interface OtpInputProps {
  value: string;
  onChange: (val: string) => void;
  length?: number;
  disabled?: boolean;
}

export default function OtpInput({ value, onChange, length = 6, disabled }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(length, "").split("").slice(0, length);

  const update = (index: number, char: string) => {
    const arr = digits.slice();
    arr[index] = char;
    onChange(arr.join("").replace(/\s/g, ""));
  };

  const handleKey = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) refs.current[index - 1]?.focus();
      update(index, "");
    }
  };

  const handleChange = (index: number, val: string) => {
    const char = val.replace(/\D/g, "").slice(-1);
    update(index, char);
    if (char && index < length - 1) refs.current[index + 1]?.focus();
  };

  const handlePaste = (e: ClipboardEvent) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    onChange(text);
    refs.current[Math.min(text.length, length - 1)]?.focus();
  };

  return (
    <Box sx={{ display: "flex", gap: 1, justifyContent: "center" }}>
      {Array.from({ length }).map((_, i) => (
        <TextField
          key={i}
          inputRef={(el) => { refs.current[i] = el; }}
          value={digits[i] === " " ? "" : digits[i]}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e as KeyboardEvent<HTMLInputElement>)}
          onPaste={handlePaste}
          disabled={disabled}
          inputProps={{ maxLength: 1, style: { textAlign: "center", fontSize: 24, fontWeight: 700, padding: "12px 0" } }}
          sx={{ width: 52 }}
        />
      ))}
    </Box>
  );
}
