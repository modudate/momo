"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2, Ban } from "lucide-react";

type Entry = {
  id: string;
  name: string | null;
  phone: string;
  memo: string | null;
  created_at: string;
};

export default function BlacklistPanel({ flash }: { flash: (m: string) => void }) {
  const [list, setList] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/blacklist");
    if (res.ok) setList((await res.json()).blacklist);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (id: string) => {
    if (!window.confirm("블랙리스트에서 해제할까요?")) return;
    const res = await fetch(`/api/admin/blacklist?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) {
      flash("해제했어요.");
      load();
    }
  };

  return (
    <div className="admin-card">
      <div className="admin-card-head">
        <span className="admin-card-title">
          <Ban size={15} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
          블랙리스트 ({list.length})
        </span>
      </div>
      <div className="sales-count">
        등록은 <b>회원 목록</b>에서 회원의 <b>「블랙 등록」</b> 버튼으로 하세요. 등록된 번호는 예약 명단·판매내역에서
        자동 <b>블랙</b> 표시됩니다. (신청 자체를 막지는 않아요)
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>이름</th>
              <th>전화번호</th>
              <th>메모</th>
              <th>등록일</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5}><div className="admin-empty">불러오는 중…</div></td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={5}><div className="admin-empty">등록된 블랙리스트가 없어요.</div></td></tr>
            ) : (
              list.map((e) => (
                <tr key={e.id}>
                  <td className="font-semibold text-[var(--text-primary)]">{e.name ?? "-"}</td>
                  <td>{e.phone}</td>
                  <td>{e.memo ?? "-"}</td>
                  <td>{e.created_at.slice(0, 10)}</td>
                  <td>
                    <div className="flex justify-end">
                      <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => remove(e.id)}>
                        <Trash2 size={14} /> 해제
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
