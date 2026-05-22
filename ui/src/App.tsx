import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<div>Login Page (TODO)</div>} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <div>Workspace (TODO)</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
