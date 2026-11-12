// 토스 UI/UX 디자인 가이드의 화면 패턴(큰 제목, 넉넉한 여백, 목록 줄, 칩, 하단 고정 버튼, 바텀시트, 토스트)을
// 따라 직접 만든 작은 컴포넌트 모음이에요. 외부 디자인 시스템 패키지 없이 어느 웹에서나 동작해요.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import './ui.css';

export { colors } from './colors';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export type Typography = 't1' | 't2' | 't3' | 't4' | 't5' | 't6' | 't7';
export type FontWeight = 'regular' | 'medium' | 'semibold' | 'bold';

// ---------------------------------------------------------------- 아이콘
const svgProps = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false } as const;
const Chevron = ({ className }: { className?: string }) => (
  <svg {...svgProps} className={cx('ui-chevron', className)} width="16" height="16" strokeWidth={2.2}><path d="M9 5.5l6.5 6.5L9 18.5" /></svg>
);
const SearchIcon = () => (
  <svg {...svgProps} className="ui-search-ico" width="20" height="20" strokeWidth={2.2}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>
);
const ClearIcon = () => (
  <svg {...svgProps} width="18" height="18" strokeWidth={0}><circle cx="12" cy="12" r="9" fill="currentColor" /><path d="M9 9l6 6M15 9l-6 6" stroke="#fff" strokeWidth={2} /></svg>
);
const CheckIcon = () => (
  <svg {...svgProps} width="20" height="20" strokeWidth={2.4}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);

// ---------------------------------------------------------------- 글자
interface TextProps {
  typography?: Typography;
  fontWeight?: FontWeight;
  color?: string;
  className?: string;
  children?: ReactNode;
}
function Text({ typography = 't6', fontWeight, color, className, children, as = 'span' }: TextProps & { as?: 'span' | 'p' }) {
  const Tag = as;
  return (
    <Tag className={cx('ui-text', `ui-${typography}`, fontWeight && `ui-w-${fontWeight}`, className)} style={color ? { color } : undefined}>
      {children}
    </Tag>
  );
}
export const Paragraph = { Text: (p: TextProps) => <Text as="p" {...p} /> };

// ---------------------------------------------------------------- 화면 제목
export function Top({ upper, subtitleTop, title, subtitleBottom }: { upper?: ReactNode; subtitleTop?: ReactNode; title: ReactNode; subtitleBottom?: ReactNode }) {
  return (
    <div className="ui-top">
      {upper}
      <div className="ui-top-body ui-gutter">
        {subtitleTop}
        {title}
        {subtitleBottom}
      </div>
    </div>
  );
}
Top.TitleParagraph = function TopTitle({ size = 22, children }: { size?: number; children: ReactNode }) {
  return <h1 className="ui-top-title" style={{ fontSize: size }}>{children}</h1>;
};
Top.SubtitleParagraph = function TopSubtitle({ size = 15, children }: { size?: number; children: ReactNode }) {
  return <p className="ui-top-sub" style={{ fontSize: size }}>{children}</p>;
};

// ---------------------------------------------------------------- 목록
export function List({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cx('ui-list', className)}>{children}</ul>;
}

interface ListRowProps {
  left?: ReactNode;
  contents: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  withTouchEffect?: boolean;
  arrowType?: 'right';
  verticalPadding?: 'small' | 'medium' | 'large';
  border?: 'none';
  className?: string;
}
export function ListRow({ left, contents, right, onClick, withTouchEffect, arrowType, verticalPadding = 'medium', className }: ListRowProps) {
  const body = (
    <>
      {left && <span className="ui-row-left">{left}</span>}
      <span className="ui-row-contents">{contents}</span>
      {right && <span className="ui-row-right">{right}</span>}
      {arrowType === 'right' && <Chevron className="ui-row-arrow" />}
    </>
  );
  return (
    <li className={cx('ui-row', `ui-row-${verticalPadding}`, className)}>
      {onClick ? (
        <button type="button" className={cx('ui-row-body', withTouchEffect && 'ui-touch')} onClick={onClick}>{body}</button>
      ) : (
        <div className="ui-row-body">{body}</div>
      )}
    </li>
  );
}
ListRow.Texts = function RowTexts({ type, top, middle, bottom }: { type: '1RowTypeA' | '2RowTypeA' | '3RowTypeA'; top: ReactNode; middle?: ReactNode; bottom?: ReactNode }) {
  return (
    <span className={cx('ui-texts', `ui-texts-${type}`)}>
      <span className="ui-texts-top">{top}</span>
      {type === '3RowTypeA' && middle != null && <span className="ui-texts-mid">{middle}</span>}
      {type !== '1RowTypeA' && bottom != null && <span className="ui-texts-bot">{bottom}</span>}
    </span>
  );
};
ListRow.Text = (p: TextProps) => <Text {...p} />;

