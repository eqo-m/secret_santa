// Generates the static, standalone reveal page for one giver. No server, no
// API calls, no per-visit state — see CLAUDE.md "Reveal page UX".

export function generateRevealHtml({
  giverName,
  receiverName,
  receiverPhotoPath,
  receiverWishlistUrl,
}: {
  giverName: string
  receiverName: string
  /** Path to the photo relative to the generated HTML file, e.g. "photos/carol.jpg" */
  receiverPhotoPath: string
  receiverWishlistUrl: string
}): string {
  // Keep this human-readable but minimal — no framework, no build step, this
  // literal string *is* the deployed artifact.
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Secret Santa — ${escapeHtml(giverName)}</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #fdfaf6;
    --fg: #2b2420;
    --accent: #b3261e;
    --card-bg: #ffffff;
    --muted: #6b6259;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #1c1815;
      --fg: #f2ece4;
      --accent: #ff6b5e;
      --card-bg: #2a2521;
      --muted: #a89e92;
    }
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: var(--bg);
    color: var(--fg);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  body {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .card {
    background: var(--card-bg);
    border-radius: 20px;
    padding: 32px 28px 28px;
    max-width: 420px;
    width: 100%;
    text-align: center;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);
  }
  .eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.75rem;
    color: var(--muted);
    margin: 0 0 4px;
  }
  h1 {
    font-size: 1.4rem;
    margin: 0 0 20px;
  }
  .photo-wrap {
    width: 220px;
    height: 220px;
    margin: 0 auto 20px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--bg);
  }
  .photo-wrap img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: blur(20px);
    transform: scale(1.1); /* hide blur edge softening */
    transition: filter 800ms ease-out;
  }
  .photo-wrap img.revealed {
    filter: blur(0);
  }
  .receiver-name {
    font-size: 1.6rem;
    font-weight: 700;
    margin: 0 0 20px;
  }
  .wishlist-link {
    display: inline-block;
    background: var(--accent);
    color: #fff;
    text-decoration: none;
    font-weight: 600;
    padding: 12px 24px;
    border-radius: 999px;
  }
</style>
</head>
<body>
  <div class="card">
    <p class="eyebrow">Hi ${escapeHtml(giverName)}, you're buying for</p>
    <h1>🎁 Secret Santa</h1>
    <div class="photo-wrap">
      <img id="photo" src="${escapeHtml(receiverPhotoPath)}" alt="${escapeHtml(receiverName)}">
    </div>
    <p class="receiver-name">${escapeHtml(receiverName)}</p>
    <a class="wishlist-link" href="${escapeHtml(receiverWishlistUrl)}" target="_blank" rel="noopener">View wishlist</a>
  </div>
  <script>
    // Blur-to-sharp on every visit, no localStorage / repeat-visit tracking —
    // replaying the animation on a second visit is fine for this use case.
    window.addEventListener('load', function () {
      setTimeout(function () {
        document.getElementById('photo').classList.add('revealed');
      }, 300);
    });
  </script>
</body>
</html>
`
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
