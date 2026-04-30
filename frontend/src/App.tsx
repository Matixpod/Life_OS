import { BrowserRouter, Route, Routes } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import Body from './pages/Body';
import Cognitive from './pages/Cognitive';
import Dashboard from './pages/Dashboard';
import DeepWork from './pages/DeepWork';
import Goals from './pages/Goals';
import Intelligence from './pages/Intelligence';
import Kronos from './pages/Kronos';
import Learning from './pages/Learning';
import MentalHealth from './pages/MentalHealth';
import Nutrition from './pages/Nutrition';
import Profile from './pages/Profile';
import Review from './pages/Review';
import Sleep from './pages/Sleep';
import Supplements from './pages/Supplements';
import Tasks from './pages/Tasks';
import Workout from './pages/Workout';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/tasks/week" element={<Tasks />} />
          <Route path="/tasks/backlog" element={<Tasks />} />
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
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
