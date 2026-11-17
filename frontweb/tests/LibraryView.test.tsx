import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LibraryView } from '../src/features/library/LibraryView';
import { getDb, STORE } from '../src/services/storage/db';
import { listBooks, saveBook } from '../src/services/storage/storageService';

/** 写入一条最小书籍记录 */
async function seedBook(id: string, title: string): Promise<void> {
  await saveBook({ id, title, sections: [], createdAt: Date.now() }, new ArrayBuffer(1));
}

describe('LibraryView', () => {
  beforeEach(async () => {
    const db = await getDb();
    await db.clear(STORE);
    localStorage.clear();
  });

  it('空书库展示引导文案与导入按钮', async () => {
    render(
      <MemoryRouter>
        <LibraryView />
      </MemoryRouter>
    );

    const emptyTitle = await screen.findByText('书库还是空的');
    const emptySection = emptyTitle.closest('section') as HTMLElement;
    expect(emptySection).not.toBeNull();
    expect(within(emptySection).getByRole('button', { name: '导入书籍' })).toBeInTheDocument();
  });

  it('清除示例只删除示例书籍，保留用户导入的书', async () => {
    await seedBook('sample:sample-001.epub', '示例书籍');
    await seedBook('user-book', '我的书籍');

    render(
      <MemoryRouter>
        <LibraryView />
      </MemoryRouter>
    );

    expect(await screen.findByText('示例书籍')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /清除示例/ }));

    await waitFor(() => expect(screen.queryByText('示例书籍')).not.toBeInTheDocument());
    expect(screen.getByText('我的书籍')).toBeInTheDocument();
    expect((await listBooks()).map((book) => book.id)).toEqual(['user-book']);
  });
});
