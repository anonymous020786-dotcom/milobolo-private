import { ReactNode, useState } from "react";
import { Box } from "@mui/material";

// Lightweight, XSS-safe formatting: builds React nodes, never HTML strings.
// Supports *bold*, _italic_, ~strike~, `code` and http(s) links.

const TOKEN_RE = /(https?:\/\/[^\s<>"']+[^\s<>"'.,!?;:)\]])|`([^`\n]+)`|\*([^*\n]+)\*|_([^_\n]+)_|~([^~\n]+)~/g;

function HiddenLink({ href }: { href: string }) {
  const [shown, setShown] = useState(false);
  let host = href;
  try { host = new URL(href).hostname; } catch {}
  if (!shown) {
    return (
      <Box component="button" type="button" onClick={() => setShown(true)}
        title="Links from strangers are hidden until you choose to show them"
        sx={{
          font: "inherit", fontSize: "0.9em", cursor: "pointer", border: "1px dashed rgba(255,152,0,0.5)",
          bgcolor: "rgba(255,152,0,0.08)", color: "warning.main", borderRadius: 1, px: 0.75, py: 0,
        }}>
        🔗 link to {host} — show
      </Box>
    );
  }
  return <SafeLink href={href} />;
}

function SafeLink({ href }: { href: string }) {
  return (
    <Box component="a" href={href} target="_blank" rel="noopener noreferrer nofollow ugc"
      sx={{ color: "primary.light", wordBreak: "break-all" }}>
      {href}
    </Box>
  );
}

export function renderRichText(text: string, opts: { hideLinks?: boolean } = {}): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  const re = new RegExp(TOKEN_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const idx = m.index;
    if (idx > last) out.push(text.slice(last, idx));
    const [whole, url, code, bold, italic, strike] = m;
    if (url) out.push(opts.hideLinks ? <HiddenLink key={key++} href={url} /> : <SafeLink key={key++} href={url} />);
    else if (code) out.push(<Box component="code" key={key++} sx={{ bgcolor: "rgba(255,255,255,0.08)", px: 0.5, borderRadius: 0.5, fontSize: "0.92em" }}>{code}</Box>);
    else if (bold) out.push(<strong key={key++}>{bold}</strong>);
    else if (italic) out.push(<em key={key++}>{italic}</em>);
    else if (strike) out.push(<s key={key++}>{strike}</s>);
    else out.push(whole);
    last = idx + whole.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function containsLink(text: string) {
  return /https?:\/\//i.test(text);
}
