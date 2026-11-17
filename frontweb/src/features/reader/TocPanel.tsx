import type { SpineSection } from '../../types/book';
import styles from './ReaderView.module.css';

interface TocPanelProps {
  sections: SpineSection[];
  currentIndex: number;
  onJump: (index: number) => void;
  onClose: () => void;
}

/** 目录侧栏：点击章节直接跳转到对应 spine 段（FR-R03 / S5） */
export function TocPanel({ sections, currentIndex, onJump, onClose }: TocPanelProps) {
  return (
    <div className={styles.tocOverlay} role="dialog" aria-label="目录" onClick={onClose}>
      <aside className={styles.tocPanel} onClick={(event) => event.stopPropagation()}>
        <header className={styles.tocHeader}>
          <h2 className={styles.tocTitle}>目录</h2>
          <button type="button" className={styles.tocClose} aria-label="关闭目录" onClick={onClose}>
            关闭
          </button>
        </header>
        <ol className={styles.tocList}>
          {sections.map((section) => (
            <li key={section.index}>
              <button
                type="button"
                className={
                  section.index === currentIndex ? styles.tocItemActive : styles.tocItem
                }
                aria-current={section.index === currentIndex ? 'true' : undefined}
                onClick={() => onJump(section.index)}
              >
                <span className={styles.tocIndex}>{section.index + 1}</span>
                <span className={styles.tocLabel}>{section.title}</span>
              </button>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
