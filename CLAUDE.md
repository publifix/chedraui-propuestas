# Motor de presentaciones comerciales · Publifix × Inmobiliaria Chedraui

> Documento base del proyecto. Léelo completo antes de escribir código. Si una decisión no está cubierta aquí, pregunta antes de asumir.

## 1. Contexto

Inmobiliaria Chedraui renta locales en sus plazas comerciales. Hoy entrega a sus prospectos un PDF estático (portada, láminas institucionales de la plaza, plano, ficha del local con renta y mantenimiento, fotos, directorio de marcas y contacto). Ese material es genérico, tiene errores de cálculo y no aporta nada específico al giro del prospecto.

Publifix propone sustituirlo por **micrositios interactivos personalizados por prospecto**, con narrativa editorial, números claros y un business case orientado al giro del inquilino. La referencia de estilo y narrativa es una cotización residencial de ZPAI (cot-humberto-307-gc.netlify.app): titulares tipográficos grandes, una idea por pantalla, cita pivote antes de los números, tarjeta tipo estado de cuenta y barras de escenarios.

## 2. Qué es y qué NO es este proyecto

**Es** una herramienta de producción interna de Publifix. Publifix opera el motor, crea cada presentación y entrega a Chedraui un link listo para enviar.

**No es** un SaaS. Chedraui no tiene acceso al sistema, no hay panel para ellos, ni usuarios, ni roles, ni flujos de aprobación dentro del producto.

Flujo operativo:

1. Chedraui solicita: plaza, local, prospecto (marca y persona destinataria) y giro, más condiciones si difieren de las base.
2. Publifix crea el archivo de la presentación, el motor lo valida y genera el sitio.
3. Publifix revisa la presentación en el **link de revisión** (sin tracking).
4. Publifix entrega a Chedraui el **link de envío** (con tracking).
5. Publifix genera periódicamente un **reporte de engagement** por presentación y lo envía a Chedraui.

## 3. Objetivo de la fase actual: DEMO

Construir una demo funcional para presentarle a Chedraui ("esto podríamos hacer para ustedes, así funcionaría"). La demo debe probar dos cosas:

1. **Calidad:** una presentación real (El Dorado → Rubí Perfumería, local A25+A26) al nivel visual de la referencia.
2. **Replicabilidad:** que el motor genera presentaciones distintas solo cambiando archivos de configuración. Para demostrarlo se generará una segunda presentación en la misma plaza para otro prospecto y otro giro.

### Fuera de alcance de la demo

Video (Remotion, streaming), recorridos 3D o 360°, alertas en tiempo real, registro de desenlace comercial, panel interno, generación automática de textos vía API de Claude (en la demo los textos se redactan en los archivos de configuración), multi-idioma.

### Definición de terminado (demo)

- [ ] Dos presentaciones generadas desde configuración, sin código específico por prospecto.
- [ ] Cada presentación tiene link de revisión y link de envío con tokens distintos y no adivinables.
- [ ] La vista previa al pegar el link de envío en WhatsApp muestra título, descripción e imagen personalizados.
- [ ] Todos los montos se calculan con funciones probadas; ningún monto derivado está escrito a mano.
- [ ] El link de envío registra eventos en Supabase; el link de revisión no registra nada.
- [ ] Lighthouse móvil ≥ 90 en rendimiento y accesibilidad.
- [ ] Desplegado en GitHub Pages mediante GitHub Actions.

## 4. Principios

1. **Contenido como código.** Plazas, locales y presentaciones son archivos YAML validados con esquemas. Crear una presentación nueva = crear un archivo.
2. **Tres capas con herencia.** Plaza → Local → Presentación. Cada capa solo define lo suyo y puede sobrescribir lo heredado donde se permita.
3. **Los números se calculan, nunca se capturan.** IVA, totales, depósito, renta por m² y escenarios salen de funciones puras con pruebas.
4. **Replicable por plaza.** Ningún componente puede tener texto, color o dato de El Dorado escrito en el código. Todo sale de la configuración.
5. **Mobile first.** La mayoría de los prospectos abrirá el link desde WhatsApp en el celular.
6. **Honestidad en la presentación.** Toda métrica de la plaza muestra fuente y periodo. Los escenarios se presentan como ilustrativos.

