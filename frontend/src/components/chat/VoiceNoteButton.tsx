import { useEffect, useRef, useState } from "react";
import { IconButton, Tooltip, Typography, Box } from "@mui/material";
import KeyboardVoiceIcon from "@mui/icons-material/KeyboardVoice";
import StopCircleIcon from "@mui/icons-material/StopCircle";

const MAX_SECONDS = 60;

interface Props {
  disabled?: boolean;
  onRecorded: (blob: Blob, mime: string, seconds: number) => void;
  onError: (message: string) => void;
}

function pickMime() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const m of ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

// Records up to 60 s of low-bitrate Opus audio (~240 KB) and hands the blob back.
export default function VoiceNoteButton({ disabled, onRecorded, onError }: Props) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTracks = () => recRef.current?.stream.getTracks().forEach((t) => t.stop());

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recRef.current?.state === "recording") recRef.current.stop();
    stopTracks();
  }, []);

  const start = async () => {
    const mime = pickMime();
    if (mime === null) return onError("Voice notes aren't supported in this browser.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32000 });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        stopTracks();
        const secs = (Date.now() - startRef.current) / 1000;
        const type = rec.mimeType || mime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        if (secs >= 0.7 && blob.size > 0) onRecorded(blob, type, Math.min(secs, MAX_SECONDS));
      };
      recRef.current = rec;
      startRef.current = Date.now();
      rec.start(250);
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => {
        const s = Math.floor((Date.now() - startRef.current) / 1000);
        setSeconds(s);
        if (s >= MAX_SECONDS) stop();
      }, 250);
    } catch {
      onError("Microphone access denied.");
    }
  };

  const stop = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (recRef.current?.state === "recording") recRef.current.stop();
    setRecording(false);
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <Tooltip title={recording ? "Stop and send" : "Record voice note (max 60s)"}>
        <span>
          <IconButton size="small" disabled={disabled && !recording} color={recording ? "error" : "default"}
            onClick={recording ? stop : start} aria-label={recording ? "Stop recording" : "Record voice note"}>
            {recording ? <StopCircleIcon fontSize="small" /> : <KeyboardVoiceIcon fontSize="small" />}
          </IconButton>
        </span>
      </Tooltip>
      {recording && (
        <Typography variant="caption" color="error.main" sx={{ fontVariantNumeric: "tabular-nums", minWidth: 32 }}>
          ● {seconds}s
        </Typography>
      )}
    </Box>
  );
}
