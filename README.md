# Rental cars

Car rental app: customers browse the fleet, filter it, save favorites and book a car for a date range; the admin adds, edits and publishes cars and sees every reservation.

[Live demo](https://rental-cars-three.vercel.app) · Next.js 14 (App Router) · Prisma on PostgreSQL · Clerk · Stripe Checkout · UploadThing for photos

## How a booking works

1. The client sends `carId` and the dates to `POST /api/checkout`.
2. The server loads the car from the database, checks it's published, and computes `days × priceDay` itself. The price never comes from the browser.
3. It creates an `Order` with status `pending` and a Stripe Checkout session with the order id in its metadata, then redirects to Stripe.

Admin access is a single Clerk user id (`NEXT_PUBLIC_ADMINISTRATOR`). Every `/dashboard` route goes through Clerk's middleware, and car mutations are scoped to the user who created the car.

## Running it

```bash
npm install
npx prisma migrate dev
npm run dev
```

Needs `DATABASE_URL`, Clerk's keys, `STRIPE_SECRET_KEY`, `STRIPE_API_KEY`, UploadThing's keys, `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_ADMINISTRATOR`.

## Known gaps

- **There's no Stripe webhook yet**, so orders stay `pending` even after a successful payment. The next step is listening to `checkout.session.completed` and marking the order paid using the `orderId` in the metadata.
- Two people can book the same car for overlapping dates; there's no availability check.
- Prices and amounts are stored as `String` in the schema. They should be `Decimal`.
