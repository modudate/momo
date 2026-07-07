// 모임 카테고리 (통화 기준: 와인/커피/인기남녀/프리미엄)
export const CATEGORIES = [
  { key: "wine", label: "와인 모임" },
  { key: "coffee", label: "커피 모임" },
  { key: "popular", label: "인기남녀 모임" },
  { key: "premium", label: "프리미엄 모임" },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

export function categoryLabel(key: string): string {
  return CATEGORIES.find((category) => category.key === key)?.label ?? "모임";
}

// 나이대 프리셋 (자유 입력도 허용)
export const AGE_GROUP_PRESETS = ["전연령", "2039", "3045", "2535", "3040", "4050"];
