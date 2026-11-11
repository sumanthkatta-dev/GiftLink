This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Storage

Gifts are saved in Cloud Firestore when all three environment variables below
are set, and in a local file (`data/gifts.json`, git-ignored) when any is
missing. Vercel can't write files, so the live site needs Firestore. Without
it, the server logs a warning on Vercel and creating a gift fails.

| Variable | Where it comes from |
| --- | --- |
| `FIREBASE_PROJECT_ID` | `project_id` in the service account key |
| `FIREBASE_CLIENT_EMAIL` | `client_email` in the service account key |
| `FIREBASE_PRIVATE_KEY` | `private_key` in the service account key, in quotes, keeping the `
` |

Setup, once:

1. In the Firebase console, create a Firestore database (Build > Firestore
   Database > Create database, production mode). Gifts go in a `gifts`
   collection, created automatically.
2. Project settings > Service accounts > Generate new private key. This
   downloads a JSON file. Keep it private and out of the repo.
3. For local use, copy `.env.example` to `.env.local` and fill in the three
   values. `.env.local` is git-ignored.
4. On Vercel, add the same three variables under Project Settings >
   Environment Variables, then redeploy. The private key can be pasted with
   its `
` sequences or with real line breaks; both work.

Only the server touches Firestore, through the Admin SDK (`lib/firestore-store.ts`,
marked `server-only`), and the Admin SDK ignores security rules. So the rules
can deny all client access:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Abuse protection

GiftLink is open to anyone, so it guards against being used to spread bad
links or to attack the server it runs on.

**Dangerous links are refused** (`lib/safety.ts`). Every link is checked with
the [Google Safe Browsing Lookup API v4](https://developers.google.com/safe-browsing/v4/lookup-api)
for malware, phishing (social engineering), unwanted software and potentially
harmful apps. If Google can't answer (no key, an error, or no reply within
3 seconds) the gift is still created and a warning is logged. Links to private
or local addresses, and links to GiftLink itself, are refused too.

| Variable | Where it comes from |
| --- | --- |
| `GOOGLE_SAFE_BROWSING_API_KEY` | Google Cloud console: enable the Safe Browsing API, then APIs & Services > Credentials > Create credentials > API key. Restrict the key to the Safe Browsing API. |
| `IP_HASH_SALT` (optional) | Any long random string. If unset, a salt is derived from `FIREBASE_PRIVATE_KEY`. |

**Link previews are fetched safely** (`lib/og.ts`, `lib/network.ts`). The
server only fetches https on the standard port, resolves the hostname first and
refuses private, loopback, link-local and cloud metadata addresses (also at
connect time, so DNS rebinding doesn't get around it), follows at most 3
redirects and checks each one, stops after 5 seconds or 512 KB, and only reads
`text/html`. Preview images must be https on a public host.

**Rate limits** (`lib/rate-limit.ts`), counted in a Firestore `rateLimits`
collection so they hold on Vercel:

- creating gifts: 10 per hour and 30 per day per IP
- wrong secret answers: 10 per gift per IP per hour
- reports: 20 per hour per IP

The IP is the first value of `x-forwarded-for` (set by Vercel), and only a
salted hash of it is stored. Without the Firebase variables (local
development) nothing is counted. If Firestore errors, the attempt is allowed
and a warning is logged.

To clean up old counters automatically, add a TTL policy in the Firebase
console: Firestore > TTL policies > collection group `rateLimits`, field
`expiresAt`. Without it, each counter is a small document that stays behind.

**Reports.** The reveal screen has a quiet "Report this gift" link. Reports
are saved in a `reports` collection (gift id, reason, time, and a salted IP
hash so each visitor counts once per gift). A gift with 3 or more reports
stops opening and shows "This gift has been taken down." To restore a gift,
set its `reportCount` field back to 0 in Firestore (locally: in
`data/gifts.json`).
