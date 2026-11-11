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
