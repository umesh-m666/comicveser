import type { Metadata } from "next";
import StaticPage, { Contact } from "@/components/StaticPage";
export const metadata: Metadata = { title: "Contact" };
export default function ContactPage() {
  return (
    <StaticPage title="Contact us">
      <p>Email us at <Contact />. We aim to reply within a few working days.</p>
      <h2>Reporting a problem with a comic</h2>
      <p>Use the <strong>Report</strong> button on the comic's page (you need to be logged in). For copyright complaints, follow the steps in the copyright policy so we can act quickly.</p>
      <h2>Account help</h2>
      <p>You can change your password, update your details or delete your account yourself from your profile settings. If you can't log in, use "Forgot password" on the login page.</p>
    </StaticPage>
  );
}
