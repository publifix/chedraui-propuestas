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
| `tema` | objeto | O | `colores` (fondo, superficie, texto, texto_suave, acento, acento_suave, linea, marca, texto_marca), `tipografias` (display, cuerpo, cita op), `logo`, `icono`, `medidas` (op). Ver 7.1.1 |
| `frase_principal` | string | O | Titular de apertura de la plaza |
| `hero` | objeto | O | `imagen`, `alt` |
| `metricas` | lista | O | Cada una: `valor`, `etiqueta`, `fuente`, `periodo` |
| `diferenciales` | lista | O | Cada uno: `titulo`, `texto`, `imagen` (op) |
| `anclas` | lista | O | Cada una: `marca`, `logo` (op), `giro`, `area_m2` (op), `local_ref` (op). Sin logo, la marca se muestra como marca tipográfica |
| `directorio` | lista | Op | Marcas con `giro` y `logo` (op). Sin logo, marca tipográfica en la familia de display, en tarjetas uniformes |
| `niveles` | lista | O | Cada uno: `id`, `nombre`, `plano` (ruta SVG que cumple 7.1.2, o `TODO`), `ocupantes` (op): `clave`, `marca`, `giro`, `area_m2` (op), `categoria` (op: `tienda`, `restaurante`, `servicio`) |
| `modulos` | lista | Op | Experiencias propias (p. ej. `marina`, `park`, `eventos`) con su contenido |
| `contacto_general` | objeto | O | `web`, `correo`, `telefono` |
| `legales` | objeto | O | `leyenda_imagenes` y el aviso: `aviso_privacidad_url` (externo, `https://`) o `aviso_privacidad` (`responsable`, `actualizado`, `secciones` con `titulo` y `texto`), que se publica en `/privacidad/<plaza>/` (`src/pages/privacidad/[plaza].astro`, `noindex`) y el footer enlaza |

**Imágenes:** las rutas de `plaza.yaml` (logo, icono, hero, diferenciales, módulos, anclas, directorio) y de `media.fotos` del local son relativas a la carpeta de la plaza (`media/<archivo>`), con nombres en minúsculas y guiones. El build falla si una imagen citada no existe; `TODO` se acepta. Se sirven con el pipeline de Astro (`src/lib/media.ts` con el alias `@content` → `CONTENT_DIR`, `src/components/PlazaImage.astro`): AVIF/WebP en anchos de 360 a 1440 px con `sizes` y respaldo JPG. Una imagen que falta se muestra con `MediaPlaceholder.astro` en su proporción; en revisión dice cuál falta.

#### 7.1.1 Tema

- **Colores:** hex. `marca` es el fondo de las secciones a sangre (clase `surface-brand` o `Screen tone="brand"`, que redefine los tokens de color en su ámbito) y `texto_marca` su texto. `acento_suave` es el segundo tono de gráficas y rangos (barras de dos tonos con `acento`). El build falla si no se cumple WCAG AA (`src/lib/theme/contrast.ts`): **texto 4.5:1** para texto, texto_suave y acento sobre fondo y superficie, superficie sobre acento, texto_marca sobre marca y superficie sobre acento_suave; **gráficas 3:1** (criterio 1.4.11) para acento_suave sobre fondo y superficie.
- **Tipografías:** nombres del catálogo autoalojado de `src/lib/theme/fonts.ts` (OFL, subset latin, `font-display: swap`; nada se carga de Google Fonts). Hoy el catálogo tiene **Archivo** variable (display y cuerpo; peso 100–900, ancho 62–125 %, con cifras tabulares) y **Newsreader** itálica (`cita`, solo para la cita pivote). Cada familia de display trae tres estilos (`short`, `long`, `figure`) y cada familia de cuerpo el de etiquetas; se exponen como variables (`--title-short-*`, `--title-long-*`, `--figure-*`, `--label-*`, `--quote-*`). Para agregar una familia, se suma al catálogo y a `font-roles.ts`.
- **Cifras:** las cifras grandes (`.t-figure`) usan ancho normal y números tabulares, igual que la tarjeta de condiciones; para otros montos, la clase `.tabular`.
- **Medidas (opcional):** `escala` (razón tipográfica en escritorio, 1.1–1.6), `espacio_base` (px), `radio` (px), `linea` (px), `duracion_ms`. Sin ellas se usan los valores del motor (`DEFAULT_MEDIDAS`).
- `src/lib/theme/tokens.ts` convierte el tema en variables CSS (`--color-*`, `--font-*`, `--step-*` fluidos con `clamp()` de 360 a 1280 px, `--space-*`, `--radius-*`, `--line-width`, `--duration*`) que el layout inyecta en `:root`. Ningún componente usa valores visuales propios.
- El tema no cambia con el modo claro u oscuro del dispositivo: `color-scheme` queda fijo según el fondo de la plaza.

