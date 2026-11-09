import { redirect } from "next/navigation";

export default function AdminMangaRedirect() {
  redirect("/admin/comics");
}
