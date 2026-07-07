// 모두의 모임 — 데이터 모델
// 외부 링크(전화·인스타·카톡·스모어 등)는 placeholder 입니다. 실제 값으로 교체하세요. (TODO)

export const SITE = {
  brand: "모두의 모임",
  // 모두의 소개팅 (외부 사이트)
  datingUrl: "https://joinmoso.imweb.me",
  // 문의 채널
  phone: "010-6420-1827",
  instagram: "https://instagram.com/모두의모임", // TODO: 실제 핸들
  kakaoChannel: "http://pf.kakao.com/_xXXXXX/chat", // TODO: 카톡 채널 채팅 링크
};

export type RegionSlug = "gangnam" | "hongdae" | "suwon";

export type MoimEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  title: string;
  tag: string;
  price: number; // 카드 결제 (티켓)
  capacity: number;
  joined: number; // 손님에게 보이는 인원 (실구매+가상)
  male?: number; // 남자 신청 (실+가상)
  female?: number; // 여자 신청 (실+가상)
  image: string;
  description?: string; // 상세 소개
  place?: string; // 장소
};

export type Region = {
  slug: RegionSlug;
  name: string; // 선릉
  fullName: string; // 선릉 모두의 모임
  area: string; // 강남구 선릉로
  accent: string;
  homeImage: string; // 홈 지역 타일 배경 이미지 (Nano Banana 이미지로 교체 가능)
  events: MoimEvent[];
};

const img = (seed: string) => `https://picsum.photos/seed/${seed}/800/600`;

// 2026-06 기준 일정 데이터
function buildEvents(prefix: string, base: Partial<MoimEvent>[]): MoimEvent[] {
  return base.map((e, i) => ({
    id: `${prefix}-${i + 1}`,
    date: e.date!,
    time: e.time ?? "19:30",
    title: e.title!,
    tag: e.tag ?? "정기모임",
    price: e.price ?? 25000,
    capacity: e.capacity ?? 12,
    joined: e.joined ?? 0,
    image: e.image ?? img(`${prefix}-${i}`),
  }));
}

export const regions: Region[] = [
  {
    slug: "gangnam",
    name: "강남",
    fullName: "강남 모두의 모임",
    area: "서울 강남구",
    accent: "#FF8A3D",
    homeImage: "/regions/gangnam.webp",
    events: buildEvents("gangnam", [
      { date: "2026-06-24", time: "19:30", title: "강남 와인 & 네트워킹", tag: "와인", price: 33000, capacity: 16, joined: 11 },
      { date: "2026-06-26", time: "20:00", title: "강남 금요 소셜 다이닝", tag: "다이닝", price: 39000, capacity: 20, joined: 14 },
      { date: "2026-06-27", time: "18:00", title: "강남 토요 보드게임 파티", tag: "보드게임", price: 22000, capacity: 18, joined: 7 },
      { date: "2026-06-28", time: "14:00", title: "강남 브런치 모임", tag: "브런치", price: 28000, capacity: 14, joined: 9 },
      { date: "2026-07-01", time: "19:30", title: "강남 수요 와인클래스", tag: "클래스", price: 45000, capacity: 12, joined: 4 },
      { date: "2026-07-03", time: "20:00", title: "강남 불금 칵테일바", tag: "칵테일", price: 35000, capacity: 20, joined: 16 },
    ]),
  },
  {
    slug: "hongdae",
    name: "홍대",
    fullName: "홍대 모두의 모임",
    area: "서울 마포구 홍익로",
    accent: "#FF6B1A",
    homeImage: "/regions/hongdae.webp",
    events: buildEvents("hong", [
      { date: "2026-06-23", time: "20:00", title: "홍대 보드게임 번개", tag: "보드게임", price: 18000, capacity: 16, joined: 12 },
      { date: "2026-06-25", time: "19:30", title: "홍대 목요 펍 크롤", tag: "펍", price: 30000, capacity: 24, joined: 19 },
      { date: "2026-06-27", time: "21:00", title: "홍대 토요 클럽 나이트", tag: "나이트", price: 25000, capacity: 30, joined: 22 },
      { date: "2026-06-29", time: "18:00", title: "홍대 일요 라이브 공연", tag: "공연", price: 27000, capacity: 20, joined: 8 },
      { date: "2026-07-02", time: "19:30", title: "홍대 보드게임 파티", tag: "보드게임", price: 18000, capacity: 16, joined: 5 },
      { date: "2026-07-04", time: "20:00", title: "홍대 불금 소셜", tag: "소셜", price: 32000, capacity: 24, joined: 15 },
    ]),
  },
  {
    slug: "suwon",
    name: "수원",
    fullName: "수원 모두의 모임",
    area: "경기 수원시 영통구",
    accent: "#3182F6",
    homeImage: "/regions/suwon.webp",
    events: buildEvents("suwon", [
      { date: "2026-06-24", time: "19:00", title: "수원 직장인 다이닝", tag: "다이닝", price: 29000, capacity: 16, joined: 10 },
      { date: "2026-06-26", time: "20:00", title: "수원 금요 와인 모임", tag: "와인", price: 31000, capacity: 14, joined: 6 },
      { date: "2026-06-28", time: "14:00", title: "수원 주말 카페 투어", tag: "카페", price: 20000, capacity: 12, joined: 9 },
      { date: "2026-07-01", time: "19:30", title: "수원 수요 보드게임", tag: "보드게임", price: 17000, capacity: 16, joined: 3 },
      { date: "2026-07-05", time: "18:00", title: "수원 일요 브런치 소셜", tag: "브런치", price: 26000, capacity: 14, joined: 7 },
    ]),
  },
];

