import "server-only";
import { BlockNoteEditor, type PartialBlock } from "@blocknote/core";
import { blocksToYDoc } from "@blocknote/core/yjs";
import * as Y from "yjs";
import { MEETING_FRAGMENT, toBytea } from "./labels";
import { meetingSchema } from "./schema";

// 회의록 Yjs 상태를 서버에서 만든다(기획서 6.5·6.7절). 결과는 DB 함수에 넘길 bytea 문자열이다.

// Template Block으로 초기 Y.Doc을 만든다. 생성 요청에서 한 번만 만들어 Snapshot v1로 저장하므로,
// 두 사람이 새 회의록을 동시에 열어도 Template이 두 번 들어가지 않는다.
// 빈 문서도 문단 하나로 시작한다. 비어 있으면 처음 연 사람마다 빈 문단을 따로 만들어 겹친다.
export function templateState(blocks: unknown) {
  const initial = Array.isArray(blocks) && blocks.length > 0 ? blocks : [{ type: "paragraph" }];
  // _headless: DOM 없이 Block 변환만 쓴다
  const editor = BlockNoteEditor.create({ schema: meetingSchema, _headless: true } as Parameters<typeof BlockNoteEditor.create>[0]);
  const doc = blocksToYDoc(editor, initial as PartialBlock[], MEETING_FRAGMENT);
  return { state: toBytea(Y.encodeStateAsUpdate(doc)), vector: toBytea(Y.encodeStateVector(doc)) };
}

// Snapshot과 그 뒤 Update를 하나로 합친다(확정 시 최종 Snapshot)
export function mergedState(snapshot: Uint8Array, updates: Uint8Array[]) {
  const merged = Y.mergeUpdates([snapshot, ...updates]);
  return { state: toBytea(merged), vector: toBytea(Y.encodeStateVectorFromUpdate(merged)) };
}
