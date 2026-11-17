import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ReaderView } from '../src/features/reader/ReaderView';
import { getProgress, saveBook, setProgress } from '../src/services/storage/storageService';
import { getDb, STORE } from '../src/services/storage/db';
import { parseEpub } from '../src/services/epub/epubService';
import { asFile, buildEpub } from './fixtures/buildEpub';

/** 将真实 EPUB 写入书库，并可预设阅读进度 */
async function seedBook(progressIndex: number): Promise<void> {
  const parsed = await parseEpub(asFile(await buildEpub()));
  await saveBook(
    {
      id: 'book-1',
      title: parsed.title,
      author: parsed.author,
      sections: parsed.sections,
      createdAt: Date.now(),
    },
    parsed.fileBytes
  );
  setProgress('book-1', progressIndex);
}

/** 在指定路由下渲染阅读器 */
function renderReader() {
  return render(
    <MemoryRouter initialEntries={['/read/book-1']}>
      <Routes>
        <Route path="/read/:bookId" element={<ReaderView />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ReaderView', () => {
  beforeEach(async () => {
    const db = await getDb();
    await db.clear(STORE);
    localStorage.clear();
  });

  it('恢复上次阅读段并渲染对应正文', async () => {
    await seedBook(1);
    renderReader();

    expect(await screen.findByText('第二章正文内容。')).toBeInTheDocument();
    expect(screen.getByText('第 2 / 2 段')).toBeInTheDocument();
  });

  it('无记录时从第一段开始阅读', async () => {
    await seedBook(0);
    renderReader();

    expect(await screen.findByText('第一章正文内容。')).toBeInTheDocument();
    expect(screen.getByText('第 1 / 2 段')).toBeInTheDocument();
  });

  it('点击正文内相对链接跳转到目标段', async () => {
    await seedBook(0);
    renderReader();

    const link = await screen.findByRole('link', { name: '跳到第二章' });
    await userEvent.click(link);

    expect(await screen.findByText('第二章正文内容。')).toBeInTheDocument();
    expect(screen.getByText('第 2 / 2 段')).toBeInTheDocument();
  });

  it('点击下一页后切换段并写入进度', async () => {
    await seedBook(0);
    renderReader();

    expect(await screen.findByText('第一章正文内容。')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '下一页' }));

    // 动画结束后底栏段号更新，说明已提交新段
    expect(await screen.findByText('第 2 / 2 段', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText('第二章正文内容。')).toBeInTheDocument();
    expect(getProgress('book-1')?.sectionIndex).toBe(1);
  });

  it('可调整正文字号并持久化到 localStorage', async () => {
    await seedBook(0);
    renderReader();
    await screen.findByText('第一章正文内容。');

    const page = screen.getByTestId('reader-current-page');
    expect(page).toHaveStyle({ fontSize: '18px' });

    await userEvent.click(screen.getByRole('button', { name: '增大字号' }));
    expect(page).toHaveStyle({ fontSize: '20px' });
    expect(localStorage.getItem('bookview:font-size')).toBe('20');

    await userEvent.click(screen.getByRole('button', { name: '减小字号' }));
    expect(page).toHaveStyle({ fontSize: '18px' });
    expect(localStorage.getItem('bookview:font-size')).toBe('18');
  });

  it('可切换阅读背景并持久化到 localStorage', async () => {
    await seedBook(0);
    renderReader();
    await screen.findByText('第一章正文内容。');

    const readerPage = screen.getByTestId('reader-page');
    expect(readerPage).toHaveAttribute('data-reader-theme', 'paper');

    await userEvent.click(screen.getByRole('button', { name: '背景' }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: '米黄' }));

    expect(readerPage).toHaveAttribute('data-reader-theme', 'sepia');
    expect(localStorage.getItem('bookview:reader-theme')).toBe('sepia');
  });

  it('滚动长章节后保存章节内位置比例', async () => {
    await seedBook(0);
    renderReader();
    await screen.findByText('第一章正文内容。');

    const page = screen.getByTestId('reader-current-page');
    // jsdom 没有真实布局，手动模拟可滚动高度与当前位置
    Object.defineProperty(page, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(page, 'clientHeight', { value: 400, configurable: true });
    page.scrollTop = 300;
    fireEvent.scroll(page);

    await waitFor(() => expect(getProgress('book-1')?.scrollRatio).toBeCloseTo(0.5, 2));
  });

  it('重新打开书籍时恢复到章节内上次位置', async () => {
    await seedBook(0);
    setProgress('book-1', 0, 0.5);

    // 统一模拟可视高度，便于断言恢复后的 scrollTop
    const scrollHeight = vi
      .spyOn(Element.prototype, 'scrollHeight', 'get')
      .mockReturnValue(1000);
    const clientHeight = vi
      .spyOn(Element.prototype, 'clientHeight', 'get')
      .mockReturnValue(400);

    try {
      renderReader();
      await screen.findByText('第一章正文内容。');
      const page = screen.getByTestId('reader-current-page');
      await waitFor(() => expect(page.scrollTop).toBeCloseTo(300, 0));
    } finally {
      scrollHeight.mockRestore();
      clientHeight.mockRestore();
    }
  });
});
