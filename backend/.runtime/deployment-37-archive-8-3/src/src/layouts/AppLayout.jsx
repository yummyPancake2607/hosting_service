import { Outlet } from 'react-router-dom'
import NavBar from '../components/NavBar'

function AppLayout() {
  return (
    <div className="app-shell">
      <NavBar />
      <main className="page-shell">
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout
