"use client";
import ComicForm from "@/components/admin/ComicForm";
import { State } from "@/components/admin/ui";
import { useLoad } from "@/lib/useApi";
export default function EditComic({ params }: { params: { id: string } }) {
  const { data, error, loading } = useLoad<any>(`/admin/comics/${params.id}`);
  return <div><h1 className="mb-4 text-2xl font-bold">Edit comic</h1><State loading={loading} error={error} />{data && <ComicForm initial={data} />}</div>;
}