## 5. Stack

| Pieza | Elección | Notas |
|---|---|---|
| Generador | Astro (salida estática) + TypeScript estricto | Una página por presentación y por tipo de link |
| Esquemas | Zod | Validación al build; el build falla si falta un campo obligatorio |
| Estilos | CSS con variables (design tokens) por plaza | Sin dependencia de un tema único; nada de colores fijos en componentes |
| Interactividad | JavaScript mínimo, por islas | Plano interactivo, escenarios y tracking |
| Pruebas | Vitest | Obligatorio para el módulo de cálculos |
| Tracking | Supabase (Postgres + RLS) | Solo inserción desde el cliente |
| Hosting | GitHub Pages vía GitHub Actions | Dominio personalizado por definir |
| Gestor de paquetes | pnpm | |

Convenciones: código, nombres de archivos y variables en inglés; contenido visible, configuración YAML y comentarios de negocio en español.

## 6. Estructura del repositorio

```
/
├── CLAUDE.md
├── content/
│   ├── plazas/
│   │   └── el-dorado/
│   │       ├── plaza.yaml
│   │       ├── planos/pb.svg
│   │       ├── media/
│   │       └── locales/
│   │           └── a25-a26.yaml
│   ├── giros/
│   │   └── perfumeria.yaml
│   ├── asesores/
│   │   └── <slug>.yaml
│   └── presentaciones/
│       └── 2026-11-rubi-perfumeria-a25-a26.yaml
├── src/
│   ├── schemas/          # Zod: plaza, local, giro, asesor, presentacion
│   ├── lib/
│   │   ├── calc/         # cálculos financieros puros + tests
│   │   ├── resolve.ts    # fusiona plaza + local + presentación en un modelo final
│   │   └── tracking.ts   # cliente de eventos
│   ├── components/
│   │   └── sections/     # una sección = un componente
│   ├── layouts/
│   └── pages/
│       ├── p/[token].astro         # link de envío (tracking activo)
│       └── revision/[token].astro  # link de revisión (sin tracking)
├── supabase/
│   └── migrations/
└── .claude/
    └── commands/         # comandos operativos (ver sección 13)
```

## 7. Modelo de datos

Leyenda: **O** = obligatorio, **Op** = opcional.

### 7.1 Plaza (`plaza.yaml`) · se configura una vez por plaza

| Campo | Tipo | | Descripción |
|---|---|---|---|
| `slug` | string | O | Identificador (`el-dorado`) |
| `nombre` | string | O | Nombre comercial |
| `nombre_completo` | string | Op | p. ej. "El Dorado Centro Comercial & Marina" |
| `ubicacion` | objeto | O | `ciudad`, `estado`, `direccion`, `zona` |
| `tema` | objeto | O | `colores` (fondo, superficie, texto, texto_suave, acento, linea), `tipografias` (display, cuerpo), `logo`, `icono`, `medidas` (op). Ver 7.1.1 |
| `frase_principal` | string | O | Titular de apertura de la plaza |
| `hero` | objeto | O | `imagen`, `alt` |
| `metricas` | lista | O | Cada una: `valor`, `etiqueta`, `fuente`, `periodo` |
| `diferenciales` | lista | O | Cada uno: `titulo`, `texto`, `imagen` (op) |
| `anclas` | lista | O | Cada una: `marca`, `logo`, `giro`, `area_m2` (op), `local_ref` (op) |
| `directorio` | lista | Op | Marcas con `logo` y `giro` |
| `niveles` | lista | O | Cada uno: `id`, `nombre`, `plano` (ruta SVG) |
| `modulos` | lista | Op | Experiencias propias (p. ej. `marina`, `park`, `eventos`) con su contenido |
| `contacto_general` | objeto | O | `web`, `correo`, `telefono` |
| `legales` | objeto | O | `aviso_privacidad_url`, `leyenda_imagenes` |

#### 7.1.1 Tema

