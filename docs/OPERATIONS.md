# Operations guide

How Texora's team runs the store day to day: who can do what, how shops and products are approved, the customer service playbook, staff management and the go-live checklist. Everything here happens in the back office at `/admin`. Permissions are defined in `src/lib/auth/rbac.ts`; this guide describes them in plain language.

## Roles

| Role                               | Who                            | Can                                                                                                                                                                                                                                                                                         |
| ---------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platform owner** (`super_admin`) | The business owners            | Everything an admin can, plus create and change admins and platform owners, export the audit log, and manage integrations.                                                                                                                                                                  |
| **Admin**                          | Senior staff                   | Everything an operations manager can, plus store settings (delivery prices, refund limit, rewards, features), inviting staff and changing their roles (up to operations manager), and signing staff out everywhere.                                                                         |
| **Operations manager** (`manager`) | Runs the business day to day   | Approves, rejects, suspends and reinstates merchant shops and products; customer service with **unlimited** refunds; catalogue, content, pricing approvals, promotions, gift cards, stock and fulfilment; reads reports, settings, staff and the audit log. Can't change settings or staff. |
| **Customer service**               | Support team                   | Customers, orders (edit, cancel, place on behalf), refunds **up to the per-order limit** (Admin → Settings), returns, resending emails and adjusting reward points.                                                                                                                         |
| **Merchandiser**                   | Catalogue and marketplace team | Products, categories, content pages, review moderation, and **reviewing merchant shops and products** (approve, reject, request changes).                                                                                                                                                   |
| **Pricing manager**                | Pricing                        | Price changes and their approval, promotions, gift cards.                                                                                                                                                                                                                                   |
| **Inventory manager**              | Stock                          | Stock levels by location.                                                                                                                                                                                                                                                                   |
| **Fulfilment**                     | Warehouse                      | Picking, packing and shipping orders, receiving returns.                                                                                                                                                                                                                                    |
| **Merchant**                       | Independent shops              | Their own shop, products and orders in the merchant portal (`/merchant`). No back office access.                                                                                                                                                                                            |
| **Customer / Rewards member**      | Shoppers                       | Their account, orders, returns, wishlist and rewards.                                                                                                                                                                                                                                       |

Every staff account can also shop with the same login.

## Approving merchant shops

1. **Back office → Marketplace → Merchant shops.** Shops waiting for review are listed first.
2. Open a shop. Check its name and description, branding, contact details, policies (returns window, processing time), locations and its products.
3. Choose one:
   - **Approve:** the shop goes live. Its approved products become visible straight away.
   - **Request changes:** write exactly what to fix. The merchant sees it on their dashboard and by email, fixes it and submits again.
   - **Reject:** for shops that don't fit Texora.
4. Live shops can be **suspended** (managers, admins and owners): the shop and its products disappear from the storefront until reinstated. Merchants can also pause or close their own shop.

Merchants must verify their email before they can submit.

## Approving merchant products

1. **Back office → Marketplace → Product reviews.** New products and edits to live products wait here.
2. Open a product. Check the photos, title, description, materials and care, sizes, price and stock.
3. **Approve** to publish it (a product only shows once its shop is approved too), or **reject** with a reason the merchant can act on.
4. Edits to a live product are reviewed the same way; the published version stays on sale until the edit is approved. Stock changes go live straight away.
5. Trusted merchants (set on their shop) publish directly or on a schedule without review.

## Customer service playbook

| Situation                  | Steps                                                                                                                                                                                                                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Where's my order?**      | Customers → search by email, or Orders → search by order number. The timeline shows each step; shipped orders show the courier and tracking number. Resend the confirmation or shipping email from the order if needed.                                                                      |
| **Change before dispatch** | Open the order → Change delivery address (unshipped orders, same delivery zone: Cairo and Giza, or other governorates). Moving to the other zone changes the delivery price: cancel the order and place a new one. Or cancel it: stock goes back on sale and anything collected is refunded. |
| **Refund**                 | Open the order → Refund, enter the amount and a reason. Card and wallet payments go back through Paymob; cash on delivery refunds are marked to be repaid by hand. Customer service can refund up to the per-order limit; above it, ask an operations manager, admin or owner.               |
| **Return**                 | Customers start returns from their order (courier collection or store drop-off). Returns → open it → approve, then receive it when it arrives (choose the condition per item) → refund to the original payment method or as store credit (an emailed gift card).                             |
| **Phone orders**           | Place the order through the storefront checkout with the customer's email and delivery details, paying by cash on delivery. It appears under that email in Customers and Orders, and the customer gets the confirmation.                                                                     |
| **Rewards**                | Customers → open the customer → adjust points with a reason (logged).                                                                                                                                                                                                                        |
| **Account help**           | Customers → open the customer. Customers reset their own passwords from the sign-in page.                                                                                                                                                                                                    |

Every staff action that changes data is written to the audit log (Administration → Audit log).

## Staff accounts

1. **Administration → Users & roles → Invite.** Enter the name, email and role. The new staff member gets an email with a link to set their password.
2. Change a role from the same page. Nobody can change their own role. Admins assign roles up to operations manager; only platform owners create or change admins and platform owners.
3. **Sign out everywhere** ends all of a person's sessions (for a lost device or someone leaving), then change their role to Customer.

## Emails before an email provider is connected

On a test deployment (`STAGING=true`) without `RESEND_API_KEY`, emails aren't sent. They're kept in the **Email outbox** (Administration → Email outbox, admins and owners only). Open a message there to copy its link (verify email, set password, reset password, staff invitation) and pass it on. Treat these links like passwords. Once Resend is connected, emails are delivered and nothing new appears in the outbox.

## Background jobs

`vercel.json` schedules four jobs, each authenticated with `CRON_SECRET`:

| Job                              | What it does                                                  | Schedule        |
| -------------------------------- | ------------------------------------------------------------- | --------------- |
| `/api/cron/release-reservations` | Returns stock held by card payments that were never completed | Daily 00:15 UTC |
| `/api/cron/merchant-publish`     | Publishes merchants' scheduled products                       | Daily 00:30 UTC |
| `/api/cron/notifications`        | Sends back-in-stock and price-drop emails                     | Daily 07:00 UTC |
| `/api/cron/media-cleanup`        | Removes merchant photos no longer used                        | Daily 03:00 UTC |

Vercel's Hobby plan allows daily jobs only. On Vercel Pro, tighten them to every 5 minutes (reservations, publishing) and hourly (notifications, cleanup).

## Going live checklist

1. **Email:** create a Resend account, verify your sending domain, add `RESEND_API_KEY` and `EMAIL_FROM` (an address on that domain) in Vercel.
2. **Payments:** add the four `PAYMOB_*` keys and set Paymob's transaction callback to `https://<your-domain>/api/webhooks/paymob`. Place a small real card order and refund it.
3. **Domain:** connect your domain in Vercel, set `NEXT_PUBLIC_SITE_URL` to it, and add it to Firebase Authentication → Authorized domains.
4. **Remove `STAGING`** in Vercel so search engines can index the store, then redeploy.
5. **Staff:** invite the team with the right roles; keep at least two platform owners.
6. **Content:** replace the starter copy and photos in Back office → Content; add real products (or approve merchants' products).
7. **Settings:** check delivery prices, the free-delivery threshold, the customer service refund limit and rewards in Back office → Settings.
