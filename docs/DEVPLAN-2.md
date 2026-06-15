# DEVPLAN-2 — PromoCheck: Plan de Transformación

> **Origen**: Profresh Cargo Control — PWA offline-first para operaciones de almacén  
> **Destino**: Mini CRM para promotoras de campo (field promoters CRM)  
> **Stack**: React 18 · TypeScript · Firebase (Firestore + Storage + Auth) · Capacitor · Zustand · Zod · idb · Tailwind CSS

---

## Estado actual (snapshot técnico)

| Componente | Valor actual |
|---|---|
| Colecciones Firestore | `operations`, `clients`, `users`, `audit_log` |
| Stores IndexedDB | `operations`, `photos` — DB name: `cargo-control` v1 |
| Entidad principal | `Operation` (orderNumber, doorNumber, operationType load/unload) |
| Fotos | 17 tipos rígidos: `LoadPhotoType` (6) · `UnloadPhotoType` (8) · `IncidentPhotoType` (3) |
| Roles | `"admin"` \| `"operator"` |
| Feature modules | `auth`, `admin`, `operations`, `camera` |
| Páginas operador | OperatorPage, OperationFormPage, OperationDetailPage, OperatorHistoryPage |
| Páginas admin | AdminPage, AdminUsersPage, AdminClientsPage |

## Estado objetivo (post Fase 4)

| Componente | Valor objetivo |
|---|---|
| Colecciones Firestore | `visits`, `stores`, `products`, `store_products`, `stock_snapshots`, `routes`, `route_stores`, `visit_plans`, `users`, `audit_log` |
| Stores IndexedDB | `visits`, `photos`, `stock_snapshots` — DB name: `promocheck` v3 |
| Entidad principal | `Visit` (visitType, visitDate, overallCondition, notes) |
| Fotos | 4 categorías flexibles: `display` · `cleanliness` · `promo_materials` · `general` (1–N fotos c/u) |
| Roles | `"admin"` \| `"promoter"` (mismo auth, solo labels cambian) |
| Feature modules | `auth`, `admin`, `visits`, `camera`, `stock`, `reports`, `routes` |
| Páginas promotor | PromoterPage, VisitFormPage, VisitDetailPage, PromoterHistoryPage |
| Páginas admin | AdminPage, AdminUsersPage, AdminStoresPage, AdminProductsPage, AdminStoreProductsPage, AdminStockOverviewPage, AdminReportsPage, AdminRoutesPage |

---

## Principios de implementación

1. **No reinventar**: sync engine, camera capture, auth, user management y patrones de tablas/formularios se heredan sin cambios lógicos.
2. **Tipos primero**: cada fase empieza con cambios de TypeScript puros antes de tocar servicios o UI.
3. **Offline-first siempre**: toda escritura nueva (stock_snapshots incluida) pasa por IndexedDB → Firestore via sync engine.
4. **NO modificar en Fase 1**: lógica del sync engine, `useCamera.ts`, `CameraCapture.tsx`, auth system, user management logic.
5. **Un ticket = un PR razonable**: atómico, revisable, deployable en aislamiento.

---

## Árbol de dependencias

```
T1.3/T1.4 ──► T1.5 ──► T1.6, T1.7, T1.8, T1.9
                    ──► T1.10, T1.11
                    ──► T1.12, T1.13, T1.14, T1.15, T1.16

Fase 1 (completa) ──► Fase 2
Fase 2 (completa) ──► Fase 3
Fase 1 + 2        ──► Fase 4
Fase 3 y Fase 4   ──► independientes entre sí
```

---

---

# FASE 1 — Rebrand + Core Genérico

**Objetivo**: Transformar el dominio de "operaciones de carga" a "visitas de promotoras". Sin features nuevas — solo renombrar, refactorizar tipos, y adaptar el sistema de fotos de tipos rígidos a categorías flexibles.

**Restricciones**: No tocar sync engine logic, camera capture logic, auth system, user management logic, PWA/Capacitor setup (solo nombre).

---

### T1.1 — Nuevo Proyecto Firebase

**Descripción**: Crear y configurar el proyecto Firebase de PromoCheck desacoplado de Profresh. Solo setup e infraestructura — sin cambios de código funcional.

**Pasos**:
1. Crear proyectos en Firebase Console: `promocheck-dev` y `promocheck-prod`
2. Habilitar: Authentication (Email/Password), Firestore (modo producción), Storage
3. Crear Web App en cada proyecto → copiar `firebaseConfig`
4. Agregar variables al `.env.local` (no commitear):
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```
5. Crear `.env.example` con las mismas keys sin valores

**Archivos afectados**:
- `.env.local` — **CREAR** (gitignored)
- `.env.example` — **CREAR** (commitear como plantilla)
- `src/services/firebase/firebaseConfig.ts` — leer `import.meta.env.VITE_FIREBASE_*` en lugar de valores hardcodeados

**Criterio de completitud**: `npm run dev` autentica contra el nuevo proyecto; un login de prueba crea user doc en Firestore del proyecto nuevo.

---

### T1.2 — App Metadata: Rebrand

**Descripción**: Cambiar nombre de la app en todos los archivos de configuración. Sin lógica.

**Archivos afectados**:
- `package.json`
  - `"name"`: `"cargo-control"` → `"promocheck"`
- `vite.config.ts`
  - PWA `name`: `"Cargo Control"` → `"PromoCheck"`
  - PWA `short_name`: `"CargoCtrl"` → `"PromoCheck"`
  - PWA shortcut label: `"New Operation"` → `"Nueva Visita"`
  - PWA shortcut URL: `"/operator?action=new"` → `"/promoter?action=new"`
- `capacitor.config.ts`
  - `appId`: `"com.profresh.cargocontrol"` → `"com.promocheck.app"`
  - `appName`: `"Cargo Control"` → `"PromoCheck"`
  - `Camera.iosNSCameraUsageDescription`: `"Para fotografiar operaciones de carga"` → `"Para capturar evidencia fotográfica de visitas a tiendas"`
- `index.html` — `<title>` si existe referencia a "Cargo Control"

**Depende de**: T1.1  
**Criterio de completitud**: PWA instalada muestra "PromoCheck" en launcher; `npx cap sync` no tiene warnings de nombre.

---

### T1.3 — Core Types: Visit, Store, PhotoCategory

**Descripción**: Definir los nuevos tipos TypeScript del dominio. Cambio puro de tipos — sin efecto en runtime. Este ticket es el andamio que habilita todos los demás.

**Archivos afectados**:

`src/types/OperationType.ts` — **ELIMINAR** (load/unload ya no existe)

`src/types/PhotoType.ts` — **ELIMINAR** (17 tipos rígidos reemplazados por 4 categorías)

`src/types/Operation.ts` — **ELIMINAR** (reemplazado por Visit.ts)

`src/types/VisitType.ts` — **CREAR**:
```typescript
export type VisitType = "routine" | "audit" | "special_event"
export type VisitCondition = "good" | "regular" | "bad"
export type VisitStatus = "pending_sync" | "synced" | "approved" | "rejected" | "error"

export const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  routine: "Rutina",
  audit: "Auditoría",
  special_event: "Evento especial",
}
export const VISIT_CONDITION_LABELS: Record<VisitCondition, string> = {
  good: "Buena",
  regular: "Regular",
  bad: "Mala",
}
```

`src/types/PhotoCategory.ts` — **CREAR**:
```typescript
export type PhotoCategory = "display" | "cleanliness" | "promo_materials" | "general"

export const PHOTO_CATEGORY_LABELS: Record<PhotoCategory, string> = {
  display: "Exhibición / Anaquel",
  cleanliness: "Limpieza",
  promo_materials: "Materiales Promocionales",
  general: "General",
}
export const ALL_PHOTO_CATEGORIES: PhotoCategory[] = [...]
export const DEFAULT_REQUIRED_CATEGORIES: PhotoCategory[] = ["display", "cleanliness"]

export interface PhotoRecord {
  url: string
  capturedAt: number
}
// LocalPhoto: una por blob (múltiples por categoría, diferenciadas por sequence)
export interface LocalPhoto {
  id: string
  blob: Blob
  visitId: string      // era operationId
  category: PhotoCategory  // era photoType
  sequence: number    // índice 0-based dentro de la categoría
}
```

`src/types/Visit.ts` — **CREAR**:
```typescript
export interface Visit {
  id: string
  localId: string
  visitType: VisitType
  visitDate: number         // Unix ms del día de visita (user-selected)
  notes?: string
  overallCondition?: VisitCondition
  promoterId: string        // era operatorId
  promoterName: string      // era operatorName
  storeId: string           // era clientId
  storeName: string         // era clientName
  photos: Partial<Record<PhotoCategory, PhotoRecord[]>>
  status: VisitStatus
  createdAt: number
  syncedAt?: number
  errorMessage?: string
  rejectionReason?: string
}
```

`src/types/Store.ts` — **CREAR** (reemplaza el inline `Client` de clientService.ts):
```typescript
export interface Store {
  id: string
  name: string
  address?: string
  storeType: "supermarket" | "convenience" | "pharmacy" | "other"
  chain?: string
  contactName?: string
  contactPhone?: string
  visitFrequency: "weekly" | "biweekly" | "monthly"
  active: boolean
  createdAt: number
  createdBy: string
}
export const STORE_TYPE_LABELS: Record<Store["storeType"], string>
export const VISIT_FREQUENCY_LABELS: Record<Store["visitFrequency"], string>
```

`src/types/UserRole.ts` — mantener `"operator" | "admin"` sin cambio (el auth no cambia). Agregar comentario: `// "operator" se representa como "Promotora" en la UI`.

`src/types/index.ts` — actualizar exports:
- Quitar: `Operation`, `OperationType`, `PhotoType`, `LocalPhoto`, `PhotoRecord` (del viejo Operation.ts)
- Agregar: `Visit`, `VisitType`, `VisitCondition`, `VisitStatus`, `PhotoCategory`, `PhotoRecord`, `LocalPhoto`, `Store`

**Depende de**: (ninguno — es base)  
**Criterio de completitud**: `npx tsc --noEmit` pasa sin errores con los nuevos tipos exportados (los archivos de servicios/páginas compilarán con errores hasta que se actualicen — eso es esperado en este ticket).

---

### T1.4 — Zod Schema: visitSchema

**Descripción**: Reemplazar `operationSchema.ts` con `visitSchema.ts` que valida el formulario de visita.

**Archivos afectados**:
- `src/features/operations/schemas/operationSchema.ts` — **ELIMINAR**
- `src/features/visits/schemas/visitSchema.ts` — **CREAR** (nueva carpeta `visits/`):
  ```typescript
  export const visitSchema = z.object({
    visitType: z.enum(["routine", "audit", "special_event"]),
    visitDate: z.number().int().positive(),
    storeId: z.string().min(1),
    storeName: z.string().min(1).max(100),
    notes: z.string().max(500).optional(),
    overallCondition: z.enum(["good", "regular", "bad"]).optional(),
  })
  export type VisitFormData = z.infer<typeof visitSchema>
  ```
- La validación de fotos (categorías requeridas) se hace en `VisitFormPage` comparando con config cargada de Firestore, no en Zod.

**Depende de**: T1.3  
**Criterio de completitud**: schema importa y parsea correctamente.

---

### T1.5 — IndexedDB Migration: v1 → v2

**Descripción**: Migrar la base IndexedDB de `cargo-control` v1 a `promocheck` v2. Renombrar stores y actualizar schema de `LocalPhoto`. **Crítico**: preservar operaciones pendientes de sincronización convirtiéndolas a formato Visit.

**Archivos afectados**:
- `src/services/offline/db.ts` — modificar:
  - `DB_NAME`: `"cargo-control"` → `"promocheck"`
  - `DB_VERSION`: `1` → `2`
  - Renombrar store `operations` → `visits`
  - Actualizar `LocalPhoto` schema: `operationId → visitId`, `photoType → category`, agregar `sequence: number`
  - Interface `PromoCheckDB` (era `CargoControlDB`):
    ```typescript
    visits: { key: string; value: Visit; indexes: { "by-status": VisitStatus } }
    photos: { key: string; value: LocalPhoto }
    ```
  - En `upgrade(db, oldVersion)`:
    ```typescript
    if (oldVersion < 2) {
      // Leer datos del store viejo antes de eliminarlo
      const oldOps = await db.getAll("operations" as never)
      const oldPhotos = await db.getAll("photos" as never)
      // Eliminar stores viejos
      db.deleteObjectStore("operations" as never)
      db.deleteObjectStore("photos" as never)
      // Crear stores nuevos
      const visitsStore = db.createObjectStore("visits", { keyPath: "id" })
      visitsStore.createIndex("by-status", "status")
      db.createObjectStore("photos", { keyPath: "id" })
      // Migrar datos: mapear Operation → Visit
      for (const op of oldOps) {
        const visit: Visit = {
          ...op,
          visitType: "routine",
          visitDate: op.createdAt,
          storeId: op.clientId,
          storeName: op.clientName,
          promoterId: op.operatorId,
          promoterName: op.operatorName,
          photos: {},  // fotos se pierden en migración (blobs no migrables por categoría)
        }
        await visitsStore.add(visit)
      }
      // Photos: las operaciones pendientes pierden sus blobs (aceptable — solo afecta en dev/test)
    }
    ```
  > **Nota**: La migración de blobs de fotos es impráctica porque los tipos cambian. Operaciones pendientes en producción deben sincronizarse antes del deploy de esta migración. Documentar en release notes.

**Depende de**: T1.3  
**Criterio de completitud**: App arranca sin errores en consola de IndexedDB; store `visits` existe en DevTools > Application > IndexedDB.

---

### T1.6 — Visit Service

**Descripción**: Crear `visitService.ts` reemplazando `operationService.ts`. Misma lógica de queries — solo cambia collection name, field names y tipos.