- **Colores:** hex. El build falla si un par de texto sobre fondo no cumple WCAG AA (4.5:1): texto, texto_suave y acento sobre fondo y superficie, y superficie sobre acento (`src/lib/theme/contrast.ts`).
- **Tipografías:** nombres del catálogo autoalojado de `src/lib/theme/fonts.ts` (OFL, subset latin, solo pesos 400/500, `font-display: swap`; nada se carga de Google Fonts). Display: Instrument Serif, Gloock, Bodoni Moda. Cuerpo: Jost, Outfit, Urbanist. Para agregar una familia, se suma al catálogo y a `font-roles.ts`.
- **Medidas (opcional):** `escala` (razón tipográfica en escritorio, 1.1–1.6), `espacio_base` (px), `radio` (px), `linea` (px), `duracion_ms`. Sin ellas se usan los valores del motor (`DEFAULT_MEDIDAS`).
- `src/lib/theme/tokens.ts` convierte el tema en variables CSS (`--color-*`, `--font-*`, `--step-*` fluidos con `clamp()` de 360 a 1280 px, `--space-*`, `--radius-*`, `--line-width`, `--duration*`) que el layout inyecta en `:root`. Ningún componente usa valores visuales propios.
- El tema no cambia con el modo claro u oscuro del dispositivo: `color-scheme` queda fijo según el fondo de la plaza.

### 7.2 Local (`locales/<clave>.yaml`) · uno por local disponible

| Campo | Tipo | | Descripción |
|---|---|---|---|
| `clave` | string | O | p. ej. `A25+A26` |
| `nivel` | string | O | Debe existir en `plaza.niveles` |
| `plano_ref` | string | O | `id` del elemento en el SVG del nivel |
| `area_m2` | number | O | |
| `estado` | enum | O | `disponible`, `apartado` |
| `condiciones_base` | objeto | O | Ver 7.2.1 |
| `ficha_tecnica` | objeto | Op | `frente_m`, `altura_m`, `agua`, `gas`, `carga_electrica`, `extraccion` |
| `vecinos` | lista | Op | Si no se define, se deriva del plano |
| `media` | objeto | Op | `fotos`, `video`, `tour` |

#### 7.2.1 Condiciones base

| Campo | Tipo | | Descripción |
|---|---|---|---|
| `renta_mensual` | number | O | Antes de IVA, en MXN |
| `mantenimiento_mensual` | number | O | Antes de IVA |
| `iva` | number | O | Por defecto `0.16` |
| `deposito` | objeto | O | `meses` (number), `incluye_mantenimiento` (bool), `incluye_iva` (bool) |
| `incremento_anual` | objeto | Op | `tipo` (`fijo`, `inpc`), `valor` |
| `plazo_minimo_meses` | number | Op | |
| `meses_gracia` | number | Op | |
| `giros_permitidos` | lista | Op | |

### 7.3 Giro (`giros/<slug>.yaml`) · referencia para el business case

| Campo | Tipo | | Descripción |
|---|---|---|---|
| `slug` | string | O | |
| `nombre` | string | O | |
| `costo_ocupacion_objetivo` | objeto | O | Rango sano de (renta + mantenimiento) / ventas, p. ej. `min`, `max`. **Valores a validar; no inventar cifras de mercado sin fuente** |
| `angulos_narrativos` | lista | Op | Argumentos de la plaza relevantes para el giro |

### 7.4 Asesor (`asesores/<slug>.yaml`)

`nombre` (O), `puesto` (Op), `whatsapp` (O), `correo` (Op).

### 7.5 Presentación (`presentaciones/<fecha>-<prospecto>-<local>.yaml`) · una por prospecto

