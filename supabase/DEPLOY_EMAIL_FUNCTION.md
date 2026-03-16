# Deploy send-notification-email via Supabase Dashboard

Since the function doesn't exist in your Supabase project yet, deploy it manually:

## Step 1: Open Edge Functions

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click **Edge Functions** in the left sidebar

## Step 2: Create New Function

1. Click **Create a new function**
2. **Name:** `send-notification-email`
3. Click **Create function**

## Step 3: Paste the Code

Replace the default code with the contents of `supabase/functions/send-notification-email/index.ts` (or copy from below):

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRecord {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  link?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const record = body?.record as NotificationRecord | undefined;

    if (!record?.user_id || !record?.title) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: record.user_id and record.title" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", record.user_id)
      .single();

    if (profileError || !profile?.email) {
      console.warn("send-notification-email: No profile/email for user_id:", record.user_id, profileError?.message);
      return new Response(
        JSON.stringify({ success: true, skipped: "no_email" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!resendApiKey) {
      console.log("send-notification-email: RESEND_API_KEY not set, skipping email send");
      return new Response(
        JSON.stringify({ success: true, skipped: "no_api_key" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const appUrl = Deno.env.get("APP_URL") || "https://your-app.vercel.app";
    const fullLink = record.link
      ? (record.link.startsWith("http") ? record.link : `${appUrl.replace(/\/$/, "")}${record.link.startsWith("/") ? record.link : "/" + record.link}`)
      : null;

    const html = [
      `<h2>${escapeHtml(record.title)}</h2>`,
      record.body ? `<p>${escapeHtml(record.body)}</p>` : "",
      fullLink ? `<p><a href="${escapeHtml(fullLink)}">View details</a></p>` : "",
    ].filter(Boolean).join("\n");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "IntraFlow <onboarding@resend.dev>",
        to: [profile.email],
        subject: record.title,
        html,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("Resend API error:", res.status, errBody);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: errBody }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resData = await res.json();
    return new Response(
      JSON.stringify({ success: true, email_id: resData.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-notification-email error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
```

4. Click **Deploy**

## Step 4: Add Secrets

1. Go to **Project Settings** (gear icon) → **Edge Functions**
2. Under **Secrets**, add:
   - `RESEND_API_KEY` = your Resend API key
   - `APP_URL` = `http://localhost:4200` (or your app URL)

## Step 5: Create Database Webhook

1. Go to **Database** → **Webhooks**
2. Click **Create a new webhook**
3. **Name:** `send-notification-email`
4. **Table:** `notifications`
5. **Events:** check **Insert**
6. **Type:** Supabase Edge Function
7. **Function:** select `send-notification-email`
8. Save

---

**Alternative: Deploy via CLI** (if you have Supabase CLI installed):

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy send-notification-email --no-verify-jwt
```
