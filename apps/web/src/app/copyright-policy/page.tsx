import type { Metadata } from "next";
import StaticPage, { Contact } from "@/components/StaticPage";
import { SITE } from "@/lib/site";
export const metadata: Metadata = { title: "Copyright policy" };
// TODO before launch: have this reviewed, and register a designated agent if you are subject to US DMCA rules.
export default function CopyrightPolicy() {
  return (
    <StaticPage title="Copyright policy" updated={SITE.updated}>
      <p>{SITE.name} publishes original work and work licensed for distribution. We respect the rights of creators and expect everyone who uses or publishes on the site to do the same.</p>
      <h2>Our approach</h2>
      <ul>
        <li>Creators must give us rights information for every submission, and each submission is reviewed before it is published.</li>
        <li>We act quickly on valid complaints and may remove content first and investigate afterwards.</li>
        <li>Creators who repeatedly infringe lose access to the creator portal and may have their account closed.</li>
      </ul>
      <h2>Reporting infringement</h2>
      <p>If you are the rights holder, or act for one, email <Contact /> with:</p>
      <ul>
        <li>your name, contact details and, if acting for someone else, who you represent;</li>
        <li>a description of the work you own;</li>
        <li>the exact address (URL) of the page on this site;</li>
        <li>a statement that you believe in good faith that the use is not authorised by the rights holder, its agent or the law;</li>
        <li>a statement that the information is accurate and, under penalty of perjury where that applies, that you are authorised to act; and</li>
        <li>your signature (typed is fine).</li>
      </ul>
      <h2>If your content was removed</h2>
      <p>If you believe content was removed by mistake, email <Contact /> with the page address, why you believe you have the right to publish it, and any licence or proof. We will review it and may restore the content if the complaint is withdrawn or found to be mistaken.</p>
      <h2>Other reports</h2>
      <p>Logged-in readers can also use the <strong>Report</strong> button on any comic page.</p>
    </StaticPage>
  );
}
