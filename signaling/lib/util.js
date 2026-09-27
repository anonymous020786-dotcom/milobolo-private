function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function countryToFlag(code) {
  if (!code || code.length !== 2) return "🌐";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1F1E0 + c.charCodeAt(0) - 65));
}

// .edu, .edu.xx, .ac.xx (e.g. mit.edu, du.ac.in, ox.ac.uk, unimelb.edu.au)
const ACADEMIC_RE = /@([a-z0-9-]+\.)+(edu|edu\.[a-z]{2}|ac\.[a-z]{2})$/i;
function isAcademicEmail(email) {
  return typeof email === "string" && email.length <= 254 && ACADEMIC_RE.test(email.trim());
}

function isEmail(email) {
  return typeof email === "string" && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Short string guard for socket payloads coming from untrusted clients
function str(value, max) {
  return typeof value === "string" && value.length > 0 && value.length <= max ? value : null;
}

module.exports = { escapeHtml, countryToFlag, isAcademicEmail, isEmail, str };
