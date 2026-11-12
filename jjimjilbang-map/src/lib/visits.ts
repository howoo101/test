// 내 방문 기록: 별점·방문일·메모. 이 기기의 브라우저에만 저장돼요(다른 사람에게 보이지 않아요).

export interface Visit {
  id: string;
  /** 방문일 YYYY-MM-DD */
  date: string;
  /** 1~5 */
  rating: number;
  text: string;
  updatedAt: string;
}

export type VisitMap = Record<string, Visit[]>;

export const VISIT_KEY = 'jjim:visits';
export const MEMO_MAX = 500;

/** 오늘 날짜 (한국 시간) YYYY-MM-DD */
export function todayKst() {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

export const newVisitId = () => `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** 저장된 값을 읽어요. 형식이 이상한 항목은 버려요. */
export function parseVisits(raw: string | null): VisitMap {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw) as unknown;
    if (!obj || typeof obj !== 'object') return {};
    const out: VisitMap = {};
    for (const [placeId, list] of Object.entries(obj as Record<string, unknown>)) {
      if (!Array.isArray(list)) continue;
      const ok = list.filter((v): v is Visit =>
        !!v && typeof v === 'object' &&
        typeof (v as Visit).id === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test((v as Visit).date) &&
        Number.isInteger((v as Visit).rating) && (v as Visit).rating >= 1 && (v as Visit).rating <= 5 &&
        typeof (v as Visit).text === 'string');
      if (ok.length) out[placeId] = sortVisits(ok);
    }
    return out;
  } catch {
    return {};
  }
}

/** 최근 방문이 위로 */
export const sortVisits = (list: Visit[]) => [...list].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));

/** 내 평균 별점 (소수 첫째 자리) */
export function myRating(list: Visit[] | undefined): number | null {
  if (!list?.length) return null;
  return Math.round((list.reduce((s, v) => s + v.rating, 0) / list.length) * 10) / 10;
}

/** "2026년 11월 12일" */
export function fmtVisitDate(d: string) {
  const [y, m, day] = d.split('-').map(Number);
  return `${y}년 ${m}월 ${day}일`;
}
