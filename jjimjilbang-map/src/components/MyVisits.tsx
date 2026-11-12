// 상세 화면의 "내 기록": 별점·방문일·메모를 남기고 고쳐요. 이 기기에만 저장돼요.
import { useState } from 'react';
import { BottomSheet, Button, ListHeader, TextButton, colors } from '../ui';
import { useApp } from '../AppContext';
import { MEMO_MAX, fmtVisitDate, myRating, todayKst, type Visit } from '../lib/visits';
import type { Place } from '../lib/data';

const RATING_WORDS = ['', '별로예요', '아쉬워요', '보통이에요', '좋아요', '최고예요'];

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="stars" style={{ fontSize: size }} aria-label={`별점 ${value}점`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= Math.round(value) ? 'star is-on' : 'star'} aria-hidden="true">★</span>
      ))}
    </span>
  );
}

type Draft = { id?: string; date: string; rating: number; text: string };

export function MyVisits({ place }: { place: Place }) {
  const { visits, saveVisit, removeVisit } = useApp();
  const list = visits[place.id] ?? [];
  const avg = myRating(list);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const openNew = () => { setConfirmDelete(false); setDraft({ date: todayKst(), rating: 0, text: '' }); };
  const openEdit = (v: Visit) => { setConfirmDelete(false); setDraft({ id: v.id, date: v.date, rating: v.rating, text: v.text }); };
  const close = () => setDraft(null);
  const save = () => {
    if (!draft || !draft.rating) return;
    saveVisit(place.id, { id: draft.id, date: draft.date || todayKst(), rating: draft.rating, text: draft.text.slice(0, MEMO_MAX) });
    close();
  };

  return (
    <section className="my-visits" aria-label="내 기록">
      <ListHeader
        title={<ListHeader.TitleParagraph fontWeight="bold">내 기록</ListHeader.TitleParagraph>}
        description={
          <ListHeader.DescriptionParagraph>
            {list.length ? `${list.length}번 다녀왔어요 · 내 평균 ★ ${avg}` : '이 기기에만 저장되고 다른 사람에게는 보이지 않아요'}
          </ListHeader.DescriptionParagraph>
        }
        descriptionPosition="bottom"
        right={list.length ? <TextButton size="small" color={colors.blue500} onClick={openNew}>기록 추가</TextButton> : undefined}
      />
      {list.length ? (
        <ul className="visit-list">
          {list.map((v) => (
            <li key={v.id}>
              <button type="button" className="visit-item" onClick={() => openEdit(v)} aria-label={`${fmtVisitDate(v.date)} 기록 고치기`}>
                <span className="visit-top">
                  <Stars value={v.rating} size={15} />
                  <span className="visit-date">{fmtVisitDate(v.date)}</span>
                </span>
                {v.text ? <span className="visit-text">{v.text}</span> : <span className="visit-text is-empty">메모 없음</span>}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="pad visit-empty">
          <Button size="medium" variant="weak" onClick={openNew}>다녀왔다면 기록 남기기</Button>
        </div>
      )}

      <BottomSheet open={!!draft} onClose={close} header={<BottomSheet.Header>{draft?.id ? '기록 고치기' : '기록 남기기'}</BottomSheet.Header>}>
        {draft && (
          <form className="pad visit-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <p className="visit-place">{place.name}</p>
            <fieldset className="star-pick">
              <legend className="sr-only">별점</legend>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={n <= draft.rating ? 'star-btn is-on' : 'star-btn'}
                  aria-label={`${n}점`}
                  aria-pressed={n === draft.rating}
                  onClick={() => setDraft({ ...draft, rating: n })}
                >★</button>
              ))}
              <span className="star-word" aria-live="polite">{draft.rating ? RATING_WORDS[draft.rating] : '별점을 골라 주세요'}</span>
            </fieldset>
            <label className="visit-field">
              <span>방문일</span>
              <input type="date" value={draft.date} max={todayKst()} onChange={(e) => setDraft({ ...draft, date: e.target.value })} required />
            </label>
            <label className="visit-field">
              <span>메모</span>
              <textarea
                rows={4}
                maxLength={MEMO_MAX}
                placeholder="탕 온도, 붐비는 시간, 같이 간 사람, 맛있던 메뉴처럼 기억하고 싶은 걸 적어요"
                value={draft.text}
                onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              />
              <span className="visit-count">{`${draft.text.length}/${MEMO_MAX}`}</span>
            </label>
            <Button type="submit" size="large" disabled={!draft.rating}>저장</Button>
            {draft.id && (
              confirmDelete ? (
                <div className="visit-delete">
                  <span>이 기록을 지울까요?</span>
                  <TextButton size="small" color={colors.grey600} onClick={() => setConfirmDelete(false)}>취소</TextButton>
                  <TextButton size="small" color={colors.red500} onClick={() => { removeVisit(place.id, draft.id!); close(); }}>지우기</TextButton>
                </div>
              ) : (
                <div className="visit-delete">
                  <TextButton size="small" color={colors.grey600} onClick={() => setConfirmDelete(true)}>기록 지우기</TextButton>
                </div>
              )
            )}
          </form>
        )}
      </BottomSheet>
    </section>
  );
}