**Archivos afectados**:
- `src/features/operations/services/operationService.ts` — **ELIMINAR** (al final del ticket, una vez migrados todos los imports)
- `src/features/visits/services/visitService.ts` — **CREAR**:
  - `collection(db, "visits")` en lugar de `"operations"`
  - Mismas funciones renombradas: `fetchAllVisits()`, `fetchVisitsPaginated()`, `fetchVisitsFiltered()`, `fetchVisitsByDateRange()`, `fetchVisitsByPromoter()`, `fetchVisit(id)`, `syncVisitToFirestore()`, `updateVisitStatus()`, `updateVisitPhotos()`, `uploadVisitPhoto(visitId, category, sequence, blob)`
  - Tipo de retorno `Visit` en lugar de `Operation`
  - `uploadVisitPhoto`: Storage path `visits/{visitId}/{category}_{sequence}_{timestamp}.jpg`
  - `fetchVisitsFiltered` acepta `{ storeId?, visitType?, dateFrom?, dateTo? }` en lugar de `{ clientId?, operationType? }`
  - `VISITS_PER_PAGE = 20` (mismo valor)

**Depende de**: T1.3, T1.5  
**Criterio de completitud**: funciones exportadas tipan correctamente; las queries de Firestore usan `"visits"`.

---

### T1.7 — Store Service

**Descripción**: Crear `storeService.ts` reemplazando `clientService.ts`. Añadir soporte para los campos nuevos de `Store`.

**Archivos afectados**:
- `src/features/admin/services/clientService.ts` — **ELIMINAR**
- `src/features/admin/services/storeService.ts` — **CREAR**:
  - `collection(db, "stores")` en lugar de `"clients"`
  - Mismas funciones renombradas: `fetchActiveStores()`, `fetchAllStores()`, `createStore(data)`, `updateStore(id, data)`, `deactivateStore(id)`, `reactivateStore(id)`, `storeHasVisits(id)`, `deleteStore(id)`
  - `createStore` acepta `Pick<Store, "name" | "address" | "storeType" | "chain" | "contactName" | "contactPhone" | "visitFrequency">` + `createdBy: string`
  - `updateStore` acepta `Partial<Omit<Store, "id" | "createdAt" | "createdBy">>`

**Depende de**: T1.3  
**Criterio de completitud**: CRUD de tiendas funciona en Firestore `stores` collection.

---

### T1.8 — Visit Zustand Store

**Descripción**: Crear `visitStore.ts` reemplazando `operationStore.ts`. Misma estructura de estado — tipos actualizados.

**Archivos afectados**:
- `src/features/operations/store/operationStore.ts` — **ELIMINAR**
- `src/features/visits/store/visitStore.ts` — **CREAR**:
  ```typescript
  interface VisitState {
    visits: Visit[]
    loading: boolean
    error: string | null
    pendingSyncCount: number
    lastSyncedAt: number | null
  }
  // Actions: setVisits, addVisit, updateVisit, removeVisit, setPendingSyncCount, setLastSyncedAt, ...
  ```
  Misma lógica de selectores que `operationStore`.

**Depende de**: T1.3  
**Criterio de completitud**: store importa y compila; el tipo `Visit[]` es el del state.

---

### T1.9 — Sync Engine: Renombrar Referencias

**Descripción**: Actualizar el sync engine para usar los tipos y stores de Visit. **No cambiar la lógica** (retry, backoff, progress tracking, background sync interval — todo idéntico).

**Archivos afectados**:
- `src/services/offline/syncEngine.ts`:
  - Importar `Visit`, `LocalPhoto` (nuevo), `visitService` en lugar de `operationService`
  - `db.getAll("visits")` en lugar de `"operations"`
  - `db.getAll("photos")` filtrado por `photo.visitId` en lugar de `photo.operationId`
  - Pasar `category` y `sequence` a `uploadVisitPhoto()` en lugar de `photoType`
  - `SyncResult.visitId` en lugar de `operationId`
  - `saveVisitLocally()` en lugar de `saveOperationLocally()`
  - Comentario de documentación al tope: `// Sync engine — lógica sin cambios, solo tipos Visit`
- `src/services/offline/db.ts` — ya actualizado en T1.5, verificar que los tipos `Visit` y `LocalPhoto` importan correctamente aquí

**Depende de**: T1.3, T1.5, T1.6  
**Criterio de completitud**: `syncPendingVisits()` se ejecuta sin errores de tipo; visitas pendientes se sincronizan en Firestore `visits` collection.

---

### T1.10 — useVisits Hook

**Descripción**: Crear `useVisits.ts` reemplazando `useOperations.ts`. Misma API pública, tipos actualizados.

**Archivos afectados**:
- `src/features/operations/hooks/useOperations.ts` — **ELIMINAR**
- `src/features/visits/hooks/useVisits.ts` — **CREAR**:
  - `loadLocalVisits()`, `loadServerVisits(pageParam?)`, `syncPendingVisits()`, `saveVisitOffline(visit, photos)`, `refreshPendingCount()`
  - `saveVisitOffline` acepta `Visit` + `Map<string, Blob[]>` (donde key = PhotoCategory, value = array de blobs en orden)

**Depende de**: T1.6, T1.8, T1.9  
**Criterio de completitud**: hook exporta las mismas funciones que el viejo con tipos correctos.

---

### T1.11 — Firestore Security Rules

**Descripción**: Actualizar `firestore.rules` para las colecciones `visits` y `stores`, con validación de los nuevos campos.

**Archivos afectados**:
- `firestore.rules`:
  - Renombrar bloque `/operations/{id}` → `/visits/{id}`
  - Actualizar validación de campos en create/update:
    - Quitar: `orderNumber`, `doorNumber`, `operationType`
    - Agregar: `visitType` (enum), `visitDate` (int), `promoterId`, `storeId`
    - `notes` y `overallCondition` opcionales
  - Renombrar bloque `/clients/{id}` → `/stores/{id}`
  - Actualizar validación de Store: agregar `storeType`, `visitFrequency`; hacer opcionales `address`, `chain`, `contactName`, `contactPhone`
  - En helpers `isOperator()` / `isAdmin()`: sin cambios (usan `role == "operator"` / `role == "admin"`)
  - Agregar colección `/config/{docId}`:
    - **read**: autenticados
    - **write**: solo admins

**Depende de**: T1.3  
**Criterio de completitud**: `firebase deploy --only firestore:rules` sin errores; emulator tests pasan para create/update de visits.

---

### T1.12 — Firebase Storage Rules

**Descripción**: Actualizar `storage.rules` para los nuevos paths de fotos de visitas.

**Archivos afectados**:
- `storage.rules`:
  - Path `match /operations/{operationId}/{photoType}` → `match /visits/{visitId}/{fileName}`
  - `fileName` incluye category, sequence y timestamp (ej: `display_0_1700000000000.jpg`)
  - Validación de write: mismo dueño de la visita (lookup en Firestore `visits`)
  - Validación de tamaño (< 10MB) y MIME (`image/*`): sin cambios
  - **delete**: bloqueado (sin cambios)

