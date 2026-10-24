import { Link, Route, Routes } from 'react-router-dom'
import { Home } from './routes/Home'
import { Tasks } from './routes/Tasks'

export function App() {
  return (
    <div>
      <nav className="flex gap-4 p-4">
        <Link to="/">Home</Link>
        <Link to="/tasks" className="ml-4">Tasks</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tasks" element={<Tasks />} />
      </Routes>
    </div>
  )
}