#### 7.1.2 Contrato del plano

Toda plaza entrega **un SVG por nivel** (`niveles[].plano`, relativo a la carpeta de la plaza) que cumple este contrato; el build lo valida (`src/lib/plano/svg.ts`, `readFloorPlan`) y falla con archivo, campo y motivo:

- `<svg>` con `viewBox`. Sin `<script>`, manejadores `on…=`, `javascript:`, `<foreignObject>` ni `href` externos.
- **Grupos de capa de nombre fijo**: `<g id="contorno">`, `pasillos`, `locales`, `anclas`, `accesos`, `estacionamiento`, `etiquetas` (obligatorios); `marina` y `rutas` (opcionales). El visor los estiliza con los tokens de la plaza: el SVG no necesita colores.
- **Locales** (en `locales`): un `<rect>` o `<polygon>` por local, sin `transform`, con `id="local-<clave>"` (clave en minúsculas, separadores como guiones: `A25+A26` → `local-a25-a26`) y `data-clave="<clave>"`. El `plano_ref` del local debe ser ese id. Cada local dibujado necesita datos: un ocupante en `niveles[].ocupantes` o su propio archivo de local.
- **Anclas**: `id="ancla-…"` y `data-marca` igual a una marca de `anclas` de la plaza. **Accesos**: `id="acceso-…"` y `data-nombre`. **Estacionamiento**: `id="estacionamiento-…"` y `data-nombre`.
- **Rutas** (opcional): `<path id="ruta-…" data-desde="<id de estacionamiento, ancla o acceso>" data-hasta="<clave>">`. Un local con `ruta` en su archivo necesita su `<path>`.
- **Etiquetas**: textos con `data-para` (clave o id al que rotulan) y una leyenda con `data-leyenda` ("Plano esquemático, no a escala").
- Es un plano **esquemático, no arquitectónico**: la zona del local se dibuja con detalle y el resto como bloques simples.

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
| `vecinos` | lista | Op | Claves de locales del mismo nivel (ocupantes u otros archivos de local; se valida). La marca y el giro salen de `niveles[].ocupantes`: los ocupantes viven solo ahí (una sola fuente de verdad) |
| `ruta` | objeto | Op | `desde` (id de un estacionamiento, ancla o acceso del plano) y `texto` de cercanía (`TODO` si no hay dato; nunca inventar distancias ni flujos) |
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
| `giros_afines` | lista | Op | Giros de la plaza que conviven con este (capa "giros afines" del plano); se comparan con el giro de cada ocupante sin mayúsculas ni acentos |

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
| `seo` | objeto | O | `titulo`, `descripcion`, `imagen_og` (op: URL `https://` o imagen de la carpeta de la plaza; sin ella el build genera una, ver §10) |

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
- **Fotos:** una foto que falta (vacía o en `TODO`: `hero.imagen`, `diferenciales[].imagen`, `modulos[].imagen`, `media.fotos` del local) **no bloquea** `lista` (`esCampoFoto`, `findFotosPendientes` en `src/lib/todos.ts`). En revisión se cuenta en la franja como "fotos pendientes"; en ambos links su lugar lo ocupa una composición con los tokens (`src/components/Composicion.astro`: la cifra del texto en grande, p. ej. "160 mil m²", o el título, sobre el color de marca con un marco de línea fina), nunca un marcador de imagen pendiente. Cualquier otro `TODO` sigue bloqueando.

### 7.6 Datos de demostración (`# DEMO`)

Convención interna, distinta de `TODO`: un valor completo y verosímil que todavía no es un dato confirmado de Chedraui o del prospecto.