| Campo | Tipo | | Descripción |
|---|---|---|---|
| `id` | string | O | Igual al nombre del archivo |
| `estado` | enum | O | `borrador` o `lista`. Ver 7.5.2 |
| `tokens` | objeto | O | `envio`, `revision`. Aleatorios, ≥ 12 caracteres, distintos entre sí. Los genera el comando `/nueva-presentacion` |
| `plaza` | string | O | Slug de la plaza |
| `locales` | lista | O | Una o dos claves (dos = comparativa) |
| `prospecto` | objeto | O | `marca`, `destinatario`, `giro` (slug), `logo` (op) |
| `condiciones` | objeto | Op | Sobrescribe campos de `condiciones_base`. Ver 7.5.1 |
| `vigencia` | fecha | O | Después de esta fecha la página muestra "propuesta vencida" |
| `escenarios_venta` | lista | O | 3 escenarios: `nombre`, `ventas_mensuales` |
| `narrativa` | objeto | O | `apertura`, `pivote`, `cierre` |
| `asesor` | string | O | Slug del asesor |
| `secciones` | lista | Op | Orden y activación de secciones; si no se define se usa el orden por defecto |
| `seo` | objeto | O | `titulo`, `descripcion`, `imagen_og` |

#### 7.5.1 Condiciones negociadas

- **Un local:** `condiciones` contiene directamente los campos de `condiciones_base` que cambian.
- **Dos locales (comparativa):** `condiciones` va por clave de local; cada local solo recibe lo de su clave y un local sin clave conserva sus condiciones base. Las claves deben ser locales de la presentación.

```yaml
condiciones:           # un local
  renta_mensual: 15000
---
condiciones:           # dos locales
  A25+A26: { renta_mensual: 16000 }
  A27: { meses_gracia: 2 }
```

- Se sobrescribe campo por campo y nada más; `deposito` e `incremento_anual` se reemplazan completos. Ninguna otra capa se sobrescribe.

#### 7.5.2 Estado

- **`borrador`:** solo se genera el link de revisión, con los `TODO` visibles.
- **`lista`:** el build falla si queda cualquier valor `TODO` en un campo que vea el prospecto (el modelo resuelto: plaza, locales, giro, asesor y presentación, sin contar los campos de secciones desactivadas en `secciones`). Solo entonces se genera también el link de envío (`src/lib/routes.ts`). Los comentarios `# TODO` no bloquean.

## 8. Cálculos (`src/lib/calc`)

Funciones puras, sin efectos secundarios, con pruebas en Vitest para cada una, incluidos los datos reales de El Dorado.

| Función | Fórmula |
|---|---|
| `subtotalMensual` | renta + mantenimiento |
| `ivaMensual` | subtotal × iva |
| `totalMensual` | subtotal + iva |
| `rentaPorM2` | renta / área |
| `mantenimientoPorM2` | mantenimiento / área |
| `deposito` | (renta + mantenimiento si `incluye_mantenimiento`) × meses × (1 + iva si `incluye_iva`) |
| `costoOcupacionPct` | subtotal / ventas_mensuales (por escenario) |
| `ventasEquilibrio` | subtotal / `costo_ocupacion_objetivo.max` del giro |
| `costoAnual` | totalMensual × 12, aplicando meses de gracia e incremento si existen |

Reglas: redondear solo al mostrar, nunca en cálculos intermedios; formato `es-MX` con `$` y separador de miles; mostrar siempre si un monto incluye o no IVA.

Implementación:
- Cada monto es `{ amount, vat, estimate, assumptions }`, con `vat` = `excluded` (+ IVA), `included` (IVA incluido) u `only` (el IVA mismo). Los porcentajes llevan también `vat`.
- Si un dato está en `TODO` (ventas de un escenario, rango de costo de ocupación del giro), el resultado es `{ kind: 'pending', reason }`, no un número ni un error; la interfaz lo muestra como "Pendiente".
- `costoAnual(c, anio)` calcula el año `anio` del contrato (1 por defecto). Supuestos, pendientes de confirmar con Chedraui: los meses de gracia eximen solo la renta, desde el primer mes (el mantenimiento se paga); el incremento anual aplica solo a la renta desde el año 2, compuesto. Con `tipo: inpc`, `valor` es la inflación supuesta y el resultado se marca como estimación con el supuesto escrito.
- `incremento_anual.valor` se expresa como fracción (`0.05` = 5 %).
- Formato: `src/lib/calc/format.ts` (`formatMoney`, `formatAmount`, `formatPercent`). Los cálculos de cada local viven en `calculos` del modelo resuelto.

