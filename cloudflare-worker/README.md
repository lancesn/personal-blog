# Silencegate Blog Admin Worker

This Worker keeps the GitHub token out of the public website. The online admin sends requests to this Worker with an admin password, and the Worker writes Markdown and uploads images to GitHub.

## Secrets

Set these secrets in Cloudflare:

```bash
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put ADMIN_PASSWORD
```

`GITHUB_TOKEN` needs repository contents read/write permission for `lancesn/personal-blog`.

## Deploy

```bash
npx wrangler deploy
```

After deploy, copy the Worker URL into the online admin page.

## Regenerating the pinyin-initials table

`src/index.js` embeds a full CJK-character-to-pinyin-initial table (`pinyinInitialGroups`) used by `slugify()` to build new-post filenames, e.g. "一片叶子" → `ypyz`. It covers the CJK Unified Ideographs and Extension A blocks. To regenerate it (e.g. after upgrading the data source):

```bash
npm install --no-save pinyin-pro
node -e '
import("pinyin-pro").then(({ pinyin }) => {
  const groups = {};
  for (const [start, end] of [[0x4e00, 0x9fff], [0x3400, 0x4dbf]]) {
    for (let cp = start; cp <= end; cp++) {
      const char = String.fromCodePoint(cp);
      const r = pinyin(char, { pattern: "first", toneType: "none", type: "array" });
      const initial = (r[0] || "").toLowerCase().trim();
      if (/^[a-z]$/.test(initial)) groups[initial] = (groups[initial] || "") + char;
    }
  }
  for (const k of Object.keys(groups).sort()) {
    console.log(`  ${k}: "${groups[k]}",`);
  }
});
'
```

Paste the output lines into the `pinyinInitialGroups` object in `src/index.js`.
