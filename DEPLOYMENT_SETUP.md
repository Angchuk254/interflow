# IntraFlow – Deployment & Email Setup

Complete setup for production deployment and email notifications.

---

## 1. Production URL

Your app: **https://inter-flow.vercel.app**

---

## 2. Email Notifications (Supabase Edge Function)

### Step A: Deploy the Edge Function

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project
2. **Edge Functions** → **Deploy a new function** → **Via Editor**
3. **Name:** `send-notification-email`
4. Replace the default code with the contents of `supabase/functions/send-notification-email/index.ts`
5. Click **Deploy**

### Step B: Add Secrets

1. **Project Settings** (gear) → **Edge Functions** → **Secrets**
2. Click **Add new secret** and add:

| Name | Value |
|------|-------|
| `RESEND_API_KEY` | Your Resend API key from [resend.com](https://resend.com) → API Keys |
| `APP_URL` | `https://inter-flow.vercel.app` |

**CLI alternative** (if Supabase CLI is installed):
```bash
supabase secrets set RESEND_API_KEY=your_resend_key_here
supabase secrets set APP_URL=https://inter-flow.vercel.app
```

### Step C: Create Database Webhook

1. **Database** → **Webhooks** → **Create a new webhook**
2. **Name:** `send-notification-email`
3. **Table:** `notifications`
4. **Events:** Insert
5. **Type:** Supabase Edge Function
6. **Function:** `send-notification-email`
7. Save

---

## 3. Supabase Auth – Site URL (for invite emails)

1. **Project Settings** → **Authentication** → **URL Configuration**
2. Set:
   - **Site URL:** `https://inter-flow.vercel.app`
   - **Redirect URLs:** add `https://inter-flow.vercel.app/**`

---

## 4. Environment (already configured)

Production `src/environments/environment.ts` has:
- `appUrl: 'https://inter-flow.vercel.app'` ✓
- Supabase URL and anon key ✓

---

## 5. Resend API Key Security

**Important:** Regenerate your Resend API key if it was ever committed or shared insecurely.

1. Go to [resend.com](https://resend.com) → **API Keys**
2. Delete the old key and create a new one
3. Update the `RESEND_API_KEY` secret in Supabase (Step B above)

---

## Checklist

- [ ] Edge Function `send-notification-email` deployed
- [ ] Secrets `RESEND_API_KEY` and `APP_URL` set in Supabase
- [ ] Database webhook for `notifications` INSERT created
- [ ] Supabase Auth Site URL set to `https://inter-flow.vercel.app`
- [ ] Redirect URLs include `https://inter-flow.vercel.app/**`

---

## Test

1. **Invite:** Admin invites a user → invite email should link to `https://inter-flow.vercel.app/accept-invite`
2. **Notification:** Assign a task or mention someone → notification email should have “View details” linking to production
