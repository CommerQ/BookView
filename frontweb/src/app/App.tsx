import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AnimatedOutlet } from './AnimatedOutlet';
import { LibraryView } from '../features/library/LibraryView';
import { ReaderView } from '../features/reader/ReaderView';

/** 应用根路由：书库与阅读器，统一包在 AnimatedOutlet 内实现路由淡入 */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AnimatedOutlet />}>
          <Route index element={<LibraryView />} />
          <Route path="read/:bookId" element={<ReaderView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