**Caso conocido a cubrir con prueba:** en el PDF actual de El Dorado el depósito dice "renta + mantenimiento + IVA = $19,720", pero $19,720 = $17,000 × 1.16 (solo renta con IVA). La regla correcta está pendiente de confirmar con Chedraui; mientras tanto, configurar `deposito: { meses: 1, incluye_mantenimiento: false, incluye_iva: true }` y documentarlo en la presentación demo.

## 9. Secciones del visor

Una sección = un componente en `src/components/sections`. Cada una recibe el modelo resuelto y no lee archivos por su cuenta.

| Orden | Sección | Contenido |
|---|---|---|
| 1 | `Portada` | "Para {destinatario} · {marca}", frase principal de la plaza, local y plaza |
| 2 | `HeroPlaza` | Imagen a sangre, nombre de la plaza, zona |
| 3 | `Metricas` | Trío o cuarteto de cifras con fuente y periodo |
| 4 | `Diferenciales` | Pantallas divididas texto / imagen |
| 5 | `Anclas` | Marcas ancla relevantes |
| 6 | `PlanoInteractivo` | SVG del nivel con el local resaltado, vecinos y anclas al tocar |
| 7 | `FichaLocal` | Clave, área, nivel, ficha técnica, fotos |
| 8 | `Pivote` | Cita centrada con la narrativa de transición a números |
| 9 | `Condiciones` | Tarjeta tipo estado de cuenta: renta, mantenimiento, IVA, total, depósito, por m² |
| 10 | `BusinessCase` | Barras de costo de ocupación por escenario y ventas de equilibrio |
| 11 | `Modulos` | Experiencias de la plaza activadas |
| 12 | `Directorio` | Logos de inquilinos |
| 13 | `Cierre` | Frase de cierre, botón de WhatsApp al asesor, vigencia de la oferta |
| — | `Footer` | Aviso de privacidad, leyenda de imágenes, crédito discreto de Publifix |

Layout base (`src/layouts/PresentationLayout.astro`): encabezado fijo con fondo, barra de progreso de lectura, `<main>` donde cada sección va dentro de `src/components/Screen.astro` (una idea por pantalla), footer con aviso de privacidad, leyenda de imágenes y crédito de Publifix, franja "Vista previa interna · sin registro" con la lista de pendientes solo en revisión, `noindex` y Open Graph desde `seo`, márgenes seguros (`env(safe-area-inset-*)`) y entrada sutil que respeta `prefers-reduced-motion`. Los valores en `TODO` se muestran con `src/components/Field.astro`. La muestra de tokens de cada plaza vive en `/revision/<token_revision>/tokens/`.

Dirección visual: titulares en serif display condensada, cuerpo en sans geométrica, etiquetas en mayúsculas con tracking amplio, líneas finas como separadores, una idea por pantalla, mucho espacio. El encabezado fijo debe tener fondo para que los titulares no se encimen al hacer scroll. Sin sonido. Animaciones de entrada sutiles y respetando `prefers-reduced-motion`.

## 10. Links, vigencia y SEO

- Link de envío: `/p/<token_envio>/`. Link de revisión: `/revision/<token_revision>/`. Mismo contenido; la revisión muestra una franja "Vista previa interna · sin registro" y no carga el tracking.
- Todas las páginas con `noindex, nofollow`; sin sitemap; `robots.txt` bloquea `/p/` y `/revision/`.
- Etiquetas Open Graph personalizadas por presentación para la vista previa de WhatsApp (`seo.titulo`, `seo.descripcion`, `seo.imagen_og` de 1200×630).
- Vigencia: comprobación en el cliente; si la fecha pasó, se muestra un estado de "propuesta vencida" con el contacto del asesor.

## 11. Tracking

Solo en el link de envío. Sin cookies de terceros ni scripts externos de analítica.

Tabla `events` en Supabase:

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | uuid | |
| `presentation_id` | text | `id` de la presentación |
| `visitor_id` | text | Aleatorio, guardado en `localStorage` |
| `session_id` | text | Aleatorio por sesión |
| `event` | text | Ver lista |
| `section` | text | Nullable |
| `value` | jsonb | Datos del evento |
| `device` | text | `mobile`, `tablet`, `desktop` |
| `timezone` | text | |
| `created_at` | timestamptz | Por defecto `now()` |

