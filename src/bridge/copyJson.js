/** Copy text in a user-click handler (sync — works without secure clipboard API). */
export function copyTextToClipboard(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch (err) {
    console.error("[SC copy] execCommand error:", err);
  }

  document.body.removeChild(textarea);
  return ok;
}
