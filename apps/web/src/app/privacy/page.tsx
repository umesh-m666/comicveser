import type { Metadata } from "next";
import StaticPage, { Contact } from "@/components/StaticPage";
import { SITE } from "@/lib/site";
export const metadata: Metadata = { title: "Privacy policy" };
// TODO before launch: have this reviewed for the laws that apply to you and fill in NEXT_PUBLIC_OPERATOR_NAME / NEXT_PUBLIC_CONTACT_EMAIL.
export default function Privacy() {
  return (
    <StaticPage title="Privacy policy" updated={SITE.updated}>
      <p>This explains what {SITE.operator} collects when you use {SITE.name}, why, and the choices you have.</p>
      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details:</strong> username, email address and a password (stored only as a one-way hash).</li>
        <li><strong>Your activity:</strong> bookmarks, reading history and position, ratings, reviews, reports you file, and notifications sent to you.</li>
        <li><strong>Creators:</strong> display name and the rights information you provide with submissions.</li>
        <li><strong>Payments (only if memberships are offered):</strong> handled by our payment provider; we keep order and payment status, not card details.</li>
        <li><strong>Usage statistics (only if you accept):</strong> page visits, comic and chapter views and searches. We do not store your IP address or use advertising cookies. If you are logged in, this activity is linked to your account so we can count active readers.</li>
      </ul>
      <h2>Cookies and local storage</h2>
      <p>We set one cookie, a login session cookie, which is necessary for the site to work. Your browser's local storage keeps reader settings, your analytics choice and your place in a chapter when you are logged out.</p>
      <h2>How we use it</h2>
      <p>To run your account, sync your library across devices, show recommendations from your own activity, send notifications you have not turned off, keep the site secure and prevent abuse, and understand how the site is used.</p>
      <h2>Who else handles data</h2>
      <p>Service providers process data for us: hosting and database, file storage and content delivery, an email service for verification and password-reset messages, and a payment provider if memberships are enabled. We do not sell personal data.</p>
      <h2>How long we keep it</h2>
      <ul>
        <li>Login sessions expire after 30 days or when you log out.</li>
        <li>Usage statistics are deleted after about 400 days.</li>
        <li>If you delete your account we remove your email, bookmarks, history, notifications and profile, and your reviews are removed. Records we must keep, such as payment records, are kept without your personal details where possible.</li>
      </ul>
      <h2>Your choices</h2>
      <p>You can change your details, turn off new-chapter notifications, and delete your account in profile settings. You can decline analytics in the banner or clear your browser storage to reset your choice. To ask about your data, contact <Contact />.</p>
      <h2>Changes</h2>
      <p>If we change this policy we will update the date above.</p>
    </StaticPage>
  );
}
