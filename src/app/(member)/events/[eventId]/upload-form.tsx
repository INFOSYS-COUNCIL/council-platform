"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form-field";
import { MAX_UPLOAD_BYTES, UPLOAD_TYPES, uploadPath, uploadProblem } from "@/lib/events/labels";
import { createClient } from "@/lib/supabase/client";
import { registerEventUpload } from "../actions";

const ACCEPT = Object.keys(UPLOAD_TYPES).map((ext) => `.${ext}`).join(",");

// 파일은 브라우저가 Storage에 바로 올린다(서버를 거치면 Vercel 요청 크기 제한에 걸린다).
// 올리기 권한·크기·형식은 Storage 정책과 Bucket 설정이 다시 검사한다.
export function UploadForm({ termId, eventId }: { termId: string; eventId: string }) {
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const file = (form.elements.namedItem("file") as HTMLInputElement).files?.[0];
    const title = (form.elements.namedItem("title") as HTMLInputElement).value.trim() || file?.name || "";
    if (!file) return setMessage({ tone: "error", text: "올릴 파일을 골라 주세요." });
    const problem = uploadProblem(file);
    if (problem) return setMessage({ tone: "error", text: problem });

    setPending(true);
    setMessage(null);
    const ext = file.name.split(".").pop()!.toLowerCase();
    const path = uploadPath(termId, eventId, file.name, crypto.randomUUID());
    const { error } = await createClient()
      .storage.from("event-files")
      .upload(path, file, { contentType: UPLOAD_TYPES[ext], upsert: false });

    if (error) {
      setPending(false);
      return setMessage({ tone: "error", text: "파일을 올리지 못했습니다. 형식과 크기를 확인하고 다시 시도해 주세요." });
    }
    const result = await registerEventUpload(eventId, title.slice(0, 100), path);
    setPending(false);
    if (result.status === "error") return setMessage({ tone: "error", text: result.message });
    form.reset();
    setMessage({ tone: "info", text: "파일을 올렸습니다." });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="file" className="block text-sm font-medium">
          파일 <span className="ml-1 text-red-700 dark:text-red-400">(필수)</span>
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept={ACCEPT}
          required
          aria-describedby="file-hint"
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-coral-100 file:px-3 file:py-2 file:font-medium file:text-coral-900"
        />
        <p id="file-hint" className="text-sm text-zinc-600 dark:text-zinc-400">
          PDF·이미지·XLSX·DOCX·PPTX·HWP·HWPX, 파일당 {MAX_UPLOAD_BYTES / 1024 / 1024}MB까지. 더 큰 파일은 링크로 등록해 주세요.
        </p>
      </div>
      <TextField label="제목" name="title" maxLength={100} hint="비우면 파일 이름을 씁니다." />
      <Button type="submit" variant="secondary" disabled={pending} aria-busy={pending}>
        {pending ? "올리는 중…" : "파일 올리기"}
      </Button>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
    </form>
  );
}