export function ListHeader({ title, description, descriptionPosition = 'top', right }: { title: ReactNode; description?: ReactNode; descriptionPosition?: 'top' | 'bottom'; right?: ReactNode }) {
  return (
    <div className="ui-lh ui-gutter">
      <div className="ui-lh-main">
        {description && descriptionPosition === 'top' && description}
        {title}
        {description && descriptionPosition === 'bottom' && description}
      </div>
      {right && <div className="ui-lh-right">{right}</div>}
    </div>
  );
}
ListHeader.TitleParagraph = function ListHeaderTitle({ fontWeight = 'bold', children }: { fontWeight?: FontWeight; children: ReactNode }) {
  return <h2 className={cx('ui-lh-title', `ui-w-${fontWeight}`)}>{children}</h2>;
};
ListHeader.DescriptionParagraph = function ListHeaderDescription({ children }: { children: ReactNode }) {
  return <p className="ui-lh-desc">{children}</p>;
};
ListHeader.RightArrow = function ListHeaderRightArrow({ children }: { children: ReactNode }) {
  return <span className="ui-lh-arrow">{children}<Chevron /></span>;
};

export function TableRow({ align = 'space-between', left, right, leftRatio, rightFontWeight }: { align?: 'space-between' | 'left'; left: ReactNode; right: ReactNode; leftRatio?: number; rightFontWeight?: FontWeight }) {
  return (
    <li className={cx('ui-trow ui-gutter', `ui-trow-align-${align}`)}>
      <span className="ui-trow-left" style={leftRatio ? { flex: `0 0 ${leftRatio}%` } : undefined}>{left}</span>
      <span className={cx('ui-trow-right', rightFontWeight && `ui-w-${rightFontWeight}`)}>{right}</span>
    </li>
  );
}

