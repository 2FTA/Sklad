import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UserPage from './pages/UserPage';
import UsersManagement from './pages/UsersManagement';
import ProductsManagement from './pages/ProductsManagement';
import ReportsPage from './pages/ReportsPage';
import MovementPage from './pages/MovementPage';
import ExpiredPage from './pages/ExpiredPage';
import AdminHouseholdPage from './pages/AdminHouseholdPage';
import ErrorsPage from './pages/ErrorsPage';
import AdminRoute from './components/AdminRoute';
import GlobalErrorHandlers from './components/GlobalErrorHandlers';
import { ToastProvider } from './components/ToastContext';
import { ExpiredProvider } from './components/ExpiredContext';
import { getStoredUser } from './api';

function PrivateRoute({ children }) {
  const user = getStoredUser();
  return user ? children : <Navigate to="/login" replace />;
}

function Home() {
  const user = getStoredUser();
  if (user?.role === 'admin') {
    return <Dashboard />;
  }
  return <Navigate to="/user" replace />;
}

function UserRoute({ children }) {
  const user = getStoredUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
}

function App() {
  return (
    <ToastProvider>
      <ExpiredProvider>
        <GlobalErrorHandlers />
        <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Home />
          </PrivateRoute>
        }
      />
      <Route
        path="/user"
        element={
          <PrivateRoute>
            <UserRoute>
              <UserPage />
            </UserRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <AdminRoute>
            <UsersManagement />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/products"
        element={
          <AdminRoute>
            <ProductsManagement />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/household"
        element={
          <AdminRoute>
            <AdminHouseholdPage />
          </AdminRoute>
        }
      />
      <Route
        path="/expired"
        element={
          <AdminRoute>
            <ExpiredPage />
          </AdminRoute>
        }
      />
      <Route
        path="/movement"
        element={
          <AdminRoute>
            <MovementPage />
          </AdminRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <AdminRoute>
            <ReportsPage />
          </AdminRoute>
        }
      />
      <Route
        path="/errors"
        element={
          <AdminRoute>
            <ErrorsPage />
          </AdminRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </ExpiredProvider>
    </ToastProvider>
  );
}

export default App;
