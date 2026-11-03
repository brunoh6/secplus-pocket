# Security+ Pocket · SY0-701

PWA para estudiar **CompTIA Security+ SY0-701** desde el iPhone en micro-sesiones de 5–15 min.
Funciona 100% offline, sin backend, sin cuentas y sin analytics. Tu progreso vive solo en tu dispositivo (IndexedDB).

## Qué incluye

| Sección | Qué hace |
|---|---|
| **Inicio** | Progreso ponderado por peso del examen, racha diaria, cola de hoy, botón **Sesión rápida 5 min**, indicador "¿Listo?" (≥85% en dos simulacros seguidos), aviso de respaldo. |
| **Repasar** | Flashcards con repetición espaciada **FSRS** (`ts-fsrs`). Toca para voltear; desliza ← otra vez · ↓ difícil · → bien · ↑ fácil. Mazos por dominio/objetivo, **Acrónimos** y **Mis errores** (se alimenta solo de lo que fallas o adivinas). |
| **Entrenar** | **Quiz** (mixto ponderado, dominio, objetivo, débiles, nunca vistas) con feedback inmediato · **Reto diario** (10 preguntas fijas del día) · **Diagnóstico** (30/30 min) · **Mini-examen** (10/20/30) · **Simulacro** (90 preguntas / 90 min, puntaje aproximado 100–900). Exámenes con marcar, grilla de navegación y reanudación. |
| **PBQs interactivas** | Mini-PBQs táctiles: **ordenar** (arrastrar con ≡ o ▲▼), **emparejar** (tocar y asignar) y **clasificar** (chips por dimensión, p. ej. categoría × tipo de control). Crédito parcial y explicación por elemento. Práctica por tipo o "solo las que fallé"; el **simulacro empieza con 3 PBQs** como el examen real. |
| **Aprender mejor** | Nivel de confianza (Seguro / Dudo / Adiviné) con calibración en estadísticas; "¿por qué fallaste?" (no sabía / leí mal / términos / dudé entre dos); palabras clave (BEST, FIRST…) resaltadas; notas **Industria vs CompTIA**; enlace "▶ Video" a la búsqueda de Professor Messer por objetivo. |
| **Fichas** | Puertos, criptografía, controles, métricas BIA, respaldos, modelos de nube, IR/forense y acrónimos, con búsqueda global. |
| **Más** | Estadísticas (precisión por objetivo, tendencia de simulacros, tiempo medio, objetivos nunca vistos), **respaldo** JSON (exportar con la hoja de compartir de iOS / importar fusionando o reemplazando) y ajustes. |

Contenido: **312 preguntas, 293 flashcards, 25 PBQs, 325 acrónimos y 7 fichas** sobre los 28 objetivos; original, y cada lote pasó por dos revisiones independientes.
Ver cobertura: `npm run content:stats`.

## Desarrollo

```bash
npm install
npm run dev               # http://localhost:5173 (sin service worker)
npm test                  # motores (FSRS, selección, puntaje, racha) + respaldo
npm run validate:content  # valida todo /content
npm run build && npm run preview   # build de producción con service worker
```

## Desplegar en GitHub Pages

1. Crea un repo en GitHub (p. ej. `secplus-pocket`, puede ser privado si tu plan permite Pages privadas; si no, público).
2. Sube el código:
   ```bash
   git init -b main
   git add .
   git commit -m "Security+ Pocket MVP"
   git remote add origin git@github.com:<tu-usuario>/secplus-pocket.git
   git push -u origin main
   ```
3. En GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. El workflow `.github/workflows/deploy.yml` corre en cada push a `main`: instala, ejecuta tests, valida contenido, compila con la ruta base `/<repo>/` y publica.
   La URL será `https://<tu-usuario>.github.io/secplus-pocket/`.

HTTPS lo pone GitHub Pages; es obligatorio para que el service worker funcione en el iPhone.

## Instalar en el iPhone

1. Abre la URL en **Safari** (no en otro navegador).
2. Botón **Compartir** → **Agregar a pantalla de inicio** → Agregar.
3. Abre la app **desde el icono** una vez con conexión: así queda todo en caché.
4. Prueba: activa **modo avión** y ábrela de nuevo; debe funcionar igual.

Notas iOS:
- La app instalada tiene su propio almacenamiento, separado del de Safari.
- Exporta un respaldo de vez en cuando (**Más → Respaldo**) y guárdalo en Archivos/iCloud; la app te lo recuerda cada 7 días.
- Cuando publiques una versión nueva, la app muestra "Nueva versión disponible · Actualizar" (no se recarga sola a mitad de una sesión).

## Añadir contenido

El contenido vive en `/content`: formato en [`content/SCHEMA.md`](content/SCHEMA.md) y reglas de redacción en
[`content/AUTHORING.md`](content/AUTHORING.md).

Para un lote nuevo: escribe los ítems en `content/_staging/<lote>-questions.json` (o `-flashcards.json`, `-pbqs.json`),
valídalos con `npx tsx scripts/validate-content.ts --file <archivo> --kind questions` (también detecta IDs repetidos)
y fusiónalos con `npx tsx scripts/merge-staging.ts` (cada ítem va al dominio de su objetivo).
Para autocompletado en VS Code, `npm run content:schema` genera JSON Schemas en `content/schema/`.
Los ítems con `"status": "draft"` aparecen en quizzes pero nunca en simulacros.

## Arquitectura

```
content/            JSON por dominio (preguntas, flashcards), acrónimos y fichas
scripts/            validador, estadísticas de cobertura, generador de JSON Schema
src/content/        esquema zod + carga (el JSON se empaqueta en el build → offline)
src/db/             IndexedDB (idb): repositorio, migraciones, respaldo
src/engine/         FSRS, cola de repaso, selección ponderada, dominio, puntaje, racha
src/features/       pantallas: inicio, repasar, entrenar, fichas, más
src/ui/             componentes, flashcard con gestos, vista de pregunta
tests/              Vitest
```

**Puntaje 100–900:** interpolación aproximada (0% → 100, ~81% → 750, 100% → 900). CompTIA no publica la conversión real; úsalo como tendencia.

No afiliado a CompTIA. Contenido original alineado a los objetivos oficiales SY0-701.