// ---------------------------------------------------------------- 입력·선택
export function SearchField({ onDeleteClick, value, className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { onDeleteClick?: () => void }) {
  return (
    <div className={cx('ui-search ui-gutter', className)}>
      <label className="ui-search-box">
        <SearchIcon />
        <input type="search" enterKeyHint="search" value={value} {...rest} />
        {value ? (
          <button type="button" className="ui-search-clear" onClick={onDeleteClick} aria-label="검색어 지우기"><ClearIcon /></button>
        ) : null}
      </label>
    </div>
  );
}

export function Chip({ children }: { children: ReactNode; kind?: string; size?: string }) {
  return <div className="ui-chips" role="group" aria-label="필터">{children}</div>;
}
export function ChipItem({ selected, onClick, children }: { selected?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button type="button" className={cx('ui-chip', selected && 'is-selected')} aria-pressed={!!selected} onClick={onClick}>
      {children}
    </button>
  );
}

const SegContext = createContext<{ value: string; onChange: (v: string) => void } | null>(null);
export function SegmentedControl({ name, value, onChange, children }: { name: string; value: string; onChange: (v: string) => void; size?: string; children: ReactNode }) {
  const ctx = useMemo(() => ({ value, onChange }), [value, onChange]);
  return (
    <div className="ui-seg" role="radiogroup" aria-label={name}>
      <SegContext.Provider value={ctx}>{children}</SegContext.Provider>
    </div>
  );
}
SegmentedControl.Item = function SegmentedItem({ value, children }: { value: string; children: ReactNode }) {
  const ctx = useContext(SegContext);
  const on = ctx?.value === value;
  return (
    <button type="button" role="radio" aria-checked={on} className={cx('ui-seg-item', on && 'is-on')} onClick={() => ctx?.onChange(value)}>
      {children}
    </button>
  );
};

// ---------------------------------------------------------------- 배지·버튼
export function Badge({ size = 'small', variant = 'weak', color = 'blue', children }: { size?: 'xsmall' | 'small' | 'medium'; variant?: 'fill' | 'weak'; color?: 'blue' | 'teal' | 'green' | 'red' | 'yellow' | 'elephant'; children: ReactNode }) {
  return <span className={cx('ui-badge', `ui-badge-${size}`, `ui-badge-${variant}`, `ui-badge-${color}`)}>{children}</span>;
}

export function Button({ size = 'medium', variant = 'fill', color = 'primary', className, children, ...rest }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> & { size?: 'small' | 'medium' | 'large'; variant?: 'fill' | 'weak'; color?: 'primary' | 'dark' }) {
  return (
    <button type="button" className={cx('ui-btn', `ui-btn-${size}`, `ui-btn-${variant}-${color}`, className)} {...rest}>
      {children}
    </button>
  );
}

export function TextButton({ size = 'small', variant = 'clear', color, onClick, children }: { size?: 'xsmall' | 'small' | 'medium'; variant?: 'clear' | 'underline' | 'arrow'; color?: string; onClick?: () => void; children: ReactNode }) {
  return (
    <button type="button" className={cx('ui-tbtn', `ui-tbtn-${size}`, `ui-tbtn-${variant}`)} style={color ? { color } : undefined} onClick={onClick}>
      {children}
      {variant === 'arrow' && <Chevron />}
    </button>
  );
}

/** 화면 아래에 붙어 있는 큰 버튼. 위에 짧은 안내(topAccessory)를 둘 수 있어요. */
export function FixedBottomCTA({ onClick, topAccessory, children }: { onClick: () => void; topAccessory?: ReactNode; children: ReactNode }) {
  return (
    <div className="ui-cta">
      {topAccessory}
      <button type="button" className="ui-cta-btn" onClick={onClick}>{children}</button>
    </div>
  );
}

// ---------------------------------------------------------------- 바텀시트
export function BottomSheet({ open, onClose, header, children }: { open: boolean; onClose: () => void; header?: ReactNode; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="ui-sheet-backdrop" onClick={onClose}>
      <div className="ui-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <span className="ui-sheet-grabber" aria-hidden="true" />
        {header}
        {children}
      </div>
    </div>
  );
}
BottomSheet.Header = function BottomSheetHeader({ children }: { children: ReactNode }) {
  return <h2 className="ui-sheet-title">{children}</h2>;
};
BottomSheet.Select = function BottomSheetSelect({ options, value, onChange }: { options: { name: string; value: string }[]; value: string; onChange: (e: { target: { value: string } }) => void }) {
  return (
    <ul className="ui-sheet-options" role="listbox">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <li key={o.value}>
            <button type="button" role="option" aria-selected={on} autoFocus={on} className={cx('ui-sheet-option', on && 'is-on')} onClick={() => onChange({ target: { value: o.value } })}>
              {o.name}
              {on && <CheckIcon />}
            </button>
          </li>
        );
      })}
    </ul>
  );
};

// ---------------------------------------------------------------- 여백·구분선
export function Border({ variant = 'height16' }: { variant?: 'height16' }) {
  return <div className={cx('ui-border', variant === 'height16' && 'ui-border-16')} role="presentation" />;
}
export function Spacing({ size }: { size: number }) {
  return <div style={{ height: size }} aria-hidden="true" />;
}

// ---------------------------------------------------------------- 토스트
const ToastContext = createContext<{ openToast: (message: string) => void }>({ openToast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const openToast = useCallback((message: string) => setToast({ id: Date.now(), message }), []);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(t);
  }, [toast]);
  const value = useMemo(() => ({ openToast }), [openToast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="ui-toast-area" role="status" aria-live="polite">
        {toast && <div key={toast.id} className="ui-toast">{toast.message}</div>}
      </div>
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);
