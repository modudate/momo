import Link from "next/link";
import { COMPANY } from "@/data/company";

// 전자상거래법 사업자정보 표시 + 약관/개인정보처리방침 링크
export default function SiteFooter() {
  const infoRows: { label: string; value: string }[] = [
    { label: "상호", value: COMPANY.corporationName },
    { label: "대표", value: COMPANY.ceo },
    { label: "주소", value: COMPANY.address },
    { label: "사업자등록번호", value: COMPANY.businessRegistrationNumber },
    {
      label: "통신판매업 신고번호",
      value: COMPANY.mailOrderSalesNumber || "신고 준비중",
    },
    { label: "전화", value: COMPANY.phone },
    { label: "이메일", value: COMPANY.email },
  ];

  return (
    <div className="site-footer-wrap">
      <footer className="site-footer">
      <div className="site-footer-links">
        <Link href="/terms">이용약관</Link>
        <span className="site-footer-dot">·</span>
        <Link href="/privacy" className="site-footer-strong">
          개인정보처리방침
        </Link>
      </div>

      <dl className="site-footer-info">
        {infoRows.map((row) => (
          <div key={row.label} className="site-footer-row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>

      <p className="site-footer-copy">
        © 2026 {COMPANY.corporationName} ({COMPANY.serviceName}). All rights
        reserved.
      </p>
      </footer>
    </div>
  );
}
