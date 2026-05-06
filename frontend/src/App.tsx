import { BrowserRouter, Route, Routes } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import AISettingsPage from './pages/AISettingsPage';
import Ares from './pages/Ares';
import Body from './pages/Body';
import CalendarPage from './pages/Calendar';
import Cognitive from './pages/Cognitive';
import Dashboard from './pages/Dashboard';
import DeepWork from './pages/DeepWork';
import HabitsPage from './pages/Habits';
import Intelligence from './pages/Intelligence';
import Kronos from './pages/Kronos';
import Learning from './pages/Learning';
import MentalHealth from './pages/MentalHealth';
import Nutrition from './pages/Nutrition';
import Profile from './pages/Profile';
import ProjectDetailPage from './pages/ProjectDetail';
import ProjectsPage from './pages/Projects';
import Review from './pages/Review';
import Sleep from './pages/Sleep';
import Supplements from './pages/Supplements';
import Workout from './pages/Workout';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/habits" element={<HabitsPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/sleep" element={<Sleep />} />
          <Route path="/supplements" element={<Supplements />} />
          <Route path="/workout" element={<Workout />} />
          <Route path="/cognitive" element={<Cognitive />} />
          <Route path="/mental-health" element={<MentalHealth />} />
          <Route path="/body" element={<Body />} />
          <Route path="/nutrition" element={<Nutrition />} />
          <Route path="/deep-work" element={<DeepWork />} />
          <Route path="/learning" element={<Learning />} />
          <Route path="/intelligence" element={<Intelligence />} />
          <Route path="/review" element={<Review />} />
          <Route path="/kronos" element={<Kronos />} />
          <Route path="/ares" element={<Ares />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings/ai" element={<AISettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
