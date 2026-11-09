import { redirect } from "next/navigation";

export default function NovelChapterRedirect() {
  redirect("/manga");
}

export function generateStaticParams() {
  return [{ slug: 'default', chapterId: '1' }];
}
