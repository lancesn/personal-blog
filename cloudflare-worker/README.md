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
