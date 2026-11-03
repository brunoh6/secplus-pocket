import { Link } from 'react-router-dom';
import { TopBar } from '../../ui/components';

export default function More() {
  const items = [
    { to: '/more/stats', icon: '📊', title: 'Estadísticas', sub: 'Precisión por objetivo, simulacros, calibración' },
    { to: '/more/backup', icon: '💾', title: 'Respaldo', sub: 'Exportar / importar tu progreso (JSON)' },
    { to: '/more/settings', icon: '⚙️', title: 'Ajustes', sub: 'Repaso espaciado, confianza, temporizador, fecha de examen' },
  ];
  return (
    <div className="stack-lg">
      <TopBar title="Más" back={false} />
      <section className="card list">
        {items.map((i) => (
          <Link key={i.to} to={i.to} className="list-item">
            <span style={{ fontSize: 22 }}>{i.icon}</span>
            <div className="grow"><div>{i.title}</div><div className="tiny muted">{i.sub}</div></div>
            <span className="muted">›</span>
          </Link>
        ))}
      </section>
      <section className="card stack small muted">
        <p><strong>Security+ Pocket</strong> v{__APP_VERSION__}. Funciona 100% offline; tus datos viven solo en este dispositivo.</p>
        <p>Contenido original, alineado a los objetivos oficiales de CompTIA SY0-701. No afiliado a CompTIA. Los enlaces "▶ Video" abren una búsqueda de YouTube de los videos gratuitos de Professor Messer.</p>
      </section>
    </div>
  );
}