**Depende de**: T1.11  
**Criterio de completitud**: `firebase deploy --only storage` sin errores; upload de foto desde app funciona en nueva ruta.

---

### T1.13 — CategoryPhotoCapture Component

**Descripción**: Crear un wrapper sobre `CameraCapture` que gestione múltiples fotos por categoría. `CameraCapture.tsx` y `useCamera.ts` no se modifican.

**Archivos afectados**:
- `src/features/camera/components/CameraCapture.tsx` — **SIN CAMBIOS**
- `src/features/camera/hooks/useCamera.ts` — **SIN CAMBIOS**
- `src/features/camera/components/CategoryPhotoCapture.tsx` — **CREAR**:
  ```typescript
  interface Props {
    category: PhotoCategory
    label: string
    required: boolean
    blobs: Blob[]                          // fotos ya capturadas en esta sesión
    onPhotosChange: (blobs: Blob[]) => void
  }
  ```
  - Muestra miniaturas de los blobs capturados
  - Botón "+ Agregar foto" abre `CameraCapture` (sin límite de N, UI práctica)
  - Botón de eliminar por foto
  - Indicador visual si `required && blobs.length === 0`

**Depende de**: T1.3  
**Criterio de completitud**: component renders fotos existentes; permite agregar y eliminar; callback `onPhotosChange` se dispara correctamente.

---

### T1.14 — VisitFormPage

**Descripción**: Reemplazar `OperationFormPage.tsx` con `VisitFormPage.tsx`. El formulario ahora recoge `visitType`, `visitDate`, `overallCondition`, `notes`, y fotos organizadas por categoría flexible.

**Archivos afectados**:
- `src/pages/OperationFormPage.tsx` — **ELIMINAR**
- `src/pages/VisitFormPage.tsx` — **CREAR**:
  - Sección 1 — Datos de visita: `visitType` (select), `visitDate` (date input, default hoy), `storeId` (dropdown de tiendas activas), `overallCondition` (radio buttons)
  - Sección 2 — Fotos: una instancia de `CategoryPhotoCapture` por cada `PhotoCategory`, marcadas con `required` según config (`config/photo_requirements` doc en Firestore)
  - Sección 3 — Notas: textarea opcional (max 500 chars)
  - Submit: valida con `visitSchema` + valida fotos requeridas → `saveVisitOffline()`
  - Modo edición: igual que antes, si `status` en `["pending_sync", "rejected"]`
  - Ruta: `/visit/new` y `/visit/:id/edit`

**Depende de**: T1.4, T1.10, T1.13  
**Criterio de completitud**: formulario guarda visit en IndexedDB con fotos organizadas por categoría; `status = "pending_sync"`.

---

### T1.15 — PromoterPage, VisitDetailPage, PromoterHistoryPage

**Descripción**: Renombrar y actualizar las tres páginas del rol promotora.

**Archivos afectados**:
- `src/pages/OperatorPage.tsx` → `src/pages/PromoterPage.tsx`:
  - Label "Operador" → "Promotora"
  - "Operaciones recientes" → "Visitas recientes"
  - Usa `useVisits` en lugar de `useOperations`
  - Botón FAB: "Nueva Operación" → "Nueva Visita"
- `src/pages/OperationDetailPage.tsx` → `src/pages/VisitDetailPage.tsx`:
  - Muestra campos Visit: visitType, visitDate, overallCondition, notes
  - Fotos agrupadas por categoría (no lista plana de tipos)
  - Labels: "Tienda" en lugar de "Cliente", "Promotora" en lugar de "Operador"
- `src/pages/OperatorHistoryPage.tsx` → `src/pages/PromoterHistoryPage.tsx`:
  - Usa `fetchVisitsByPromoter()` en lugar de `fetchOperationsByOperator()`
  - Filtros: visitType, fechas (quitar operationType)
- `src/pages/AdminPage.tsx` — actualizar:
  - "Operaciones" → "Visitas"
  - Filtros: `storeId` en lugar de `clientId`, `visitType` en lugar de `operationType`
  - Columnas de tabla: quitar orderNumber/doorNumber, agregar visitType/visitDate/overallCondition
  - Botón de aprobación/rechazo: sin cambios de lógica

**Depende de**: T1.10, T1.14  
**Criterio de completitud**: promotora ve sus visitas; detail muestra fotos por categoría; admin ve lista paginada con nuevos campos.

---

### T1.16 — Admin Stores Page + Router + Nav + Global Copy

**Descripción**: Renombrar AdminClientsPage a AdminStoresPage con nuevos campos de Store; actualizar el router con todas las rutas nuevas; actualizar la navegación; barrer todos los textos de UI restantes.

**Archivos afectados**:
- `src/pages/AdminClientsPage.tsx` → `src/pages/AdminStoresPage.tsx`:
  - Tabla agrega columnas: storeType, chain, visitFrequency
  - Modal crear/editar incluye: address, storeType, chain, contactName, contactPhone, visitFrequency
  - Label "Clientes" → "Tiendas"
- `src/app/router.tsx`:
  - `/operator` → `/promoter`
  - `/operation/new` → `/visit/new`
  - `/operation/:id` → `/visit/:id`
  - `/operation/:id/edit` → `/visit/:id/edit`
  - `/operator/history` → `/promoter/history`
  - `/admin/clients` → `/admin/stores`
  - Componentes: OperatorPage→PromoterPage, OperationFormPage→VisitFormPage, etc.
  - `allowedRoles={["operator"]}` → `allowedRoles={["operator"]}` (sin cambio — auth role sigue siendo "operator")
- `src/shared/constants/navItems.tsx`:
  - `OPERATOR_NAV` → `PROMOTER_NAV` (o renombrar export pero mantener compatibilidad)
  - Labels nav: "Inicio"/"Historial" sin cambio; tooltips "Operador" → "Promotora"
  - `ADMIN_NAV`: "Clientes" → "Tiendas", ruta `/admin/stores`
- Barrido de copy en todos los archivos restantes:
  - Toast messages en `operationService.ts` → `visitService.ts`
  - Empty state texts en `PromoterPage`, `PromoterHistoryPage`, `AdminPage`
  - `AdminUsersPage.tsx`: "Operador" → "Promotora" en labels y dropdowns de rol
  - `CreateUserModal.tsx` / `EditUserModal.tsx`: label rol "operator" → "Promotora"
  - `PendingApprovalPage.tsx`: texto de espera si hace referencia a rol

**Depende de**: T1.7, T1.14, T1.15  
**Criterio de completitud**: app navega correctamente por todas las rutas; no queda ningún texto "cargo", "carga", "operation", "operator", "client" en la UI visible.

---

---

# FASE 2 — Stock Management

**Objetivo**: Añadir conteo de stock (shelfQty + backroomQty por producto) dentro de cada visita, con catálogo de productos administrable, configuración por tienda, y dashboard de stock para admins.

**Dependencia**: Fase 1 completa (Visit y Store ya definidos).

