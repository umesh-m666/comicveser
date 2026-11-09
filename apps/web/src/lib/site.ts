// Set these in .env.local / Vercel. The legal pages read them so you don't edit code to fill in your details.
export const SITE = {
  name: "ComicVerse",
  operator: process.env.NEXT_PUBLIC_OPERATOR_NAME ?? "the operator of this site",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "",
  jurisdiction: process.env.NEXT_PUBLIC_JURISDICTION ?? "",
  updated: "November 2026",
};
