# Life Reset — working product build

This is a self-contained, working browser/PWA build of the Life Reset concept: brain dump -> structured plan -> tasks -> goals -> habits -> money -> journal -> insights.

## Run it

For the most reliable PWA behavior, open a terminal in this folder and run:

`python -m http.server 8080`

Then visit `http://localhost:8080`.

You can also open `index.html` directly in a browser. Core features use browser storage and do not require an API key.

## What is real in this build

- Life Reset brain-dump planner with a local planning engine
- Converts messy text into priorities and next steps
- Sends the generated plan into Today
- Task creation/completion/deletion
- Goals and progress
- Habit check-ins
- Income/expense tracking and balance
- Journal entries
- Progress/insights
- Profile
- Data export
- Responsive mobile UI
- PWA manifest + service worker
- Pro preview screen

## What is intentionally not faked

Real user accounts/cloud sync and real card subscriptions cannot be activated without your own production credentials. The Pro button in this build is explicitly a local preview and does not charge anyone.

## Production path

1. Put the frontend on a production host such as Vercel, Netlify or GitHub Pages.
2. Connect Supabase Auth + database for real accounts and cloud data.
3. Add a secure server/API layer for AI requests. Do not put secret API keys in the browser.
4. Add Stripe Checkout/Billing on the server and listen for webhook events to update subscription status.
5. Add privacy policy, terms, account deletion and payment/tax requirements before accepting real customers.

## Important

This package is a product prototype, not a claim that revenue is guaranteed. The purpose is to have a real, usable core experience that can be tested with users before paying for infrastructure.
