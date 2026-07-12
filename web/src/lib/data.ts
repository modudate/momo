// 서버 데이터 계층 — Supabase 설정 시 DB, 아니면 mock 데이터로 폴백
import {
  regions as mockRegions,
  type Region,
  type RegionSlug,
  type MoimEvent,
} from "@/data/moim-data";
import { getAdminClient } from "@/lib/supabase/admin";
import { isMeetingVisible } from "@/lib/booking";

type DbRegion = {
  slug: string;
  name: string;
  full_name: string;
  area: string;
  accent: string;
};

type DbMeeting = {
  id: string;
  region_slug: string;
  date: string;
  time: string;
  end_time?: string | null;
  hidden?: boolean | null;
  title: string;
  tag: string;
  price: number;
  capacity: number;
  joined: number;
  image: string | null;
};

function mapEvent(e: DbMeeting): MoimEvent {
  return {
    id: e.id,
    date: e.date,
    time: e.time,
    endTime: e.end_time ?? null,
    hidden: e.hidden ?? false,
    title: e.title,
    tag: e.tag,
    price: e.price,
    capacity: e.capacity,
    joined: e.joined,
    image: e.image ?? `https://picsum.photos/seed/${e.id}/800/600`,
  };
}

export async function getRegionWithEvents(slug: string): Promise<Region | null> {
  const admin = getAdminClient();
  if (!admin) {
    return mockRegions.find((r) => r.slug === slug) ?? null;
  }

  const { data: region } = await admin
    .from("regions")
    .select("slug,name,full_name,area,accent")
    .eq("slug", slug)
    .single<DbRegion>();
  if (!region) return null;

  const { data: allEvents } = await admin
    .from("meetings")
    .select(
      "id,region_slug,date,time,end_time,hidden,title,tag,price,capacity,joined,image,description,template_id,virtual_male,virtual_female",
    )
    .eq("region_slug", slug)
    .order("date", { ascending: true })
    .returns<
      (DbMeeting & {
        description: string | null;
        template_id: string | null;
        virtual_male: number | null;
        virtual_female: number | null;
      })[]
    >();

  // 관리자 강제 숨김 / 종료 시간이 지난 모임은 손님 화면에서 제외
  const events = (allEvents ?? []).filter((e) =>
    isMeetingVisible({ date: e.date, time: e.time, endTime: e.end_time, hidden: e.hidden ?? false }),
  );

  // 손님에게 보이는 인원 = 실구매(취소 제외) + 가상구매 (성별 포함)
  const ids = events.map((e) => e.id);
  const realCount = new Map<string, { total: number; male: number; female: number }>();
  if (ids.length > 0) {
    const { data: orders } = await admin
      .from("orders")
      .select("meeting_id,gender")
      .in("meeting_id", ids)
      .neq("status", "cancelled")
      .returns<{ meeting_id: string; gender: string | null }[]>();
    (orders ?? []).forEach((o) => {
      const cur = realCount.get(o.meeting_id) ?? { total: 0, male: 0, female: 0 };
      cur.total += 1;
      if (o.gender === "male") cur.male += 1;
      else if (o.gender === "female") cur.female += 1;
      realCount.set(o.meeting_id, cur);
    });
  }

  // 옵션 가격 (상품별) — 카드에 "최저가~" 표기용
  const templateIds = [...new Set(events.map((e) => e.template_id).filter(Boolean))] as string[];
  const priceByTemplate = new Map<string, { min: number; varies: boolean }>();
  if (templateIds.length > 0) {
    const { data: opts } = await admin
      .from("template_options")
      .select("template_id,price")
      .in("template_id", templateIds)
      .returns<{ template_id: string; price: number }[]>();
    const grouped = new Map<string, number[]>();
    (opts ?? []).forEach((o) => {
      const arr = grouped.get(o.template_id) ?? [];
      arr.push(o.price);
      grouped.set(o.template_id, arr);
    });
    grouped.forEach((prices, tid) => {
      priceByTemplate.set(tid, {
        min: Math.min(...prices),
        varies: new Set(prices).size > 1,
      });
    });
  }

  return {
    slug: region.slug as RegionSlug,
    name: region.name,
    fullName: region.full_name,
    area: region.area,
    accent: region.accent,
    homeImage: `/regions/${region.slug}.webp`,
    events: events.map((e) => {
      const real = realCount.get(e.id) ?? { total: 0, male: 0, female: 0 };
      const vm = e.virtual_male ?? 0;
      const vf = e.virtual_female ?? 0;
      const opt = e.template_id ? priceByTemplate.get(e.template_id) : undefined;
      return {
        ...mapEvent({ ...e, joined: real.total + vm + vf }),
        male: real.male + vm,
        female: real.female + vf,
        description: e.description ?? undefined,
        priceFrom: opt?.min ?? e.price,
        priceVaries: opt?.varies ?? false,
      };
    }),
  };
}

export type DetailBlock =
  | { type: "text"; text: string }
  | { type: "image"; url: string }
  | { type: "html"; html: string }; // 게시판식 에디터 저장분

// 손님에게 보이는 인원 (실구매 + 가상구매)
export type MeetingCounts = {
  capacity: number;
  total: number; // 현재 인원 (실+가상)
  male: number;
  female: number;
};

