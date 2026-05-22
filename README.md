# 25 Club

A small web app for the 25 Club investment group:

- **Portfolio** — live view of current positions with real-time prices, gain/loss, and historical performance vs the major indices.
- **Analyze a Stock** — type a ticker; Claude evaluates it in the context of the club&apos;s existing portfolio, surfaces bull/bear cases, and suggests conversation hooks tied to specific members for the next meeting.

Built collaboratively with Claude as a working example of AI-assisted development for the club&apos;s AI-themed discussion.

## Stack

- [Next.js 15](https://nextjs.org) (App Router) + TypeScript + Tailwind
- [yahoo-finance2](https://github.com/gadicc/node-yahoo-finance2) for live quotes
- [Anthropic Claude](https://docs.anthropic.com/) for AI analysis
- Deploys to [Vercel](https://vercel.com) in one click

## Local development

```bash
# 1. Install deps
npm install

# 2. Add your Anthropic API key
cp .env.example .env.local
# then paste your key into .env.local

# 3. Run
npm run dev
```

Open <http://localhost:3000>.

## Updating the portfolio

Positions and members live in `src/lib/holdings.ts` and `src/lib/members.ts`. Edit and redeploy.
Filling in `members[].background` will dramatically improve the per-member discussion-hook
suggestions on the Analyze page.

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import it at <https://vercel.com/new>.
3. Add `ANTHROPIC_API_KEY` as a project environment variable.
4. Deploy. Every future `git push` to `main` auto-deploys.
