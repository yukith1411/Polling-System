import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import DashboardPage from "./pages/DashboardPage";
import ClassPage from "./pages/ClassPage";
import CreatePollPage from "./pages/CreatePollPage";
import PollDetailPage from "./pages/PollDetailPage";
import StudentVotePage from "./pages/StudentVotePage";
import AdminRoute from "./components/AdminRoute";
import AdminPage from "./pages/AdminPage";
import ManageClassesPage from "./pages/ManageClassesPage";
import ManageStudentsPage from "./pages/ManageStudentsPage";
import PollHistoryPage from "./pages/PollHistoryPage";
import SettingsPage from "./pages/SettingsPage";
import DownloadHistoryPage from "./pages/DownloadHistoryPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/vote/:shareToken" element={<StudentVotePage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/classes" element={<ManageClassesPage />} />
            <Route path="/students" element={<ManageStudentsPage />} />
            <Route path="/poll-history" element={<PollHistoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/download-history" element={<DownloadHistoryPage />} />
            <Route path="/classes/:classId" element={<ClassPage />} />
            <Route path="/polls/new" element={<CreatePollPage />} />
            <Route path="/polls/:pollId" element={<PollDetailPage />} />
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<AdminPage />} />
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