- Se marca con un comentario `# DEMO` al final de la línea del valor (`plazo_minimo_meses: 36 # DEMO`). Una marca en la línea de un bloque (`directorio: # DEMO: …`) cubre todo el bloque y cuenta una vez. Un comentario que solo menciona la palabra no cuenta: la marca es el comentario que empieza con `DEMO`.
- El loader las cuenta por archivo (`findDemos` en `src/lib/content.ts`) y el modelo resuelto junta las de los archivos de la presentación (plaza, sus locales, giro, asesor y la presentación) en `demos`.
- La franja de revisión muestra por separado "N pendientes" (bloquean `lista`), "N fotos pendientes" y "N datos de demostración", cada uno con su lista (archivo, línea y valor).
- **En el link de envío no aparece ninguna indicación de que un dato es de demostración**: los valores `# DEMO` se ven como cualquier otro y no bloquean `lista`. `pnpm test:dist` revisa que la página de envío no tenga `TODO`, "demostración", "pendiente" ni marcadores de revisión.
- Antes de operar con Chedraui, cada `# DEMO` se sustituye por el dato real y se quita la marca.

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

Implementación (paso 5): cada sección es un componente de `src/components/sections/` que recibe solo `{ model, kind }` (modelo resuelto con sus cálculos y tipo de link). `Sections.astro` las monta en el orden de `secciones` o el de esta tabla; `PlanoInteractivo` llega en el paso 6 (en revisión deja un aviso). Ritmo: la mayoría en fondo claro; **Portada, Pivote y Cierre a sangre en el color de marca**. Cada sección lleva `data-section` con un id estable de `src/lib/sections.ts` (`portada`, `hero-plaza`, `metricas`, `diferenciales`, `anclas`, `plano-interactivo`, `ficha-local`, `pivote`, `condiciones`, `business-case`, `modulos`, `directorio`, `cierre`, `footer`) que usará el tracking: no cambiarlos. Detalles:
- `Metricas`: contadores que suben al entrar en pantalla (valor final para lectores de pantalla y con movimiento reducido), con fuente y periodo siempre visibles.
- `Portada`: dedicatoria "Para {destinatario} · {marca}" sin repetir la marca si el destinatario ya la nombra (`dedicatoria`, `src/lib/prospecto.ts`), frase principal, `narrativa.apertura` y la línea del local.
- `Condiciones`: tarjeta tipo estado de cuenta por local, con costo del primer año y términos (plazo mínimo, meses de gracia, incremento anual, giros permitidos) cuando existen; en revisión explica el caso pendiente del depósito.
- `Metricas`: la cifra existe una sola vez en el documento; durante la cuenta el texto real queda transparente y encima se pinta una copia decorativa (`aria-hidden`) que se retira al terminar.
- `BusinessCase`: barras de dos tonos (rango sano en `acento_suave`, escenario en `acento`), ventas de equilibrio y simulador con control deslizante. El script del navegador importa `src/lib/calc` (`costoOcupacionPct`, `evaluarRango`); `src/lib/todo.ts` y los cálculos no dependen de Zod para que el navegador no lo cargue.
- `PlanoInteractivo` (`src/components/plano/PlanoNivel.astro`): una sola pantalla con el plano del nivel. **Abre siempre con la planta completa** y el local marcado con un anillo y la etiqueta "Tu local · {clave}"; el botón "Acercar al local" anima el `viewBox` hacia su zona (misma proporción, sin saltos; instantáneo con movimiento reducido) y "Ver la plaza completa" regresa. Los rótulos de anclas, estacionamientos y marina se pintan en HTML sobre el SVG (`etiquetas` en `src/lib/plano/svg.ts`) para leerse a cualquier escala; los de los locales aparecen al acercar. En celular el mapa ocupa todo el ancho. Panel con clave, marca, giro y área al tocar o pulsar Enter sobre cualquier local. Capas bajo "Resalta en el plano", como botones de activar y desactivar con su número de elementos (anclas, restaurantes, accesos, estacionamiento, giros afines al prospecto y ruta desde `ruta.desde` con su texto de cercanía), cada una con un tratamiento distinto para poder combinarlas. "Ver el plano en texto" con el local, vecinos, anclas, accesos y ocupantes para lector de pantalla. La secuencia de zoom región → plaza → planta → local (GSAP y mapa de región) se retiró: no aportaba claridad.
- `Cierre`: WhatsApp al asesor con mensaje prellenado que lo saluda por su nombre de pila (`src/lib/whatsapp.ts`), vigencia y estado de propuesta vencida comprobado en el navegador (`src/lib/vigencia.ts`).

