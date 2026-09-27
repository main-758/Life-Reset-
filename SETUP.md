# Life Reset production setup
Supabase project: https://kkqmthgyzlzkytydccgk.supabase.co
Account login and cloud data are connected. The remaining business setup is Lemon Squeezy billing.
1. Create a Life Reset Plus recurring product at $7.99/month in Lemon Squeezy.
2. Put its checkout URL into config.js as LEMON_CHECKOUT_URL.
3. Set the Supabase Edge Function secret LEMON_SQUEEZY_WEBHOOK_SECRET and the Lemon Squeezy webhook URL to https://kkqmthgyzlzkytydccgk.supabase.co/functions/v1/lemon-webhook.
4. Pass checkout[custom][user_id] through checkout. The deployed webhook updates profiles.subscription_status for the correct user.
5. Add your owner email to public.app_admins from Supabase SQL Editor after creating your own account.
Never put a Supabase service-role key or Lemon secret in GitHub Pages.