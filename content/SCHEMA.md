# Esquema de contenido

Todo el contenido de estudio vive aquí, en JSON. La app lo empaqueta en el build (queda disponible offline).
El esquema canónico es `src/content/schema.ts` (zod); `npm run content:schema` genera los JSON Schema de
`content/schema/` para autocompletado en el editor. `npm run validate:content` valida todo (también corre en CI,
y un error bloquea el despliegue). `npm run content:stats` muestra la cobertura por objetivo.

```
content/
├─ objectives.json          dominios, pesos y objetivos 1.1–5.6
├─ acronyms.json            lista de acrónimos
├─ d1/ … d5/
│  ├─ flashcards.json
│  ├─ questions.json
│  └─ pbqs.json            mini-PBQs interactivas (ordenar, emparejar, clasificar)
└─ reference/*.json         fichas de referencia rápida (una tabla por archivo)
```

**Idioma:** el contenido va en inglés (como el examen). La UI está en español.

**IDs estables:** tu progreso se guarda por `id`. Puedes corregir el texto de un ítem sin perder su historial;
si cambias el `id`, la app lo trata como un ítem nuevo. Nunca reutilices un `id` borrado para otro ítem.

---

## Pregunta (`dN/questions.json`, arreglo)

| Campo | Tipo | Regla |
|---|---|---|
| `id` | string | `q-<objetivo>-<NNN>`, p. ej. `q-4.8-001`. El prefijo debe coincidir con `objective`. |
| `objective` | string | Objetivo oficial, p. ej. `"4.8"`; debe pertenecer al dominio de la carpeta. |
| `type` | `"single"` \| `"multi"` | `multi` = "Choose TWO" (2+ respuestas). Por defecto `single`. |
| `difficulty` | 1–3 | 1 = recordar, 2 = aplicar, 3 = escenario con distractores cercanos. |
| `stem` | string | Escenario estilo CompTIA con palabra clave en MAYÚSCULAS: BEST, MOST likely, FIRST, PRIMARY… |
| `options` | `{text, why}[]` | 4 opciones (hasta 6 en `multi`). `why` explica por qué es correcta **o** por qué es incorrecta. |
| `answer` | number[] | Índices (base 0) de las correctas dentro de `options`. |
| `explanation` | string | Explicación general del razonamiento. |
| `industryVsComptia` | string \| null | Opcional. Cuando la respuesta "de la industria" difiere de la que espera CompTIA. |
| `tags` | string[] | Libre (`pki`, `ir`, `cloud`…). |
| `status` | `"reviewed"` \| `"draft"` | Por defecto `reviewed`. Los `draft` salen en quiz, nunca en simulacros. |

> **Las opciones se barajan al mostrarse.** No escribas "A", "B", "option C" en explicaciones; nombra la opción por su texto.

```json
{
  "id": "q-1.4-001",
  "objective": "1.4",
  "type": "single",
  "difficulty": 2,
  "stem": "A security analyst must verify a certificate's revocation status in real time without downloading a full list. Which of the following BEST meets this requirement?",
  "options": [
    { "text": "OCSP", "why": "Correct: the client asks the CA's responder about one certificate and gets a signed good/revoked/unknown answer." },
    { "text": "CRL", "why": "A CRL is a full list that must be downloaded and parsed, which the scenario rules out." },
    { "text": "CSR", "why": "A certificate signing request is used to obtain a certificate, not to check revocation." },
    { "text": "Key escrow", "why": "Escrow is third-party custody of keys; it says nothing about revocation status." }
  ],
  "answer": [0],
  "explanation": "OCSP provides per-certificate, near real-time status. OCSP stapling goes further by letting the server attach the response.",
  "industryVsComptia": null,
  "tags": ["pki"],
  "status": "reviewed"
}
```

## Flashcard (`dN/flashcards.json`, arreglo)