Eventos: `open`, `section_view` (con `active_ms`), `scroll_depth` (25/50/75/100), `plan_interaction`, `scenario_view`, `cta_click`, `session_end`.

Reglas:
- RLS: el rol anónimo solo puede insertar; nunca leer, actualizar ni borrar.
- El tiempo se mide como tiempo activo (Page Visibility API + inactividad > 30 s pausa el conteo).
- Enviar eventos en lote y con `navigator.sendBeacon` al cerrar.
- No guardar IP ni datos personales del visitante.
- Si el tracking falla, la página funciona igual.

## 12. Plan de trabajo sugerido

1. Inicializar Astro + TypeScript estricto + pnpm + Vitest + despliegue a GitHub Pages.
2. Esquemas Zod de las cinco entidades y función `resolve` que fusiona capas.
3. Módulo de cálculos con pruebas (incluido el caso del depósito).
4. Sistema de tokens de diseño por plaza y layout base.
5. Secciones del visor, empezando por `Portada`, `Condiciones` y `Pivote`.
6. Plano interactivo: SVG simplificado de la zona del local A25+A26 dibujado a partir del plano del PDF.
7. Páginas de envío y revisión con Open Graph y vigencia.
8. Segunda presentación (otro prospecto y otro giro) para probar replicabilidad.
9. Tracking con Supabase.
10. Revisión de rendimiento y accesibilidad.

Trabaja en ese orden y confirma al terminar cada paso.

## 13. Comandos operativos (`.claude/commands`)

- `/nueva-presentacion` · Recibe plaza, local, prospecto, giro, asesor y vigencia; genera tokens; crea el YAML; ejecuta la validación; muestra el link de revisión.
- `/validar` · Valida todos los archivos de `content/` contra los esquemas y lista errores en español.
- `/reporte <id>` · (posterior a la demo) Consulta eventos en Supabase y genera el reporte de engagement.

## 14. Datos semilla: El Dorado

Datos tomados de la presentación PDF actual de Chedraui (junio 2026).

**Plaza**
- Nombre: El Dorado Centro Comercial & Marina.
- Ubicación: Carretera Federal Paso del Toro–Boca del Río–Antón Lizardo #4405, Col. El Novillero, Boca del Río, Veracruz, C.P. 94290. Zona: Riviera Veracruzana.
- Diferenciales: diseño de Legorreta + Legorreta; 160 mil m² de construcción; marina con club náutico y acceso en yate; terrazas con vista a la marina; El Dorado Park (+50 atracciones, arcade, realidad virtual, trampolines).
- Métricas: +600 mil visitantes mensuales; +1,600 cajones de estacionamiento. **Fuente y periodo pendientes.**
- Planta baja: 43 locales, 9 restaurantes.
- Anclas: Liverpool (28,000 m²), Chedraui Selecto (10,706 m²). Otras marcas: Forever 21, Steve Madden, Smart Fit, Sonora Grill, Coppel, Cinépolis, Cinépolis VIP, Pandora, Starbucks, adidas, Shasa, Sally Beauty, Petco, Telcel, Santander, Banregio, entre otras.
- Contacto general: centrocomercialeldorado.mx · administracion@centrocomercialeldorado.mx · (229) 986 11 96 / 41 23.
- Identidad: morado con velero blanco; hashtag #ExperienciaElDorado.

**Local A25+A26**
- Nivel: PB. Área: 77.76 m².
- Renta: $17,000 + IVA. Mantenimiento: $2,550 + IVA.
- Depósito: $19,720 según el PDF (ver caso conocido en la sección 8).
- Vecinos visibles en el plano: A23, A22, Innvictus (A19), B3 Studio, A18, A20.

**Prospecto demo 1**
- Marca: Rubí Perfumería. Giro: perfumería. Destinatario: **pendiente**.

**Prospecto demo 2**
- Por definir: otra marca y otro giro (sugerencia: cafetería o accesorios) sobre un local distinto de la misma plaza.

