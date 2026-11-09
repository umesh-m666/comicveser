import { redirect } from "next/navigation";

export default function NovelRedirect() {
  redirect("/manga");
}

export function generateStaticParams() {
  return [{ slug: 'default' }];
}
