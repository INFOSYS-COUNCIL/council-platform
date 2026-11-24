"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/detail";

export const PhotoEditor = dynamic(
  () => import("./photo-editor-surface").then((module) => module.PhotoEditorSurface),
  { ssr: false, loading: () => <Skeleton className="h-64" /> },
);