Layout base (`src/layouts/PresentationLayout.astro`): encabezado fijo con fondo, barra de progreso de lectura, `<main>` donde cada sección va dentro de `src/components/Screen.astro` (una idea por pantalla), footer con aviso de privacidad, leyenda de imágenes y crédito de Publifix, franja "Vista previa interna · sin registro" solo en revisión, con pendientes, fotos pendientes y datos de demostración por separado (§7.6), `noindex` y Open Graph desde `seo`, márgenes seguros (`env(safe-area-inset-*)`) y entrada sutil que respeta `prefers-reduced-motion`. Los valores en `TODO` se muestran con `src/components/Field.astro`. La muestra de tokens de cada plaza vive en `/revision/<token_revision>/tokens/`.

Reglas tipográficas (`src/lib/typography.ts`, `Headline.astro`, `Label.astro`):
- **Mayúsculas solo en textos de hasta 5 palabras** (sin contar signos como `·`, `&`, `+`). Ahí va el estilo corto: ancho expandido, mayúsculas y tracking amplio, para etiquetas, nombre de plaza y titulares cortos.
- **Titulares largos (más de 5 palabras) y la cita pivote van en mayúsculas y minúsculas.** Los titulares largos usan el estilo condensado; la cita usa la serif itálica de `cita`, único lugar con serif.
- Los componentes eligen el estilo solos según el número de palabras: usar siempre `Headline` y `Label`, no clases sueltas con mayúsculas.
- **Cifras grandes:** ancho normal, nunca condensado, con números tabulares.
- **Ningún titular desborda a 360 px.** Verificado en el paso más grande de la escala con "PARA RUBÍ PERFUMERÍA" y "EL DORADO CENTRO COMERCIAL & MARINA": el factor `short.size` de Archivo (0.70) lo garantiza (la palabra más ancha, "PERFUMERÍA", mide 306 de 312 px útiles). Al cambiar de familia o de escala, repetir la verificación. `Screen` impide además que una palabra ensanche la pantalla.

Dirección visual: titulares en la familia de display de la plaza, alineada con su identidad (El Dorado: Archivo, ver §14), cuerpo en sans muy legible en celular, cifras con números tabulares, etiquetas en mayúsculas con tracking amplio, líneas finas como separadores, una idea por pantalla, mucho espacio. El encabezado fijo debe tener fondo para que los titulares no se encimen al hacer scroll. Sin sonido. Animaciones de entrada sutiles y respetando `prefers-reduced-motion`.

## 10. Links, vigencia y SEO

- Link de envío: `/p/<token_envio>/`. Link de revisión: `/revision/<token_revision>/`. Mismo contenido; la revisión muestra una franja "Vista previa interna · sin registro" y no carga el tracking.
- Todas las páginas con `noindex, nofollow`; sin sitemap; `robots.txt` bloquea `/p/` y `/revision/`.
- Etiquetas Open Graph personalizadas por presentación para la vista previa de WhatsApp (`seo.titulo`, `seo.descripcion`, `seo.imagen_og` de 1200×630).
- Vigencia: comprobación en el cliente; si la fecha pasó, se muestra un estado de "propuesta vencida" con el contacto del asesor.