**Principio clave**: Los `stock_snapshots` siguen exactamente el mismo patrón offline/sync que las visitas — IndexedDB first, sync al guardar la visita.

---

### T2.1 — Types + Schemas: Product, StoreProduct, StockSnapshot

**Descripción**: Definir los tipos TypeScript y schemas Zod para el módulo de stock.

**Archivos afectados**:
- `src/types/Product.ts` — **CREAR**:
  ```typescript
  export interface Product {
    id: string
    name: string
    sku: string
    unit: "unit" | "pack" | "box"
    defaultMinThreshold: number
    active: boolean
    createdAt: number
  }
  ```
- `src/types/StoreProduct.ts` — **CREAR**:
  ```typescript
  export interface StoreProduct {
    id: string
    storeId: string
    productId: string
    minThreshold: number   // override del defaultMinThreshold
    active: boolean
    createdAt: number
  }
  ```
- `src/types/StockSnapshot.ts` — **CREAR**:
  ```typescript
  export interface StockSnapshot {
    id: string
    visitId: string
    storeId: string
    productId: string
    shelfQty: number
    backroomQty: number
    totalQty: number              // shelfQty + backroomQty
    needsReorder: boolean         // totalQty < minThreshold
    capturedAt: number
    capturedById: string
    status: "pending_sync" | "synced"
  }
  ```
- `src/types/index.ts` — agregar exports
- `src/features/stock/schemas/stockSchema.ts` — **CREAR**:
  ```typescript
  export const productSchema = z.object({ name, sku, unit, defaultMinThreshold, active })
  export const stockCountSchema = z.object({  // validación por línea de conteo
    productId: z.string(),
    shelfQty: z.number().int().min(0),
    backroomQty: z.number().int().min(0),
  })
  ```

**Depende de**: T1.3 (tipos base Visit/Store ya definidos)  
**Criterio de completitud**: `tsc --noEmit` pasa con los nuevos tipos.

---

### T2.2 — Product Service

**Descripción**: CRUD de productos en Firestore collection `products`. Mismos patrones que storeService.

**Archivos afectados**:
- `src/features/stock/services/productService.ts` — **CREAR**:
  - `fetchActiveProducts()` — lista activos, ordenados por name
  - `fetchAllProducts()` — lista todos (para admin)
  - `createProduct(data)` — addDoc en `products`
  - `updateProduct(id, data)` — updateDoc
  - `deactivateProduct(id)` — soft delete (`active: false`)
  - `reactivateProduct(id)` — restaurar

**Depende de**: T2.1  
**Criterio de completitud**: CRUD funciona en emulator.

---

### T2.3 — StoreProduct Service

**Descripción**: Gestionar qué productos maneja cada tienda y sus umbrales mínimos.

**Archivos afectados**:
- `src/features/stock/services/storeProductService.ts` — **CREAR**:
  - `fetchStoreProducts(storeId)` — lista activos de una tienda
  - `fetchStoreProductsWithDetails(storeId)` — join con `products` collection (Promise.all de getDoc por productId)
  - `setStoreProduct(storeId, productId, minThreshold)` — upsert en `store_products`
  - `deactivateStoreProduct(id)` — soft delete

**Depende de**: T2.2  
**Criterio de completitud**: admin puede asignar producto a tienda con umbral custom.

---

### T2.4 — StockSnapshot Service + IndexedDB Store

**Descripción**: Service de snapshots + agregar `stock_snapshots` store al IndexedDB (versión 3).

**Archivos afectados**:
- `src/services/offline/db.ts`:
  - `DB_VERSION`: `2` → `3`
  - Agregar store `stock_snapshots: { key: string; value: StockSnapshot; indexes: { "by-visit": string, "by-status": string } }`
  - En `upgrade`: `if (oldVersion < 3)` crear el store con índices `by-visit` (visitId) y `by-status` (status)
- `src/features/stock/services/stockSnapshotService.ts` — **CREAR**:
  - `saveSnapshotsOffline(snapshots: StockSnapshot[])` — guarda en IndexedDB
  - `syncSnapshotsToFirestore(visitId)` — sube todos los snapshots de esa visita a `stock_snapshots` collection
  - `fetchSnapshotsByStore(storeId, limit?)` — últimos N snapshots por tienda
  - `fetchSnapshotsByVisit(visitId)` — todos los snapshots de una visita
  - `fetchLatestSnapshotByStoreProduct(storeId, productId)` — último snapshot

**Depende de**: T2.1  
**Criterio de completitud**: IndexedDB v3 crea el store; snapshot guarda y sincroniza sin errores.

---

### T2.5 — Sync Engine: Stock Snapshots

**Descripción**: Incluir sincronización de `stock_snapshots` en el sync engine. **Agregar después de sync de visit**, sin modificar la lógica de sync de fotos.

**Archivos afectados**:
- `src/services/offline/syncEngine.ts`:
  - En `syncOperationWithRetry` (ahora `syncVisitWithRetry`): después de sincronizar la visita y sus fotos, obtener snapshots pendientes de esa visita desde IndexedDB y llamar `syncSnapshotsToFirestore(visitId)`
  - `SyncResult` agregar campo `snapshotsSynced: number`
  - `cleanupSyncedPhotos()`: sin cambios

**Depende de**: T1.9, T2.4  
**Criterio de completitud**: al sincronizar una visita con conteos, los snapshots aparecen en Firestore `stock_snapshots`.

---

### T2.6 — Admin: Products CRUD Page

**Descripción**: Nueva página de administración de catálogo de productos. Mismo patrón visual y funcional que `AdminStoresPage`.

**Archivos afectados**:
- `src/pages/AdminProductsPage.tsx` — **CREAR**:
  - Tabla con columnas: name, sku, unit, defaultMinThreshold, active, acciones
  - Modal crear: name, sku, unit (select), defaultMinThreshold (number input)
  - Modal editar: mismos campos
  - Toggle active/inactive con confirmación
  - Buscador por name/sku (client-side sobre lista cargada)
- `src/app/router.tsx` — agregar ruta `/admin/products` → `AdminProductsPage`
- `src/shared/constants/navItems.tsx` — agregar "Productos" al `ADMIN_NAV`

**Depende de**: T2.2, T1.16 (router ya actualizado)  
**Criterio de completitud**: admin puede crear, editar y desactivar productos; cambios persisten en Firestore.

---

### T2.7 — Admin: Store-Product Configuration Page

**Descripción**: Vista para que el admin configure qué productos maneja cada tienda y el umbral mínimo.

**Archivos afectados**:
- `src/pages/AdminStoreProductsPage.tsx` — **CREAR**:
  - Selector de tienda (dropdown o lista con buscador)
  - Una vez seleccionada la tienda: tabla de todos los productos activos con toggle "asignado" y campo `minThreshold` editable
  - Guardar cambios por producto individual (no batch)
  - Indicador visual de cuántos productos asignados tiene la tienda
- `src/app/router.tsx` — agregar ruta `/admin/stores/:storeId/products` → `AdminStoreProductsPage`
- `src/pages/AdminStoresPage.tsx` — agregar link/botón "Configurar productos" por tienda en la tabla

