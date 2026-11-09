import ChapterManager from "@/components/admin/ChapterManager";
export default function Page({ params }: { params: { id: string } }) { return <ChapterManager id={params.id} mode="creator" />; }

export function generateStaticParams() {
  return [{ id: '1' }];
}
