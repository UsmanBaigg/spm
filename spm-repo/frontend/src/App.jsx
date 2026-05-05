import { BrowserRouter, NavLink } from 'react-router-dom'
import AppRouter from './routes/AppRouter'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-dvh">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-indigo-50 via-slate-50 to-white" />

        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/70 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm">
                <span className="text-sm font-semibold">TR</span>
              </div>
              <div className="leading-tight">
                <div className="text-base font-semibold text-slate-900">Trust & Rating</div>
                <div className="text-xs text-slate-500">Bring • Frontend demo</div>
              </div>
            </div>

            <nav className="flex items-center gap-1">
              {[
                { to: '/users/1', label: 'User' },
                { to: '/services/1', label: 'Service' },
                { to: '/marketplace/1', label: 'Marketplace' },
              ].map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    [
                      'rounded-xl px-3 py-2 text-sm font-medium transition',
                      isActive
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                    ].join(' ')
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8">
          <AppRouter />
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
