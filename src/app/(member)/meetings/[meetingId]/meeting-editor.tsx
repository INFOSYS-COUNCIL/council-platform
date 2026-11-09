"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/detail";

// BlockNote는 브라우저에서만 그린다
export const MeetingEditor = dynamic(() => import("./collab-editor").then((m) => m.CollabEditor), {
  ssr: false,
  loading: () => <Skeleton className="h-64" />,
});
