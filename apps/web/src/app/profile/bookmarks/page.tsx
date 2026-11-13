import BookmarksView from "@/components/BookmarksView";
export const metadata = { title: "My bookmarks" };
export default function Page() {
  return (
    <div>
      <section className="cv-feature mb-8 rounded-3xl p-6 md:p-8">
        <p className="cv-eyebrow">Your library</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Bookmarks</h1>
        <p className="mt-2 text-sm text-muted md:text-base">Every series you saved — tap a cover to pick up where you left off.</p>
      </section>
      <Library kind="bookmarks" />
    </div>
  );
}
