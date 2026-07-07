import TopNav from "@/components/TopNav";
import SiteFooter from "@/components/SiteFooter";
import { COMPANY } from "@/data/company";
import { REFUND_POLICY } from "@/lib/refund";

export const metadata = { title: "이용약관 — 모두의 모임" };

export default function TermsPage() {
  return (
    <div className="app-main">
      <TopNav title="이용약관" back />
      <div className="page-content legal-body">
        <p className="legal-updated">시행일자: 2026년 7월 1일</p>

        <h2>제1조 (목적)</h2>
        <p>
          본 약관은 {COMPANY.corporationName}(이하 &ldquo;회사&rdquo;)가 운영하는
          &lsquo;{COMPANY.serviceName}&rsquo; 서비스(이하 &ldquo;서비스&rdquo;)의
          이용과 관련하여 회사와 이용자 간의 권리·의무 및 책임사항을 규정함을
          목적으로 합니다.
        </p>

        <h2>제2조 (정의)</h2>
        <ul>
          <li>
            &ldquo;서비스&rdquo;란 회사가 제공하는 오프라인 모임 정보 제공, 모임
            신청 및 결제 등 일체의 서비스를 말합니다.
          </li>
          <li>
            &ldquo;회원&rdquo;이란 본 약관에 동의하고 회사와 이용계약을 체결한
            자를 말합니다.
          </li>
          <li>
            &ldquo;모임&rdquo;이란 회사가 서비스를 통해 안내·판매하는 오프라인
            모임 및 행사를 말합니다.
          </li>
        </ul>

        <h2>제3조 (약관의 효력 및 변경)</h2>
        <p>
          본 약관은 서비스 화면에 게시함으로써 효력이 발생합니다. 회사는 관련
          법령을 위배하지 않는 범위에서 약관을 변경할 수 있으며, 변경 시 적용일자
          및 변경사유를 명시하여 사전 공지합니다.
        </p>

        <h2>제4조 (서비스의 제공)</h2>
        <ul>
          <li>모임 정보의 제공 및 일정 안내</li>
          <li>모임 신청 및 티켓 결제(신용카드 등)</li>
          <li>회원 문의 응대 및 알림 제공</li>
        </ul>

        <h2>제5조 (회원가입)</h2>
        <p>
          이용자는 회사가 정한 절차에 따라 회원정보를 제공하고 본 약관에 동의함으로써
          회원가입을 신청하며, 회사가 이를 승낙함으로써 이용계약이 성립합니다.
        </p>

        <h2>제6조 (결제 및 취소·환불)</h2>
        <ul>
          <li>
            모임 티켓 결제는 회사가 지정한 결제대행사를 통한 신용카드 결제 등으로
            이루어집니다.
          </li>
          <li>
            환불은 「전자상거래 등에서의 소비자보호에 관한 법률」 및 아래 회사의
            취소·환불 규정에 따릅니다.
          </li>
        </ul>
        <p style={{ marginTop: 8, marginBottom: 6, fontWeight: 700 }}>취소·환불 규정</p>
        <ul>
          {REFUND_POLICY.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
          <li>
            환불 금액은 결제수단으로 취소·환급되며, 결제대행사 정책에 따라 처리에
            영업일이 소요될 수 있습니다.
          </li>
        </ul>

        <h2>제7조 (회원의 의무)</h2>
        <p>
          회원은 타인의 정보를 도용하거나 서비스 운영을 방해하는 행위를 하여서는
          안 되며, 모임 참여 시 다른 참여자에게 피해를 주지 않아야 합니다.
        </p>

        <h2>제8조 (회사의 면책)</h2>
        <p>
          회사는 천재지변, 회원의 귀책사유로 인한 손해에 대하여 책임을 지지
          않습니다. 회사는 모임 운영과 관련하여 합리적인 주의의무를 다합니다.
        </p>

        <h2>제9조 (분쟁의 해결)</h2>
        <p>
          본 약관과 관련한 분쟁은 회사와 회원 간 협의로 해결하며, 협의가 이루어지지
          않을 경우 관련 법령 및 관할 법원의 판단에 따릅니다.
        </p>

        <h2>문의</h2>
        <p>
          {COMPANY.corporationName} · {COMPANY.phone} · {COMPANY.email}
        </p>
      </div>
      <SiteFooter />
    </div>
  );
}
