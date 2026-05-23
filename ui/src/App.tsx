import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Workspace from './components/layout/Workspace';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<Workspace />} />
      </Routes>
    </BrowserRouter>
  );
}
