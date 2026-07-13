// KCP 주문번호(ordr_idxx) ↔ 우리 그룹 주문 id(uuid) 변환
//  · KCP 주문번호는 영문/숫자 위주라 uuid 의 하이픈을 뺀 32자리 hex 를 쓴다.
//  · 예: 3f2b...  ↔  3f2b-....-....

export function groupIdToOrdrNo(groupId: string): string {
  return groupId.replace(/-/g, "");
}

export function ordrNoToGroupId(ordrNo: string): string | null {
  const hex = ordrNo.trim().toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) return null;
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}
