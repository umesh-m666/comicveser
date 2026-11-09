export default function StaticPage({ title, updated, children }: { title: string; updated?: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl space-y-4 text-muted [&_a]:text-primary [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-fg [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-6">
      <h1 className="text-3xl font-extrabold text-fg">{title}</h1>
      {updated && <p className="text-sm">Last updated {updated}</p>}
      {children}
    </article>
  );
}
export function Contact() {
  const e = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return e ? <a href={`mailto:${e}`}>{e}</a> : <span>(contact address not set yet)</span>;
}