**Depende de**: T2.3, T2.6  
**Criterio de completitud**: admin asigna productos a tienda; `store_products` docs creados en Firestore; umbrales custom persisten.

---

### T2.8 — Admin: Stock Overview Dashboard

**Descripción**: Dashboard de tabla tiendas × productos con último conteo y semáforo de estado.

**Archivos afectados**:
- `src/pages/AdminStockOverviewPage.tsx` — **CREAR**:
  - Carga: `fetchActiveStores()` + `fetchActiveProducts()` + últimos snapshots por store/product via `fetchLatestSnapshotByStoreProduct()`
  - Tabla: filas = tiendas, columnas = productos, celda = totalQty con color:
    - Rojo: `totalQty < minThreshold`
    - Amarillo: `totalQty < minThreshold * 1.5`
    - Verde: `totalQty >= minThreshold * 1.5`
    - Gris: sin datos (sin snapshot)
  - Tooltip en celda: shelfQty, backroomQty, minThreshold, fecha del último conteo
  - Filtro por tienda y por producto (para tablas grandes)
- `src/app/router.tsx` — agregar ruta `/admin/stock` → `AdminStockOverviewPage`
- `src/shared/constants/navItems.tsx` — agregar "Stock" al `ADMIN_NAV`

**Depende de**: T2.4  
**Criterio de completitud**: dashboard carga correctamente; semáforos muestran estado correcto vs. umbrales; sin snapshots muestra gris.

---

### T2.9 — Promotor: Stock Counting en VisitFormPage

**Descripción**: Agregar sección de conteo de stock al formulario de visita. Solo aparece si la tienda tiene productos asignados.

**Archivos afectados**:
- `src/features/stock/components/StockCountingForm.tsx` — **CREAR**:
  ```typescript
  interface Props {
    storeId: string
    onCountsChange: (counts: StockCountEntry[]) => void
  }
  export interface StockCountEntry {
    productId: string
    productName: string
    shelfQty: number
    backroomQty: number
    minThreshold: number
  }
  ```
  - Carga `fetchStoreProductsWithDetails(storeId)` al mount
  - Lista de filas: productName + dos inputs numéricos (shelfQty, backroomQty) + totalQty calculado en tiempo real
  - Indicador rojo si `totalQty < minThreshold`
- `src/pages/VisitFormPage.tsx` — agregar:
  - Sección 4 — Conteo de Stock: instancia de `StockCountingForm` si `storeId` tiene productos
  - En `saveVisitOffline`: además de guardar la visita, construir `StockSnapshot[]` desde los conteos y guardar con `saveSnapshotsOffline()`
  - `needsReorder = (shelfQty + backroomQty) < minThreshold` calculado aquí
- `src/features/stock/hooks/useStock.ts` — **CREAR**:
  - `loadStoreProducts(storeId)`, `saveStockCounts(visitId, counts)`

**Depende de**: T2.3, T2.4, T1.14  
**Criterio de completitud**: al completar visita con conteos, snapshots en IndexedDB; al sincronizar, en Firestore.

---

---

# FASE 3 — Forecasting + Reportes

**Objetivo**: Añadir inteligencia sobre los datos de stock acumulados: forecasting client-side, alertas de stock crítico, y suite de reportes para admins.

**Dependencia**: Fase 2 completa (necesita `stock_snapshots` con al menos 2 snapshots por tienda/producto para forecasting).

**Principio clave**: Todo el forecasting es client-side sobre datos ya en Firestore — no hay backend nuevo.

---

### T3.1 — Forecasting Service

**Descripción**: Servicio client-side que calcula consumo y días de inventario a partir de snapshots históricos.

**Archivos afectados**:
- `src/features/reports/services/forecastingService.ts` — **CREAR**:
  ```typescript
  interface ForecastResult {
    storeId: string
    productId: string
    currentStock: number
    dailyConsumptionAvg: number   // consumo entre snapshots / días entre snapshots
    daysOfInventory: number       // currentStock / dailyConsumptionAvg
    suggestedOrderQty: number     // maxThreshold - currentStock (si se define maxThreshold)
    dataPoints: number            // número de snapshots usados
    lastSnapshotAt: number
  }
  ```
  - `calculateForecast(storeId, productId)`: obtiene últimos N snapshots ordenados por `capturedAt`, calcula consumo entre pares consecutivos, promedia
  - Requiere mínimo 2 snapshots; si hay menos, retorna `{ daysOfInventory: null, dailyConsumptionAvg: null }`
  - `calculateBulkForecast(storeIds, productIds)`: Promise.all de calculateForecast, para cargar dashboard

**Depende de**: T2.4 (stockSnapshotService)  
**Criterio de completitud**: cálculo correcto con datos de prueba (2+ snapshots); retorna null gracefully con 0-1 snapshots.

---

### T3.2 — Alert Service

**Descripción**: Servicio que genera lista de alertas de stock crítico basadas en días de inventario.

**Archivos afectados**:
- `src/features/reports/services/alertService.ts` — **CREAR**:
  ```typescript
  interface StockAlert {
    storeId: string
    storeName: string
    productId: string
    productName: string
    currentStock: number
    daysOfInventory: number
    urgency: "critical" | "warning"   // critical < threshold, warning < threshold * 1.5
    suggestedOrderQty: number
  }
  ```
  - `DEFAULT_ALERT_THRESHOLD_DAYS = 7`
  - `fetchStockAlerts(thresholdDays?)`: carga stores activos + productos + últimos snapshots → llama forecastingService → filtra donde `daysOfInventory < thresholdDays`
  - Ordenado por urgencia (critical primero) y luego `daysOfInventory` asc
  - La configuración del umbral de días se lee de `config/alert_settings` Firestore doc (o usa default)

**Depende de**: T3.1  
**Criterio de completitud**: retorna alertas ordenadas correctamente; stores sin datos no generan alertas falsas.

---

### T3.3 — Admin: Reporte de Cobertura de Visitas

**Descripción**: Tabla que muestra % de tiendas visitadas en un período dado vs. su frecuencia configurada.

**Archivos afectados**:
- `src/features/reports/components/CoverageReport.tsx` — **CREAR**:
  - Props: `{ dateFrom: Date, dateTo: Date }`
  - Lógica: `fetchActiveStores()` → para cada tienda calcular visitas esperadas según `visitFrequency` en el período → comparar con visitas reales (`fetchVisitsByDateRange`)
  - Tabla: tienda, frecuencia, visitas esperadas, visitas realizadas, % cobertura, última visita
  - Código de color: verde ≥ 100%, amarillo 50-99%, rojo < 50%
- `src/pages/AdminReportsPage.tsx` — **CREAR** (página contenedora para todos los reportes de Fase 3):
  - Tabs: Cobertura / Stock Health / Alertas / Actividad Promotoras / Buscar Evidencias
  - Renderiza el componente activo según tab