**Pendientes de información** (usar marcadores `TODO` visibles solo en el link de revisión): plazo mínimo, incremento anual, meses de gracia, giros permitidos, ficha técnica del local, fotos de buena calidad, plano vectorial, fuente de las métricas, asesor responsable, aviso de privacidad, rango de costo de ocupación por giro.

## 15. Skills de diseño

El proyecto tiene instaladas las skills **UI UX Pro Max** (`.claude/skills/ui-ux-pro-max`) e **Impeccable** (`.claude/skills/impeccable`). Se usan como guía de calidad de interfaz: jerarquía, espaciado, ritmo vertical, estados de interacción, accesibilidad, responsive y revisión final.

Orden de prioridad cuando haya conflicto:

1. La dirección visual de la sección 9 de este documento.
2. Los tokens de diseño de cada plaza (`plaza.yaml` → `tema`).
3. Las recomendaciones de las skills.

Las skills **no definen colores, tipografías ni estilos fijos**: todo valor visual sale de variables CSS alimentadas por la plaza. Si una skill sugiere una paleta, una fuente o un estilo concreto, se ignora esa parte y se conserva solo el criterio de calidad.

Se aplican especialmente en los pasos 4, 5 y 10 del plan de trabajo (sección 12). Antes de dar por terminada cualquier sección del visor, hay que revisarla con ambas skills y reportar los ajustes hechos.

## 16. Repositorio público y contenido

- El repositorio `publifix/chedraui-propuestas` es **público**.
- Durante la demo solo se usan datos ya públicos de Chedraui y prospectos de demostración.
- En operación real, el contenido (carpeta `content/` con plazas, locales, presentaciones y tokens) se moverá a un **repositorio privado** que el workflow de GitHub Actions descargará en cada build mediante una deploy key.
- Por eso todo el código debe leer el contenido **únicamente desde una ruta configurable** (variable `CONTENT_DIR`, por defecto `content/`), sin asumir que el contenido vive en este repositorio.

## 17. Ambiente y publicación

- Node 24 (`.nvmrc`) y pnpm 10 (`packageManager`). TypeScript 6: `astro check` aún no soporta TS 7.
- Comandos: `pnpm dev`, `pnpm test`, `pnpm build` (incluye `astro check`), `pnpm preview`.
- **Solo `main` publica.** `.github/workflows/deploy.yml` corre pruebas y build en cualquier rama y en cada pull request, pero el empaquetado y el job `deploy` exigen `refs/heads/main` (también si se lanza a mano desde Actions). Ninguna otra rama puede publicar; los cambios llegan al sitio solo por merge a `main`.
- Sitio: https://publifix.github.io/chedraui-propuestas/. `site` y `base` están en `astro.config.ts`; toda ruta interna o asset se construye con `withBase()` (`src/lib/paths.ts`), nunca con rutas absolutas escritas a mano. Al conectar el dominio personalizado, ajustar `site`, `base` y las rutas de `public/robots.txt`.
- Variables de entorno: ver `.env.example`. Los valores reales de Supabase viven solo en `.env` local y en los secrets del repo; nunca en código ni en el chat.
- **Flujo de cada paso:** correr `pnpm test` y `pnpm build`, hacer commit y push a la rama de trabajo, abrir el pull request hacia `main` y esperar la aprobación en el chat. Con la aprobación, Claude hace el merge, confirma que la corrida de `main` terminó en verde y que el sitio se actualizó.
- El contenido se valida al iniciar `pnpm build` (integración `src/lib/content-validation.ts`): cualquier error de esquema o de referencia detiene el build y se listan todos, en español, con archivo y campo. En `pnpm dev` los errores se reportan sin detener el servidor.
- Datos pendientes: los campos de texto obligatorios usan `"TODO: …"`; los opcionales se omiten con un comentario `# TODO: …`; solo `costo_ocupacion_objetivo` y `ventas_mensuales` aceptan `TODO` en lugar de número.
- El hook `.claude/hooks/session-start.sh` prepara Node 24 y las dependencias en sesiones en la nube.
