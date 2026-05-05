function BadgesRow({ badges = [] }) {
  if (!badges || badges.length === 0) {
    return (
      <div className="card p-6">
        <div className="card-header mb-4">
          <div>
            <h2 className="card-title">Badges</h2>
            <p className="card-subtitle">Highlights earned through positive activity.</p>
          </div>
        </div>
        <div className="rounded-xl border border-dashed border-slate-200 bg-white/50 p-4 text-sm text-slate-500">
          No badges yet.
        </div>
      </div>
    )
  }

  return (
    <div className="card p-6">
      <div className="card-header mb-4">
        <div>
          <h2 className="card-title">Badges</h2>
          <p className="card-subtitle">Highlights earned through positive activity.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        {badges.map((badge) => (
          <div
            key={badge.id}
            className="group relative inline-flex items-center"
            title={badge.description}
          >
            <div className="flex items-center px-3 py-2 bg-slate-100/70 rounded-xl hover:bg-slate-100 transition-colors cursor-help border border-slate-200/60">
              {badge.icon && (
                <span className="text-2xl mr-2" role="img" aria-label={badge.name}>
                  {badge.icon}
                </span>
              )}
              <span className="text-sm font-medium text-slate-800">{badge.name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default BadgesRow
