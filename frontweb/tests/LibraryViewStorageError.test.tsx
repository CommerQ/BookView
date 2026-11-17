import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// 模拟 IndexedDB 不可用：书库读取直接失败
vi.mock('../src/services/storage/storageService', () => ({
  listBooks: vi.fn().mockRejectedValue(new Error('idb unavailable')),
  saveBook: vi.fn(),
  deleteBook: vi.fn(),
}));

import { LibraryView } from '../src/features/library/LibraryView';

describe('LibraryView 存储不可用', () => {
  it('展示错误提示并禁用所有导入入口', async () => {
    render(
      <MemoryRouter>
        <LibraryView />
      </MemoryRouter>
    );

    expect(await screen.findByText(/书库读取失败/)).toBeInTheDocument();

    // 顶栏与空状态各有一个导入按钮，均应禁用
    const importButtons = screen.getAllByRole('button', { name: '导入书籍' });
    expect(importButtons.length).toBeGreaterThan(0);
    for (const button of importButtons) {
      expect(button).toBeDisabled();
    }
  });
});
