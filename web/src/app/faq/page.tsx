import type { Metadata } from "next";
import TopNav from "@/components/TopNav";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "자주 묻는 질문",
  description: "모두의 모임 이용에 대해 자주 묻는 질문을 모았습니다.",
};

// 자주 묻는 질문 — 내용 변경이 필요하면 이 배열만 수정하면 됩니다.
const FAQS: { q: string; a: string }[] = [
  {
    q: "모임은 어떻게 신청하나요?",
    a: "지점(강남·홍대·수원)을 선택하고 원하는 날짜의 모임을 고른 뒤 [신청하기]를 눌러주세요.\n인원과 참가자 정보를 입력하면 신청이 완료됩니다.",
  },
  {
    q: "혼자 가도 괜찮을까요?",
    a: "네, 대부분 혼자 오십니다.\n진행자가 자리 배치와 대화를 이끌어드리니 편하게 오셔도 됩니다.",
  },
  {
    q: "남녀 성비는 어떻게 맞추나요?",
    a: "모임마다 남녀 인원을 균형 있게 조정하고 있습니다.\n한쪽 성별이 마감되면 해당 성별은 신청이 제한될 수 있습니다.",
  },
  {
    q: "몇 시까지 가야 하나요?",
    a: "모임 시작 시간에 맞춰 와주시면 됩니다.\n와인 모임처럼 늦게 합류가 가능한 모임도 있으니, 늦으실 것 같으면 문의해 주세요.",
  },
  {
    q: "취소·환불은 어떻게 되나요?",
    a: "결제 후 1시간 이내에는 100% 환불됩니다.\n이후 모임 시작 전까지는 50% 환불되며, 모임 시작 이후에는 환불이 어렵습니다.",
  },
  {
    q: "복장 규정이 있나요?",
    a: "특별한 규정은 없습니다.\n다만 첫인상이 중요한 자리인 만큼 단정한 복장을 권해드립니다.",
  },
  {
    q: "사진 촬영이 가능한가요?",
    a: "참여자 보호를 위해 다른 분이 나오는 사진 촬영은 삼가주세요.\n촬영이 필요하시면 진행자에게 먼저 문의해 주세요.",
  },
  {
    q: "후기는 누가 쓸 수 있나요?",
    a: "모임에 참여하신 분만 후기를 남길 수 있습니다.\n마이페이지의 신청내역에서 후기를 작성해 주세요. (예약 1건당 후기 1개)",
  },
];

export default function FaqPage() {
  return (
    <div className="app-main pb-10">
      <TopNav title="자주 묻는 질문" back />

      <div className="page-content pt-5">
        <h2 className="tds-title-lg">
          모두의 모임
          <br />
          자주 묻는 질문
        </h2>
        <p className="tds-caption mt-2">궁금한 점이 있으면 문의하기로 연락 주세요.</p>
      </div>

      <section className="page-content pt-5">
        <div className="faq-list">
          {FAQS.map((item, i) => (
            <details key={i} className="faq-item" open={i === 0}>
              <summary className="faq-q">
                <span className="faq-mark">Q</span>
                {item.q}
              </summary>
              <p className="faq-a">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