| Campo | Tipo | Regla |
|---|---|---|
| `id` | string | `fc-<objetivo>-<NNN>`, p. ej. `fc-5.2-004`. |
| `objective` | string | Objetivo oficial. |
| `front` | string | Pregunta o término. Corto: se lee en 3 segundos. |
| `back` | string | Respuesta. Admite saltos de línea (`\n`). |
| `comptiaNote` | string | Opcional: matiz de terminología CompTIA o trampa típica. |
| `tags`, `status` | | Igual que en preguntas. |

## PBQ (`dN/pbqs.json`, arreglo)

Mini preguntas basadas en desempeño, pensadas para pantalla táctil. Campos comunes:

| Campo | Tipo | Regla |
|---|---|---|
| `id` | string | `pbq-<objetivo>-<NNN>`, p. ej. `pbq-4.8-001`. |
| `objective` | string | Objetivo oficial principal. |
| `type` | `"order"` \| `"match"` \| `"categorize"` | Tipo de interacción (ver abajo). |
| `title` | string | Título corto (≤ 80). |
| `prompt` | string | Escenario + instrucción ("Order…", "Match…", "Classify…"). |
| `explanation` | string | Razonamiento general tras corregir. |
| `industryVsComptia` | string \| null | Opcional, igual que en preguntas. |
| `difficulty`, `tags`, `status` | | Igual que en preguntas. |

**`order`** — el usuario arrastra para ordenar. `items` va **en el orden correcto** (la app baraja); cada uno con `why`.
`firstLabel` / `lastLabel` rotulan los extremos ("Most volatile" / "Least volatile"). 3–8 ítems.
Puntaje parcial = pares relativos en el orden correcto.

**`match`** — tocar un elemento de la izquierda y luego uno de la derecha. `pairs: [{left, right, why}]` (3–8),
`leftLabel`, `rightLabel`, y `distractors` opcionales (opciones de la derecha que no emparejan con nada). Cada `right` es único.

**`categorize`** — cada ítem se clasifica en 1–2 dimensiones. `dimensions: [{id, label, options}]` y
`items: [{text, answers: {<dimId>: <opción>}, why}]` (3–10). Ejemplo: controles por categoría × tipo.

```json
{
  "id": "pbq-4.8-001", "objective": "4.8", "type": "order",
  "title": "Order of volatility",
  "prompt": "A responder is collecting evidence from a running compromised server. Order the sources from first to last.",
  "items": [
    { "text": "CPU registers and cache", "why": "Change within nanoseconds." },
    { "text": "RAM", "why": "Lost at power-off." },
    { "text": "Local disk", "why": "Persists across reboots." }
  ],
  "firstLabel": "Collect first", "lastLabel": "Collect last",
  "explanation": "Collect the most volatile evidence first so it is not lost."
}
```

## Acrónimo (`acronyms.json`, arreglo)

| Campo | Tipo | Regla |
|---|---|---|
| `id` | string | `acr-<ACRÓNIMO>` sin espacios; si un acrónimo tiene dos significados, `acr-CSR-2`. |
| `acronym` | string | Tal como aparece en la lista oficial. |
| `expansion` | string | Forma expandida oficial. |
| `note` | string | Opcional: una línea de contexto ("qué es / para qué sirve"). |
| `objectives` | string[] | Objetivos relacionados (opcional). |

## Ficha de referencia (`reference/<id>.json`, objeto)

| Campo | Tipo | Regla |
|---|---|---|
| `id` | string | Igual al nombre de archivo, minúsculas con guiones. |
| `title` | string | Título en español para la UI. |
| `description` | string | Opcional. |
| `objectives` | string[] | Objetivos relacionados. |
| `columns` | string[] | Encabezados. |
| `rows` | string[][] | Cada fila con tantas celdas como columnas. |

## Reglas de calidad

1. Contenido **original**; no copiar ni parafrasear de cerca cursos o bancos de preguntas.
2. Cada ítem debe ser técnicamente correcto según los objetivos SY0-701 y la terminología CompTIA.
3. Ante la duda, no incluir el ítem (o dejarlo en `"status": "draft"`).
4. Distractores plausibles: del mismo dominio y nivel, nunca absurdos.
