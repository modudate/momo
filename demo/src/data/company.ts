// 사업자 정보 (전자상거래법 표시 의무 / KCP 가맹 심사용)
export const COMPANY = {
  serviceName: "모두의 모임",
  corporationName: "주식회사 임펄스",
  ceo: "김도유, 정원진 (공동대표)",
  address: "경기도 용인시 기흥구 보정로 30, 105동 1602호 (보정동)",
  businessRegistrationNumber: "516-86-03525",
  // 통신판매업 신고번호 (정부24 신고 완료)
  mailOrderSalesNumber: "제2026-용인기흥-01116호",
  phone: "010-6420-1827",
  email: "date245@naver.com",
  // 개인정보보호책임자
  privacyOfficerName: "김도유",
  privacyOfficerEmail: "date245@naver.com",
} as const;

// tel: 링크용 (하이픈 제거)
export const phoneHref = `tel:${COMPANY.phone.replace(/-/g, "")}`;
