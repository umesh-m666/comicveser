import type { Metadata } from "next";
import StaticPage, { Contact } from "@/components/StaticPage";
import { SITE } from "@/lib/site";
export const metadata: Metadata = { title: "Terms of use" };
// TODO before launch: have this reviewed for the laws that apply to you.
export default function Terms() {
  return (
    <StaticPage title="Terms of use" updated={SITE.updated}>
      <p>By using {SITE.name} you agree to these terms with {SITE.operator}.</p>
      <h2>Your account</h2>
      <p>Give accurate details, keep your password private, and tell us if you think someone else has used your account. You are responsible for activity under it. You must be old enough to agree to these terms where you live.</p>
      <h2>Using the site</h2>
      <ul>
        <li>Do not copy, download in bulk, resell or redistribute content from the site, or try to get around technical limits.</li>
        <li>Do not post reviews or reports that are abusive, hateful, misleading or unlawful, or that contain others' private information.</li>
        <li>Do not attack, overload or probe the site's security. If you find a vulnerability, please tell us at <Contact />.</li>
      </ul>
      <h2>Content and creators</h2>
      <p>Comics and series belong to their creators and licensors. Creators who submit work confirm that they own it or are licensed to distribute it here, that it does not infringe anyone's rights, and that the rights information they provide is accurate. We review submissions and may decline, unpublish or remove content at any time.</p>
      <h2>Reviews and ratings</h2>
      <p>You keep ownership of what you write and give us permission to display it on the site. We may remove content that breaks these terms.</p>
      <h2>Memberships</h2>
      <p>Where memberships are offered, prices and what they include are shown at checkout. Payments are processed by our payment provider. Refund requests are handled case by case.</p>
      <h2>Suspension and ending your account</h2>
      <p>We may suspend or close accounts that break these terms. You can delete your account at any time in profile settings.</p>
      <h2>Disclaimer</h2>
      <p>The site is provided as is. We work to keep it available and accurate but do not promise it will be uninterrupted or error free, and to the extent the law allows we are not liable for indirect or consequential loss.</p>
      {SITE.jurisdiction && <><h2>Governing law</h2><p>These terms are governed by the laws of {SITE.jurisdiction}.</p></>}
      <h2>Changes</h2>
      <p>We may update these terms. Continuing to use the site after a change means you accept it.</p>
    </StaticPage>
  );
}