// 실구매(취소 제외) 성별 집계 + 가상구매 합산
export async function getMeetingCounts(meetingId: string): Promise<MeetingCounts | null> {
  const admin = getAdminClient();
  if (!admin) return null;

  const [{ data: meeting }, { data: orders }] = await Promise.all([
    admin
      .from("meetings")
      .select("capacity,virtual_male,virtual_female")
      .eq("id", meetingId)
      .maybeSingle<{ capacity: number; virtual_male: number | null; virtual_female: number | null }>(),
    admin
      .from("orders")
      .select("gender,status")
      .eq("meeting_id", meetingId)
      .neq("status", "cancelled")
      .returns<{ gender: string | null; status: string }[]>(),
  ]);
  if (!meeting) return null;

  let male = meeting.virtual_male ?? 0;
  let female = meeting.virtual_female ?? 0;
  let total = male + female;
  (orders ?? []).forEach((o) => {
    total += 1;
    if (o.gender === "male") male += 1;
    else if (o.gender === "female") female += 1;
  });

  return { capacity: meeting.capacity, total, male, female };
}

export type MeetingDetail = MoimEvent & {
  regionSlug: string;
  regionName: string;
  closed_male: boolean;
  closed_female: boolean;
  detail: DetailBlock[]; // 상품 상세 페이지 블록 (템플릿에서)
};

type DbMeetingDetail = DbMeeting & {
  description: string | null;
  place: string | null;
  closed_male: boolean | null;
  closed_female: boolean | null;
  template_id: string | null;
  regions: { name: string } | null;
};

export async function getMeetingDetail(id: string): Promise<MeetingDetail | null> {
  const admin = getAdminClient();
  if (!admin) {
    for (const region of mockRegions) {
      const event = region.events.find((item) => item.id === id);
      if (event) {
        return {
          ...event,
          regionSlug: region.slug,
          regionName: region.name,
          closed_male: false,
          closed_female: false,
          detail: [],
        };
      }
    }
    return null;
  }

  const { data } = await admin
    .from("meetings")
    .select(
      "id,region_slug,date,time,title,tag,price,capacity,joined,image,description,place,closed_male,closed_female,template_id,regions(name)",
    )
    .eq("id", id)
    .single<DbMeetingDetail>();
  if (!data) return null;

  // 상품(템플릿)의 상세 블록
  let detail: DetailBlock[] = [];
  if (data.template_id) {
    const { data: tpl } = await admin
      .from("moim_templates")
      .select("detail")
      .eq("id", data.template_id)
      .maybeSingle<{ detail: DetailBlock[] }>();
    if (Array.isArray(tpl?.detail)) detail = tpl.detail;
  }

  return {
    ...mapEvent(data),
    description: data.description ?? undefined,
    place: data.place ?? undefined,
    regionSlug: data.region_slug,
    regionName: data.regions?.name ?? data.region_slug,
    closed_male: data.closed_male ?? false,
    closed_female: data.closed_female ?? false,
    detail,
  };
}

export type MeetingLite = {
  id: string;
  title: string;
  price: number;
  date: string;
  time: string;
  end_time: string | null;
  hidden: boolean;
  template_id: string | null;
  closed_male: boolean;
  closed_female: boolean;
};

export async function getMeetingLite(id: string): Promise<MeetingLite | null> {
  const admin = getAdminClient();
  if (!admin) {
    for (const region of mockRegions) {
      const event = region.events.find((item) => item.id === id);
      if (event) {
        return {
          id: event.id,
          title: event.title,
          price: event.price,
          date: event.date,
          time: event.time,
          end_time: null,
          hidden: false,
          template_id: null,
          closed_male: false,
          closed_female: false,
        };
      }
    }
    return null;
  }
  const { data } = await admin
    .from("meetings")
    .select("id,title,price,date,time,end_time,hidden,template_id,closed_male,closed_female")
    .eq("id", id)
    .single<MeetingLite>();
  return data ?? null;
}

export type MeetingOption = {
  id: string;
  label: string;
  gender: string;
  age_group: string;
  price: number;
  capacity: number;
};

// 모임의 판매 옵션 (템플릿에 정의된 옵션) + 옵션별 현재 신청 수
export async function getMeetingOptions(
  meetingId: string,
): Promise<(MeetingOption & { joined: number })[]> {
  const admin = getAdminClient();
  if (!admin) return [];

  const { data: meeting } = await admin
    .from("meetings")
    .select("template_id")
    .eq("id", meetingId)
    .single<{ template_id: string | null }>();
  if (!meeting?.template_id) return [];

  const { data: options } = await admin
    .from("template_options")
    .select("id,label,gender,age_group,price,capacity")
    .eq("template_id", meeting.template_id)
    .order("sort", { ascending: true })
    .returns<MeetingOption[]>();
  if (!options || options.length === 0) return [];

  // 옵션별 신청 수 (취소 제외)
  const { data: orders } = await admin
    .from("orders")
    .select("option_id")
    .eq("meeting_id", meetingId)
    .neq("status", "cancelled")
    .returns<{ option_id: string | null }[]>();
  const countByOption = new Map<string, number>();
  (orders ?? []).forEach((order) => {
    if (order.option_id) countByOption.set(order.option_id, (countByOption.get(order.option_id) ?? 0) + 1);
  });

  return options.map((option) => ({ ...option, joined: countByOption.get(option.id) ?? 0 }));
}