Implementación (paso 7):
- **Rutas** (`src/lib/routes.ts`, `src/lib/site.ts`): `/revision/<token_revision>/` para toda presentación y `/p/<token_envio>/` solo en estado `lista`. Cualquier otra ruta, incluido un token inexistente, la sirve GitHub Pages con `src/pages/404.astro`: página sobria con la identidad de Publifix (`src/lib/theme/publifix.ts`, neutra hasta tener la oficial), sin enlaces ni datos de presentaciones. El índice del sitio es una portada neutra que no lista nada. Ninguna página enlaza a otra presentación.
- **Imagen Open Graph** (`src/lib/og.ts`, `src/pages/og/[hash].jpg.ts`): el build genera un JPEG de 1200×630 por presentación con satori + sharp en Archivo: foto hero con capa en `marca` (o solo `marca` si no hay foto), logo de la plaza en `texto_marca`, "Propuesta para {marca}", clave y nombre de la plaza. Se publica en `og/<hash>.jpg`, un hash de los tokens que no revela el id, el prospecto ni los tokens. Si `seo.imagen_og` es una imagen de la plaza, se recorta esa a 1200×630; si es una URL `https://`, se usa tal cual.
- **Metadatos** (`src/lib/meta.ts`): título, descripción, `og:url` absoluta con el base, `og:image` con medidas y alt, `og:site_name`, `twitter:card` `summary_large_image`, favicon con el icono de la plaza y `noindex, nofollow` en todas las páginas. `public/robots.txt` bloquea `/p/` y `/revision/`; no hay integración de sitemap.
- **Vigencia** (`src/lib/vigencia.ts`): un script en línea en el `<head>` (`expiryScript`, misma regla que `isExpired`, probada) marca `<html class="is-vencida">` antes de pintar. En el link de envío se oculta el contenido y queda un estado de propuesta vencida con el logo de la plaza, la marca del prospecto y WhatsApp al asesor para pedir una propuesta actualizada (`mensajeVencida`). En revisión se ve todo el contenido con un aviso de que la propuesta venció. Todo aviso de propuesta vencida va dentro de `src/components/SiVencida.astro`: un `<template>` que un script en línea inserta durante el análisis del HTML solo si la página está vencida, así que mientras la propuesta está vigente el texto "venció" no existe en el documento (no lo leen lectores de pantalla ni extractores de texto). Lo prueban `vigencia.test.ts` (29 de octubre en la zona horaria de México) y `pnpm test:dist` (ningún "venció" fuera de `<template>`).
- **Pruebas:** `src/lib/__fixtures__/2026-12-prueba-lista.yaml` es una presentación en `lista` solo para pruebas (fuera de `CONTENT_DIR`, nunca se publica). `pnpm test:dist` (`scripts/check-dist.mjs`, también en CI después del build) revisa el sitio construido: 404, robots, sin sitemap, ninguna página que liste presentaciones, rutas de envío solo para `lista` y metadatos e imagen OG de cada página.

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
- Imágenes (`content/plazas/el-dorado/media/`, paso 5): `logo-el-dorado.png` (logo vertical), `icono-velero.png` (velero recortado del logo, favicon), `fachada-marina.jpg` (hero), `acceso-nocturno.jpg` (diferencial Legorreta; 662×302 px, **reemplazar por una de mayor resolución**), `marina-panoramica.png` (diferencial marina), `terraza-marina.jpg` (diferencial terrazas). `compras-stock.png` es una foto de stock que no muestra la plaza: no se usa. Pendientes: imágenes de los diferenciales "160 mil m²" y "El Dorado Park", de los módulos, fotos del local (mientras faltan, composiciones con los tokens, §7.5.2). Los logos de anclas y directorio son opcionales: sin ellos, marcas tipográficas. Confirmar derechos de uso de las fotos antes de publicar (el repo es público).
- Identidad: morado con velero blanco; hashtag #ExperienciaElDorado. Morado de marca `#660066` (tomado del PDF de disponibilidad, junio 2026). El logo es una sans en mayúsculas con espaciado amplio y toda su comunicación es sans: la dirección tipográfica es sans, no serif. Aprobado en el paso 4: paleta de `plaza.yaml`, Archivo como única familia (expandido en mayúsculas para etiquetas, nombre de plaza y titulares cortos; condensado para titulares largos) y Newsreader itálica solo en la cita pivote. `acento_suave` `#9a579a` = `#660066` al 66 % sobre blanco, como en el PDF.

