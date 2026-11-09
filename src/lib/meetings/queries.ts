import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { fromBytea } from "./labels";
import { mergedState } from "./ydoc";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// 최신 Snapshot + 그 뒤 Update를 합친 현재 본문 상태(기획서 6.5절 5번). 읽기 권한은 RLS가 정한다.
// 반환값 lastSeq는 합친 상태에 들어 있는 마지막 순번이다.
export async function fetchMeetingState(supabase: ServerClient, meetingId: string) {
  const { data: snapshot, error } = await supabase
    .from("meeting_crdt_snapshots")
    .select("state_bytes, last_sequence_no")
    .eq("meeting_id", meetingId)
    .order("snapshot_version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !snapshot) throw new Error("회의록 본문을 불러오지 못했습니다.", { cause: error });

  // 한 번에 돌려주는 행 수에 한도가 있어 순번 순으로 나눠 읽는다
  const updates: Uint8Array[] = [];
  let lastSeq = snapshot.last_sequence_no;
  for (;;) {
    const { data, error: updateError } = await supabase
      .from("meeting_crdt_updates")
      .select("sequence_no, update_bytes")
      .eq("meeting_id", meetingId)
      .gt("sequence_no", lastSeq)
      .order("sequence_no")
      .limit(500);
    if (updateError) throw new Error("회의록 본문을 불러오지 못했습니다.", { cause: updateError });
    for (const row of data) updates.push(fromBytea(row.update_bytes));
    if (data.length > 0) lastSeq = data[data.length - 1].sequence_no;
    if (data.length < 500) break;
  }

  return { ...mergedState(fromBytea(snapshot.state_bytes), updates), lastSeq };
}
