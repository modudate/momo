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

  // 옵션 가격 + 상품 정보 (상세 소개 · 카드 문구 · 주황 라벨)
  const templateIds = [...new Set(events.map((e) => e.template_id).filter(Boolean))] as string[];
  const priceByTemplate = new Map<string, { min: number; varies: boolean }>();
  const infoByTemplate = new Map<string, { desc: string; note: string; label: string }>();
  if (templateIds.length > 0) {
    const [{ data: opts }, { data: tpls }, { data: secs }] = await Promise.all([
      admin
        .from("template_options")
        .select("template_id,price")
        .in("template_id", templateIds)
        .returns<{ template_id: string; price: number }[]>(),
      admin
        .from("moim_templates")
        .select("id,description,card_note,home_label,home_section")
        .in("id", templateIds)
        .returns<
          {
            id: string;
            description: string | null;
            card_note: string | null;
            home_label: string | null;
            home_section: string | null;
          }[]
        >(),
      admin
        .from("home_sections")
        .select("key,card_label")
        .returns<{ key: string; card_label: string }[]>(),
    ]);

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

    // 주황 라벨: 상품에 지정한 라벨 → 없으면 홈 카테고리의 기본 라벨
    const sectionLabel = new Map((secs ?? []).map((s) => [s.key, s.card_label]));
    (tpls ?? []).forEach((t) => {
      infoByTemplate.set(t.id, {
        desc: t.description?.trim() ?? "",
        note: t.card_note?.trim() ?? "",
        label:
          t.home_label?.trim() ||
          (t.home_section ? (sectionLabel.get(t.home_section) ?? "") : ""),
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
      const info = e.template_id ? infoByTemplate.get(e.template_id) : undefined;
      // 소개 문구 = 일정에 직접 쓴 문구 → 없으면 예약 상품의 "상세 소개"
      const desc = e.description?.trim() || info?.desc || "";
      return {
        ...mapEvent({ ...e, joined: real.total + vm + vf }),
        male: real.male + vm,
        female: real.female + vf,
        description: desc || undefined,
        cardNote: info?.note || undefined,
        label: info?.label || undefined,
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
        };
      }
    }
    return null;
  }

  const { data } = await admin
    .from("meetings")
    .select(
      "id,region_slug,date,time,end_time,hidden,title,tag,price,capacity,joined,image,description,place,closed_male,closed_female,template_id,regions(name)",
    )
    .eq("id", id)
    .single<DbMeetingDetail>();
  if (!data) return null;

  // 모임 소개 = 일정에 직접 쓴 문구가 있으면 그것, 없으면 예약 상품의 "상세 소개"
  let description = data.description?.trim() || "";
  if (!description && data.template_id) {
    const { data: tpl } = await admin
      .from("moim_templates")
      .select("description")
      .eq("id", data.template_id)
      .maybeSingle<{ description: string | null }>();
    description = tpl?.description?.trim() || "";
  }

  return {
    ...mapEvent(data),
    description: description || undefined,
    place: data.place ?? undefined,
    regionSlug: data.region_slug,
    regionName: data.regions?.name ?? data.region_slug,
    closed_male: data.closed_male ?? false,
    closed_female: data.closed_female ?? false,
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