- `src/app/router.tsx` — ruta `/admin/reports` → `AdminReportsPage`
- `src/shared/constants/navItems.tsx` — agregar "Reportes" al `ADMIN_NAV`

**Depende de**: T1.6 (visitService), T1.7 (storeService)  
**Criterio de completitud**: reporte calcula cobertura correctamente; cambiar rango de fechas actualiza tabla.

---

### T3.4 — Admin: Stock Health Heatmap

**Descripción**: Vista de heatmap/tabla colorida de estado de stock en `AdminReportsPage`, tab "Stock Health".

**Archivos afectados**:
- `src/features/reports/components/StockHealthReport.tsx` — **CREAR**:
  - Similar al `AdminStockOverviewPage` (T2.8) pero enriquecido con `daysOfInventory` del forecastingService
  - Celda muestra: `totalQty` y `daysOfInventory` (si disponible)
  - Semáforo por días de inventario en lugar de solo por umbral
  - Exportar a CSV (ver T3.8)
- Integrar en `src/pages/AdminReportsPage.tsx` bajo tab "Stock Health"

**Depende de**: T2.8, T3.1  
**Criterio de completitud**: heatmap muestra días de inventario; cells sin forecast muestran solo stock.

---

### T3.5 — Admin: Página de Alertas

**Descripción**: Lista ordenada de alertas de stock crítico, tab "Alertas" en `AdminReportsPage`.

**Archivos afectados**:
- `src/features/reports/components/AlertsReport.tsx` — **CREAR**:
  - Carga `fetchStockAlerts()`
  - Tabla: tienda, producto, stock actual, días de inventario, urgencia (badge rojo/amarillo), pedido sugerido
  - Ordenado: critical primero, luego warning; dentro de cada grupo, menor `daysOfInventory` primero
  - Input para configurar umbral de días (escribe a `config/alert_settings`)
- Integrar en `src/pages/AdminReportsPage.tsx`

**Depende de**: T3.2  
**Criterio de completitud**: alertas aparecen ordenadas; cambiar umbral re-calcula lista.

---

### T3.6 — Admin: Reporte de Actividad de Promotoras

**Descripción**: Tabla de actividad por promotora (visitas, fotos, conteos) en un período. Tab "Actividad Promotoras".

**Archivos afectados**:
- `src/features/reports/services/activityService.ts` — **CREAR**:
  - `fetchPromoterActivity(dateFrom, dateTo)`: agrupa visitas por promoter, cuenta visitas realizadas, suma total de fotos (sum of array lengths en cada PhotoCategory), cuenta stock_snapshots
  - Retorna `PromoterActivity[]`
- `src/features/reports/components/PromoterActivityReport.tsx` — **CREAR**:
  - Selector de rango de fechas
  - Tabla: promotora, visitas realizadas, fotos capturadas, conteos registrados, última visita
  - Ordenado por visitas desc
- Integrar en `src/pages/AdminReportsPage.tsx`

**Depende de**: T1.6  
**Criterio de completitud**: actividad calcula correctamente; cambiar fechas actualiza tabla.

---

### T3.7 — Admin: Buscador de Evidencias (fotos)

**Descripción**: Galería de fotos filtrable por tienda, fecha y categoría. Tab "Buscar Evidencias".

**Archivos afectados**:
- `src/features/reports/components/EvidenceSearch.tsx` — **CREAR**:
  - Filtros: tienda (dropdown), fecha desde/hasta, categoría (multi-select de PhotoCategory)
  - Carga visitas según filtros con `fetchVisitsFiltered()`
  - Expande fotos de las visitas en grid de miniaturas (URL de Storage)
  - Click en miniatura → lightbox con URL completo y metadata (tienda, fecha, categoría, promotora)
  - "Descargar ZIP" por visita → reutilizar `downloadOperationZip` (renombrado a `downloadVisitZip`)
- `src/features/admin/utils/downloadOperationZip.ts` → `downloadVisitZip.ts` — renombrar, actualizar para iterar `PhotoCategory[]` en lugar de tipos fijos
- Integrar en `src/pages/AdminReportsPage.tsx`

**Depende de**: T1.15 (fotos por categoría en VisitDetailPage ya funciona)  
**Criterio de completitud**: filtros retornan fotos correctas; ZIP descargable por visita.

---

### T3.8 — CSV Export para Datos de Stock

**Descripción**: Agregar botón "Exportar CSV" en `StockHealthReport` y en el buscador de alertas.

**Archivos afectados**:
- `src/features/reports/utils/exportCsv.ts` — **CREAR**:
  ```typescript
  export function exportToCsv(filename: string, rows: Record<string, unknown>[]): void
  // Construye CSV string, crea Blob, dispara descarga via <a> temporal
  ```
- `src/features/reports/components/StockHealthReport.tsx` — botón "Exportar CSV" que llama `exportToCsv("stock_health.csv", rows)`
- `src/features/reports/components/AlertsReport.tsx` — idem para alertas
- `src/features/admin/utils/downloadVisitZip.ts` — sin cambios en Fase 3

**Depende de**: T3.4, T3.5  
**Criterio de completitud**: CSV descargado contiene todas las filas visibles; abre correctamente en Excel con columnas correctas.

---

---

# FASE 4 — Rutas

**Objetivo**: Permitir al admin definir rutas con tiendas y frecuencia, asignarlas a promotoras, y que las promotoras vean su ruta del día/semana con visitas pendientes.

**Dependencia**: Fase 1 completa (Visit, Store definidos) + Fase 2 recomendada (para validar stock en ruta).

**Nota de complejidad**: Esta es la fase más compleja. Las otras tres son de alto valor con complejidad manejable; ésta tiene más interdependencias UI y lógica de planning.

---

### T4.1 — Types + Services: Route, RouteStore, VisitPlan

**Descripción**: Definir tipos y services de las tres nuevas colecciones Firestore.

**Archivos afectados**:
- `src/types/Route.ts` — **CREAR**:
  ```typescript
  export interface Route {
    id: string
    name: string
    promoterId: string
    active: boolean
    createdAt: number
  }
  export interface RouteStore {
    id: string
    routeId: string
    storeId: string
    order: number           // posición en la ruta
    visitFrequency: "weekly" | "biweekly" | "monthly"
    active: boolean
    createdAt: number
  }
  export interface VisitPlan {
    id: string
    routeId: string
    storeId: string
    promoterId: string
    plannedDate: number     // Unix ms del día planificado
    status: "pending" | "completed" | "missed"
    visitId?: string        // populated cuando la visita se realiza
    createdAt: number
  }
  ```
- `src/types/index.ts` — agregar exports
- `src/features/routes/services/routeService.ts` — **CREAR**:
  - `fetchRoutes()`, `fetchRoute(id)`, `createRoute(data)`, `updateRoute(id, data)`, `deactivateRoute(id)`
  - `fetchRouteStores(routeId)`, `addStoreToRoute(routeId, storeId, order, freq)`, `removeStoreFromRoute(id)`, `reorderRouteStore(id, newOrder)`