export function getRegion(slug: string): Region | undefined {
  return regions.find((r) => r.slug === slug);
}

// 홈 — 슬라이딩 이미지 (여러 이미지가 흘러감)
export const heroSlides = [
  { id: "h1", title: "오늘 밤, 강남에서 만나요", caption: "와인 한 잔으로 시작하는 저녁", image: "/moso-mood-bar.webp" },
  { id: "h2", title: "홍대 주말 소셜 파티", caption: "낯선 사람과 가까워지는 시간", image: "/moso-hero.webp" },
  { id: "h3", title: "취향이 통하는 클래스 모임", caption: "함께 배우고 함께 즐기기", image: "/moso-mood-class.webp" },
  { id: "h4", title: "수원 직장인 다이닝", caption: "퇴근 후 가볍게 한 끼", image: img("home-suwon") },
];

// 모임별 소개
export type MoimIntro = {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  image: string;
  href?: string;
};

export const moimIntros: MoimIntro[] = [
  { id: "i1", emoji: "🍷", title: "와인모임", desc: "퇴근 후 가볍게 즐기는 와인·소셜 다이닝 모임", image: "/moso-mood-bar.webp", href: "/region/gangnam" },
  { id: "i2", emoji: "☕", title: "커피모임", desc: "취향이 통하는 사람들과 카페에서 만나는 모임", image: img("intro-coffee"), href: "/region/suwon" },
  { id: "i3", emoji: "👑", title: "프리미엄모임", desc: "인증된 멤버만 참여하는 소수 정예 프리미엄 모임", image: "/moso-mood-class.webp", href: "/verify" },
  { id: "i4", emoji: "💖", title: "인기남녀모임", desc: "인기 인증을 받은 멤버들과 함께하는 만남", image: "/moso-hero.webp", href: "/verify" },
];

// 인증 — 프리미엄 / 인기남녀
export type VerifyPlan = {
  slug: "premium" | "popular";
  badge: string;
  title: string;
  subtitle: string;
  fee: number; // 참가비 (계좌이체)
  perks: string[];
  // 저희가 제작한 랜딩페이지 + 스모어 계좌이체 링크 (TODO: 실제 값으로 교체)
  landingUrl: string;
  smoreUrl: string;
};

export const verifyPlans: VerifyPlan[] = [
  {
    slug: "premium",
    badge: "PREMIUM",
    title: "프리미엄 모임 인증",
    subtitle: "검증된 멤버만 참여하는 프리미엄 모임",
    fee: 99000,
    perks: [
      "직업·신원 인증 완료 멤버 전용",
      "소수 정예 프리미엄 모임 우선 초대",
      "전담 매니저 1:1 케어",
    ],
    landingUrl: "https://moaum.example/premium", // TODO: 제작한 랜딩페이지
    smoreUrl: "https://moaform.com/q/PREMIUM", // TODO: 스모어 신청폼
  },
  {
    slug: "popular",
    badge: "POPULAR",
    title: "인기 남녀 인증",
    subtitle: "인기 멤버로 인증받고 더 많은 만남을",
    fee: 59000,
    perks: [
      "프로필 상단 노출 & 인기 뱃지",
      "인기 남녀 전용 모임 참여 자격",
      "매칭 우선권 제공",
    ],
    landingUrl: "https://moaum.example/popular", // TODO: 제작한 랜딩페이지
    smoreUrl: "https://moaform.com/q/POPULAR", // TODO: 스모어 신청폼
  },
];

export function getVerifyPlan(slug: string): VerifyPlan | undefined {
  return verifyPlans.find((p) => p.slug === slug);
}

export function formatKRW(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}