- Plano (paso 6): `planos/pb.svg` es un plano esquemático dibujado a partir de la lámina 6 del PDF. La zona del A25+A26 (franja A25+A26, A24, A23, A22, A21; detrás A16+A17, A18, A19, A20) va con detalle; el resto, en bloques. Liverpool, Chedraui Selecto, accesos, estacionamiento y marina están ubicados de forma aproximada. Ocupantes en `plaza.yaml`: logos del plano identificados contra la lámina de directorio (p. 14 del PDF); donde no se leen, una marca de esa lámina que no está en otro local del plano, marcada `# DEMO`, con 9 restaurantes como dice la métrica. Innvictus (A19), Ben & Frank (A5+A6), Las Acamayas (C1+C2+C3+D1) y GNC (C20) se leen en el plano del PDF pero no están en la lámina: se conservan. La ruta del A25+A26 sale del estacionamiento norte con un texto de cercanía `# DEMO`, sin distancias. El dato de locales es la métrica (43 en planta baja); el visor no cuenta los locales dibujados.

**Local A25+A26**
- Nivel: PB. Área: 77.76 m².
- Renta: $17,000 + IVA. Mantenimiento: $2,550 + IVA.
- Depósito: $19,720 según el PDF (ver caso conocido en la sección 8).
- Vecinos visibles en el plano: A23, A22, Innvictus (A19), B3 Studio, A18, A20.

**Prospecto demo 1**
- Marca: Rubí Perfumería. Giro: perfumería. Destinatario: "Equipo Rubí Perfumería" (`# DEMO`). Estado `lista`; datos completos con valores `# DEMO` (narrativa, escenarios de $180,000 / $260,000 / $380,000, rango 8 %–12 %, condiciones y ficha técnica del local, asesora Mariana Ortega, aviso de privacidad y leyenda de imágenes).

**Prospecto demo 2**
- Por definir: otra marca y otro giro (sugerencia: cafetería o accesorios) sobre un local distinto de la misma plaza.

**Pendientes de información:** fotos de buena calidad (local, diferenciales y módulos) y plano vectorial. Todo lo demás tiene un valor `# DEMO` (§7.6) que se sustituirá por el dato confirmado: plazo mínimo, incremento anual, meses de gracia, giros permitidos, ficha técnica, fuente de las métricas, asesor responsable, aviso de privacidad, rango de costo de ocupación y ocupantes no legibles.

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
- Comandos: `pnpm dev`, `pnpm test`, `pnpm build` (incluye `astro check`), `pnpm test:dist` (verifica `dist/` después del build), `pnpm preview`.
- **Solo `main` publica.** `.github/workflows/deploy.yml` corre pruebas y build en cualquier rama y en cada pull request, pero el empaquetado y el job `deploy` exigen `refs/heads/main` (también si se lanza a mano desde Actions). Ninguna otra rama puede publicar; los cambios llegan al sitio solo por merge a `main`.
- Sitio: https://publifix.github.io/chedraui-propuestas/. `site` y `base` están en `astro.config.ts`; toda ruta interna o asset se construye con `withBase()` (`src/lib/paths.ts`), nunca con rutas absolutas escritas a mano. Al conectar el dominio personalizado, ajustar `site`, `base` y las rutas de `public/robots.txt`.
- Variables de entorno: ver `.env.example`. Los valores reales de Supabase viven solo en `.env` local y en los secrets del repo; nunca en código ni en el chat.
- **Flujo de cada paso:** correr `pnpm test`, `pnpm build` y `pnpm test:dist`, hacer commit y push a la rama de trabajo, abrir el pull request hacia `main` y esperar la aprobación en el chat. Con la aprobación, Claude hace el merge, confirma que la corrida de `main` terminó en verde y que el sitio se actualizó.
- El contenido se valida al iniciar `pnpm build` (integración `src/lib/content-validation.ts`): cualquier error de esquema o de referencia detiene el build y se listan todos, en español, con archivo y campo. En `pnpm dev` los errores se reportan sin detener el servidor.
- Datos pendientes: los campos de texto obligatorios usan `"TODO: …"`; los opcionales se omiten con un comentario `# TODO: …`; solo `costo_ocupacion_objetivo` y `ventas_mensuales` aceptan `TODO` en lugar de número. Los datos de demostración llevan `# DEMO` (§7.6).
- Pruebas: el contenido real ya está en `lista`; las pruebas de borrador y pendientes usan `semillaEnBorrador()` (`src/lib/test-utils.ts`), que le agrega `TODO` en memoria.
- El hook `.claude/hooks/session-start.sh` prepara Node 24 y las dependencias en sesiones en la nube.