- `src/features/routes/services/visitPlanService.ts` — **CREAR**:
  - `generateVisitPlans(routeId, weekStart: Date)` — genera `VisitPlan[]` según frecuencias
  - `fetchVisitPlansByPromoter(promoterId, weekStart)` — planes de la semana
  - `markPlanCompleted(planId, visitId)` — llamado al guardar una visita
  - `fetchMissedPlans(promoterId)` — planes `"pending"` con `plannedDate < now()`

**Depende de**: T1.3 (Visit, Store), T1.6, T1.7  
**Criterio de completitud**: servicios compilan; `generateVisitPlans` crea planes correctos para cada frecuencia.

---

### T4.2 — Admin: Route Management Page

**Descripción**: CRUD de rutas. Admin crea/edita/elimina rutas y las asigna a promotoras.

**Archivos afectados**:
- `src/pages/AdminRoutesPage.tsx` — **CREAR**:
  - Tabla de rutas: nombre, promotora asignada, número de tiendas, estado (activo/inactivo)
  - Modal crear: nombre, promotora (dropdown de usuarios con rol "operator")
  - Modal editar: mismos campos
  - Link "Ver tiendas" → `/admin/routes/:routeId`
- `src/pages/AdminRouteDetailPage.tsx` — **CREAR**:
  - Lista ordenada de tiendas en la ruta (drag para reordenar — usar atributos HTML5 drag-and-drop, sin librerías externas)
  - Añadir tienda: dropdown de tiendas activas + visitFrequency
  - Eliminar tienda con confirmación
  - Botón "Generar planes semana siguiente"
- `src/app/router.tsx` — rutas `/admin/routes` y `/admin/routes/:routeId`
- `src/shared/constants/navItems.tsx` — agregar "Rutas" al `ADMIN_NAV`

**Depende de**: T4.1  
**Criterio de completitud**: admin crea ruta con tiendas; plans generados aparecen en Firestore `visit_plans`.

---

### T4.3 — Admin: Asignación de Rutas

**Descripción**: Flujo para que el admin asigne una promotora a una ruta (parte de la edición de ruta en T4.2, ticket separado por complejidad de conflictos).

**Archivos afectados**:
- `src/features/routes/services/routeService.ts` — agregar:
  - `checkPromoterRouteConflict(promoterId, routeId)` — verifica si la promotora ya tiene otra ruta activa que incluya las mismas tiendas en los mismos días
  - `reassignRoute(routeId, newPromoterId)` — cambia promoterId y actualiza planes pendientes
- `src/pages/AdminRouteDetailPage.tsx` — sección "Asignación":
  - Muestra promotora actual
  - Botón "Reasignar" → modal con dropdown de promotoras + validación de conflictos
  - Alerta si hay conflicto de tiendas/días

**Depende de**: T4.2  
**Criterio de completitud**: reasignación actualiza Firestore y planes pendientes sin duplicados.

---

### T4.4 — Promoter: Vista de Ruta del Día/Semana

**Descripción**: Página para que la promotora vea sus tiendas pendientes del día y la semana.

**Archivos afectados**:
- `src/pages/PromoterRoutePage.tsx` — **CREAR**:
  - Carga `fetchVisitPlansByPromoter(userId, weekStart)` al mount
  - Vista "Hoy": lista de tiendas con `plannedDate == today`, ordenadas por `order` de la ruta
  - Vista "Semana": lista agrupada por día
  - Cada tienda muestra: nombre, dirección, estado (pendiente/completada/vencida)
  - Botón "Iniciar visita" → navega a `/visit/new?storeId={id}&planId={planId}`
  - Badge contador en nav de "pendientes hoy"
- `src/pages/VisitFormPage.tsx` — leer query param `planId` si viene de la ruta, y al guardar llamar `markPlanCompleted(planId, visitId)`
- `src/app/router.tsx` — ruta `/promoter/route` → `PromoterRoutePage`
- `src/shared/constants/navItems.tsx` — agregar "Mi Ruta" al `PROMOTER_NAV`

**Depende de**: T4.1, T1.14 (VisitFormPage)  
**Criterio de completitud**: promotora ve sus tiendas del día; al completar visita desde la ruta, plan se marca `"completed"`.

---

### T4.5 — Tracking: Visitas Realizadas vs Planeadas

**Descripción**: Vista admin de cumplimiento de rutas. Tiendas visitadas vs. planeadas por promotora y período.

**Archivos afectados**:
- `src/features/reports/components/RouteComplianceReport.tsx` — **CREAR**:
  - Similar a `CoverageReport.tsx` (T3.3) pero basado en `VisitPlan` en lugar de frecuencia de Store
  - Tabla: promotora, planes totales, completados, vencidos, % cumplimiento
  - Drill-down: click en promotora → tabla de sus planes con estado
- Integrar como tab "Cumplimiento de Rutas" en `AdminReportsPage`

**Depende de**: T4.1, T3.3  
**Criterio de completitud**: reporte muestra cumplimiento; planes missed aparecen diferenciados.

---

### T4.6 — Alertas de Retraso en Ruta

**Descripción**: Notificaciones in-app para planes vencidos (missed). Solo UI — no push notifications.

**Archivos afectados**:
- `src/features/routes/hooks/useRouteAlerts.ts` — **CREAR**:
  - Al mount (solo para rol "operator"): llama `fetchMissedPlans(userId)`, si hay > 0 dispara toast informativo
  - Para admin: `fetchAllMissedPlans()` — cuenta de planes vencidos por promotora
- `src/pages/PromoterPage.tsx` (home de promotora) — usar `useRouteAlerts` para mostrar banner de visitas atrasadas
- `src/pages/AdminPage.tsx` — mostrar contador de planes vencidos en la sección de resumen

**Depende de**: T4.4  
**Criterio de completitud**: plan vencido aparece en banner de promotora; contador en admin dashboard se actualiza.

---

---

## Resumen de tickets por fase

| Fase | Tickets | Archivos nuevos aprox. | Complejidad |
|---|---|---|---|
| 1 — Rebrand + Core | T1.1–T1.16 (16 tickets) | ~25 | Alta (migración de tipos + IndexedDB) |
| 2 — Stock | T2.1–T2.9 (9 tickets) | ~15 | Media |
| 3 — Reportes | T3.1–T3.8 (8 tickets) | ~12 | Media |
| 4 — Rutas | T4.1–T4.6 (6 tickets) | ~10 | Alta (lógica de planning) |
| **Total** | **39 tickets** | **~62 archivos nuevos** | |

## Nuevas colecciones Firestore por fase

| Fase | Colecciones nuevas |
|---|---|
| 1 | `visits` (rename), `stores` (rename), `config` |
| 2 | `products`, `store_products`, `stock_snapshots` |
| 3 | (ninguna nueva — lee de las existentes) |
| 4 | `routes`, `route_stores`, `visit_plans` |

## Regla de oro para el desarrollador

> Antes de cada ticket: verificar que `npx tsc --noEmit` pasa en el estado actual. Resolver errores de tipos antes de arrancar el ticket siguiente. El árbol de tipos es el contrato entre módulos.
