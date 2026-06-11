# 💳 SaaS Mode (Stripe)

MiroTalk WebRTC can run in two modes, controlled by a single environment variable:

| `SAAS`            | Behavior                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| `false` (default) | Self-hosted mode. **No subscription checks, no Stripe.** The platform behaves exactly as it always has. |
| `true`            | Paid SaaS mode. Registered users must have an **active subscription** to use the platform.              |

When `SAAS=true`, **demo and admin accounts are always exempt** from payment checks, so you can keep administering the platform normally.

---

## 🧩 How it works

1. A logged-in user without an active subscription is redirected to **`/pricing`**.
2. They choose a plan and are sent to **Stripe Checkout**.
3. After payment they return to the app, the subscription is activated, and they land directly in the dashboard (`/client`).
4. Renewals and cancellations are kept in sync through **Stripe webhooks**.

### Plans

| Plan         | Price        | Stripe type      | Access                                              |
| ------------ | ------------ | ---------------- | --------------------------------------------------- |
| **Monthly**  | `$9 / month` | Subscription     | While `subscriptionStatus = active` and not expired |
| **Lifetime** | `$199 once`  | One-time payment | Permanent (`subscriptionExpiresAt = null`)          |

### Protected when `SAAS=true`

- The dashboard page `GET /client` → redirects to `/pricing` if no active subscription.
- Protected APIs return **HTTP 403**: room create/update/delete, room invitations, recurring invitations, SFU token generation, and SMS.
- Login, account, billing, and the pricing/checkout flow remain accessible.

### Activation is webhook-independent

After checkout, the success page calls `GET /api/v1/stripe/verify?session_id=...`, which activates the subscription immediately from the Checkout Session. The webhook is still used to keep renewals/cancellations in sync, but activation does **not** depend on the webhook arriving first (helpful in local dev).

---

## ⚙️ Environment variables

Add these to your `.env` (see `.env.template`):

```bash
SAAS=true                          # master switch: true | false
STRIPE_SECRET_KEY=sk_...           # Stripe secret key (sk_live_... / sk_test_...)
STRIPE_PUBLISHABLE_KEY=pk_...      # Stripe publishable key (pk_live_... / pk_test_...)
STRIPE_WEBHOOK_SECRET=whsec_...    # Signing secret of your webhook endpoint
STRIPE_MONTHLY_PRICE_ID=price_...  # Price ID of the $9/month recurring price
STRIPE_LIFETIME_PRICE_ID=price_... # Price ID of the $199 one-time price
```

> ⚠️ Only `STRIPE_PUBLISHABLE_KEY` and the price IDs are exposed to the frontend (via `GET /config`). The **secret key** and **webhook secret** are read server-side only and are never sent to the browser.

| Variable                   | Where to find it in Stripe                               |
| -------------------------- | -------------------------------------------------------- |
| `STRIPE_SECRET_KEY`        | Developers → API keys → _Secret key_                     |
| `STRIPE_PUBLISHABLE_KEY`   | Developers → API keys → _Publishable key_                |
| `STRIPE_WEBHOOK_SECRET`    | Developers → Webhooks → your endpoint → _Signing secret_ |
| `STRIPE_MONTHLY_PRICE_ID`  | Product catalog → your monthly product → _Price ID_      |
| `STRIPE_LIFETIME_PRICE_ID` | Product catalog → your lifetime product → _Price ID_     |

---

## 🛠️ One-time Stripe setup

1. Create two **Products** in the Stripe Dashboard:
    - _Monthly_ → recurring price `$9 / month` → copy its **Price ID** into `STRIPE_MONTHLY_PRICE_ID`.
    - _Lifetime_ → one-time price `$199` → copy its **Price ID** into `STRIPE_LIFETIME_PRICE_ID`.
2. Copy your **API keys** into `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY`.
3. Configure the **webhook** (see below) and copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
4. (Recommended) Run the database migration to backfill subscription fields:
    ```bash
    cd database
    npx migrate-mongo up
    ```
5. Set `SAAS=true` and restart the app.

### Webhook endpoint

```
POST {SERVER_URL}/api/stripe/webhook
```

Subscribe to at least these events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

---

## 🧪 Development / testing

Use Stripe **test mode** (keys starting with `sk_test_` / `pk_test_`).

1. Set the test keys and price IDs in `.env`, with `SAAS=true`.
2. Forward webhooks to your local server with the Stripe CLI:
    ```bash
    stripe login
    stripe listen --forward-to localhost:9002/api/stripe/webhook
    ```
    The CLI prints a `whsec_...` signing secret — put it in `STRIPE_WEBHOOK_SECRET` and restart the app.
3. Start the app:
    ```bash
    npm start
    ```
4. Log in as a normal (non-admin, non-demo) user, go to **`/pricing`**, and pay with a test card:
    - Card: `4242 4242 4242 4242`
    - Expiry: any future date · CVC: any 3 digits · ZIP: any
5. Verify the flow:
    - Lifetime → `subscriptionType = lifetime`, permanent access.
    - Monthly → `subscriptionType = monthly`, renewal date shown in **Account → Billing**.
    - Cancel via **Manage Subscription** (Stripe Billing Portal) → access is revoked and `/client` redirects back to `/pricing`.

> 💡 To test admin/demo bypass, log in with the `ADMIN_*` or `USER_DEMO_*` credentials — they always have full access regardless of subscription.

---

## 🚀 Production

1. Switch to **live** keys (`sk_live_` / `pk_live_`) and live Price IDs.
2. Create a live webhook endpoint pointing at `{SERVER_URL}/api/stripe/webhook` and use its live signing secret in `STRIPE_WEBHOOK_SECRET`.
3. Run the migration (`npx migrate-mongo up`) before enabling `SAAS=true`.
4. Set `SAAS=true` and deploy/restart.

### Notes

- The migration is **recommended but not strictly required**: missing subscription fields are treated as "no active subscription", so existing users are safely gated until they subscribe.
- Switching back to `SAAS=false` instantly disables all subscription checks — useful for self-hosted installs.
