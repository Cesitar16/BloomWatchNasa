export default function DashboardHeader() {
  const navItems = [
    { label: 'Mapa', symbol: '🗺️' },
    { label: 'Series', symbol: '📊' },
    { label: 'Predicción', symbol: '🎯' },
    { label: 'Galería', symbol: '🖼️' }
  ];

  return (
    <header className="dashboard-header">
      <div className="dashboard-header__brand">
        <span className="dashboard-header__logo">
          <span aria-hidden="true">🌿</span>
        </span>
        <div>
          <h1>BloomWatch</h1>
          <p>Monitoreo ambiental de floraciones y vegetación.</p>
        </div>
      </div>

      <nav className="dashboard-header__nav" aria-label="Secciones principales">
        {navItems.map(({ label, symbol }) => (
          <button type="button" key={label} className="dashboard-header__nav-item">
            <span aria-hidden="true">{symbol}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </header>
  );
}
