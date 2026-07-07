import TopNav from "@/components/TopNav";
import SiteFooter from "@/components/SiteFooter";
import { COMPANY } from "@/data/company";

export const metadata = { title: "개인정보처리방침 — 모두의 모임" };

export default function PrivacyPage() {
  return (
    <div className="app-main">
      <TopNav title="개인정보처리방침" back />
      <div className="page-content legal-body">
        <p className="legal-updated">시행일자: 2026년 6월 23일</p>

        <p>
          {COMPANY.corporationName}(이하 &ldquo;회사&rdquo;)는 「개인정보 보호법」
          등 관련 법령을 준수하며, 이용자의 개인정보를 보호하기 위해 다음과 같이
          개인정보처리방침을 수립·공개합니다.
        </p>

        <h2>1. 수집하는 개인정보 항목</h2>
        <ul>
          <li>회원가입: 이름, 휴대폰 번호, 이메일, 비밀번호</li>
          <li>모임 결제: 주문 정보, 결제 정보(결제대행사를 통해 처리)</li>
          <li>자동 수집: 접속 로그, 기기 정보, 쿠키</li>
        </ul>

        <h2>2. 개인정보의 수집·이용 목적</h2>
        <ul>
          <li>회원 식별 및 관리, 서비스 제공</li>
          <li>모임 신청·결제 처리 및 정산</li>
          <li>고객 문의 응대 및 공지·알림 발송</li>
        </ul>

        <h2>3. 개인정보의 보유 및 이용기간</h2>
        <p>
          회원 탈퇴 시 지체 없이 파기합니다. 다만 관련 법령에 따라 보존이 필요한
          경우 해당 기간 동안 보관합니다.
        </p>
        <table>
          <tbody>
            <tr>
              <th>계약·청약철회 기록</th>
              <td>5년 (전자상거래법)</td>
            </tr>
            <tr>
              <th>대금결제·재화공급 기록</th>
              <td>5년 (전자상거래법)</td>
            </tr>
            <tr>
              <th>소비자 불만·분쟁처리 기록</th>
              <td>3년 (전자상거래법)</td>
            </tr>
          </tbody>
        </table>

        <h2>4. 개인정보의 제3자 제공 및 처리위탁</h2>
        <p>
          회사는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않으며, 서비스
          제공을 위해 아래와 같이 처리를 위탁합니다.
        </p>
        <table>
          <tbody>
            <tr>
              <th>Supabase</th>
              <td>회원 인증 및 데이터 보관(클라우드 인프라)</td>
            </tr>
            <tr>
              <th>NHN KCP</th>
              <td>신용카드 등 결제 처리 및 결제 도용 방지</td>
            </tr>
          </tbody>
        </table>

        <h2>5. 정보주체의 권리</h2>
        <p>
          이용자는 언제든지 자신의 개인정보를 조회·수정·삭제하거나 처리정지를
          요구할 수 있으며, 회사는 관련 법령에 따라 지체 없이 조치합니다.
        </p>

        <h2>6. 개인정보의 안전성 확보조치</h2>
        <p>
          회사는 개인정보 암호화, 접근권한 관리, 접속기록 보관 등 관리적·기술적
          보호조치를 시행합니다.
        </p>

        <h2>7. 개인정보보호책임자</h2>
        <ul>
          <li>책임자: {COMPANY.privacyOfficerName}</li>
          <li>연락처: {COMPANY.phone}</li>
          <li>이메일: {COMPANY.privacyOfficerEmail}</li>
        </ul>

        <h2>8. 개인정보처리방침의 변경</h2>
        <p>
          본 방침은 법령·서비스 변경에 따라 개정될 수 있으며, 변경 시 서비스
          화면을 통해 공지합니다.
        </p>
      </div>
      <SiteFooter />
    </div>
  );
}
