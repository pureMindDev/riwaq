import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import RequireAuth from './components/RequireAuth.jsx'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Welcome from './pages/Welcome.jsx'
import Tahfidh from './pages/Tahfidh.jsx'
import Murajaah from './pages/Murajaah.jsx'
import Milestone from './pages/Milestone.jsx'
import { Lesson, FoundationHub } from './pages/Foundation.jsx'
import Listen from './pages/Listen.jsx'
import Recite from './pages/Recite.jsx'
import Settings from './pages/Settings.jsx'
import NotFound from './pages/NotFound.jsx'
import { AuthProvider } from './context/Auth.jsx'
import { ChaptersProvider } from './context/Chapters.jsx'

const guard = (el) => <RequireAuth>{el}</RequireAuth>

export default function App() {
  return (
    <AuthProvider>
      <ChaptersProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="welcome" element={<RequireAuth allowUnassessed><Welcome /></RequireAuth>} />
            <Route path="foundation" element={guard(<FoundationHub />)} />
            <Route path="foundation/:id" element={guard(<Lesson />)} />
            <Route path="tahfidh" element={guard(<Tahfidh />)} />
            <Route path="tahfidh/:id" element={guard(<Tahfidh />)} />
            <Route path="murajaah" element={guard(<Murajaah />)} />
            <Route path="murajaah/revise/:id" element={guard(<Murajaah />)} />
            <Route path="milestones/:id" element={guard(<Milestone />)} />
            <Route path="listen" element={<Listen />} />
            <Route path="listen/:surah" element={<Listen />} />
            <Route path="recite" element={<Recite />} />
            <Route path="settings" element={guard(<Settings />)} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </ChaptersProvider>
    </AuthProvider>
  )
}
