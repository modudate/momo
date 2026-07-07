import { useRef } from "react";

// 모달 배경 클릭으로 닫기 — 단, "누른 지점"과 "뗀 지점"이 모두 배경일 때만.
// (모달 안에서 드래그 시작 후 밖에서 손을 떼는 경우엔 닫히지 않음)
export function useBackdropClose(onClose: () => void) {
  const pressedOnBackdrop = useRef(false);
  return {
    onMouseDown: (e: React.MouseEvent) => {
      pressedOnBackdrop.current = e.target === e.currentTarget;
    },
    onClick: (e: React.MouseEvent) => {
      if (pressedOnBackdrop.current && e.target === e.currentTarget) {
        onClose();
      }
    },
  };
}
