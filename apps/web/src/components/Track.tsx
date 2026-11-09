"use client";
import { useEffect } from "react";
import { Evt, track } from "@/lib/analytics";
export default function Track(props: Evt) {
  useEffect(() => { track(props); }, [props.type, props.comicId, props.chapterId, props.query]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
