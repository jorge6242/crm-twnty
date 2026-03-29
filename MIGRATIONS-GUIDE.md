# 📚 Guía de Migraciones - Twenty CRM

## 🎯 Propósito
Esta guía documenta el proceso correcto para agregar nuevos objetos estándar (standard objects) en Twenty CRM basado en la experiencia real de agregar `PersonJobHistory`.

---

## ✅ Checklist para Agregar un Nuevo Standard Object

### 1. **Crear la Entidad WorkspaceEntity**
📁 Ubicación: `packages/twenty-server/src/modules/[modulo]/standard-objects/[nombre].workspace-entity.ts`

```typescript
import { BaseWorkspaceEntity } from 'src/engine/twenty-orm/base.workspace-entity';
import { type EntityRelation } from 'src/engine/workspace-manager/workspace-migration/types/entity-relation.interface';

export class YourObjectWorkspaceEntity extends BaseWorkspaceEntity {
  // Campos propios
  fieldName: string | null;

  // Relaciones
  relatedEntity: EntityRelation<RelatedEntityWorkspaceEntity> | null;
  relatedEntityId: string | null;
}
```

### 2. **Registrar IDs Universales**

#### a) `packages/twenty-shared/src/metadata/standard-object-ids.ts`
```typescript
export const STANDARD_OBJECT_IDS = {
  // ... otros objetos
  yourObject: '20202020-xxxx-xxxx-xxxx-xxxxxxxxxxxx', // Genera UUID único
} as const;
```

#### b) `packages/twenty-server/src/engine/workspace-manager/workspace-migration/constant/standard-field-ids.ts`
```typescript
export const YOUR_OBJECT_STANDARD_FIELD_IDS = {
  fieldName: '20202020-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  relatedEntity: '20202020-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  // ... otros campos
};
```

### 3. **Registrar en Standard Objects Constant**
📁 `packages/twenty-server/src/engine/workspace-manager/twenty-standard-application/constants/standard-object.constant.ts`

Agregar import:
```typescript
import {
  // ... otros imports
  YOUR_OBJECT_STANDARD_FIELD_IDS,
} from 'src/engine/workspace-manager/workspace-migration/constant/standard-field-ids';
```

Agregar objeto:
```typescript
export const STANDARD_OBJECTS = {
  // ... otros objetos
  yourObject: {
    universalIdentifier: STANDARD_OBJECT_IDS.yourObject,
    fields: {
      id: { universalIdentifier: '20202020-xxxx-...' },
      createdAt: { universalIdentifier: '20202020-xxxx-...' },
      updatedAt: { universalIdentifier: '20202020-xxxx-...' },
      deletedAt: { universalIdentifier: '20202020-xxxx-...' },
      fieldName: {
        universalIdentifier: YOUR_OBJECT_STANDARD_FIELD_IDS.fieldName,
      },
      relatedEntity: {
        universalIdentifier: YOUR_OBJECT_STANDARD_FIELD_IDS.relatedEntity,
      },
    },
    indexes: {},
    views: {},
  },
};
```

### 4. **Crear Builder de Field Metadata**
📁 `packages/twenty-server/src/engine/workspace-manager/twenty-standard-application/utils/field-metadata/compute-[your-object]-standard-flat-field-metadata.util.ts`

```typescript
import { FieldMetadataType, RelationOnDeleteAction, RelationType } from 'twenty-shared/types';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { type AllStandardObjectFieldName } from 'src/engine/workspace-manager/twenty-standard-application/types/all-standard-object-field-name.type';
import {
  type CreateStandardFieldArgs,
  createStandardFieldFlatMetadata,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/field-metadata/create-standard-field-flat-metadata.util';
import { createStandardRelationFieldFlatMetadata } from 'src/engine/workspace-manager/twenty-standard-application/utils/field-metadata/create-standard-relation-field-flat-metadata.util';

export const buildYourObjectStandardFlatFieldMetadatas = ({
  now,
  objectName,
  workspaceId,
  standardObjectMetadataRelatedEntityIds,
  dependencyFlatEntityMaps,
  twentyStandardApplicationId,
}: Omit<
  CreateStandardFieldArgs<'yourObject', FieldMetadataType>,
  'context'
>): Record<
  AllStandardObjectFieldName<'yourObject'>,
  FlatFieldMetadata
> => ({
  // Campos base (id, createdAt, updatedAt, deletedAt)
  id: createStandardFieldFlatMetadata({...}),
  createdAt: createStandardFieldFlatMetadata({...}),
  // ... etc

  // Campos personalizados
  fieldName: createStandardFieldFlatMetadata({
    objectName,
    workspaceId,
    context: {
      fieldName: 'fieldName',
      type: FieldMetadataType.TEXT,
      label: 'Field Name',
      description: 'Description',
      icon: 'IconName',
      isNullable: true,
    },
    standardObjectMetadataRelatedEntityIds,
    dependencyFlatEntityMaps,
    twentyStandardApplicationId,
    now,
  }),

  // Relaciones
  relatedEntity: createStandardRelationFieldFlatMetadata({
    objectName,
    workspaceId,
    context: {
      fieldName: 'relatedEntity',
      type: RelationType.MANY_TO_ONE,
      label: 'Related Entity',
      description: 'Relation to related entity',
      icon: 'IconLink',
      toRelationMetadata: {
        toTargetObject: 'relatedEntity',
        toTargetFieldName: 'yourObjects',
      },
      onDelete: RelationOnDeleteAction.SET_NULL,
    },
    standardObjectMetadataRelatedEntityIds,
    dependencyFlatEntityMaps,
    twentyStandardApplicationId,
    now,
  }),
});
```

### 5. **Registrar Builder en Maps**
📁 `packages/twenty-server/src/engine/workspace-manager/twenty-standard-application/utils/field-metadata/build-standard-flat-field-metadata-maps.util.ts`

Import:
```typescript
import { buildYourObjectStandardFlatFieldMetadatas } from './compute-your-object-standard-flat-field-metadata.util';
```

Registrar:
```typescript
export const STANDARD_FLAT_FIELD_METADATA_BUILDERS_BY_OBJECT_NAME = {
  // ... otros builders
  yourObject: buildYourObjectStandardFlatFieldMetadatas,
};
```

### 6. **Registrar Builder de Object Metadata**
📁 `packages/twenty-server/src/engine/workspace-manager/twenty-standard-application/utils/object-metadata/create-standard-flat-object-metadata.util.ts`

```typescript
export const STANDARD_FLAT_OBJECT_METADATA_BUILDERS_BY_OBJECT_NAME = {
  // ... otros objetos
  yourObject: ({
    now,
    workspaceId,
    standardObjectMetadataRelatedEntityIds,
    twentyStandardApplicationId,
    dependencyFlatEntityMaps,
  }: Omit<
    CreateStandardObjectArgs<'yourObject'>,
    'context' | 'objectName'
  >) =>
    createStandardObjectFlatMetadata({
      objectName: 'yourObject',
      dependencyFlatEntityMaps,
      context: {
        universalIdentifier: STANDARD_OBJECTS.yourObject.universalIdentifier,
        nameSingular: 'yourObject',
        namePlural: 'yourObjects',
        labelSingular: 'Your Object',
        labelPlural: 'Your Objects',
        description: 'A description of your object',
        icon: 'IconName',
        isSystem: true,
        labelIdentifierFieldMetadataName: 'fieldName',
      },
      workspaceId,
      standardObjectMetadataRelatedEntityIds,
      twentyStandardApplicationId,
      now,
    }),
};
```

### 7. **Agregar Relaciones Bidireccionales**

En las entidades relacionadas (ej. `Person`, `Company`), agregar:

#### Import:
```typescript
import { type YourObjectWorkspaceEntity } from 'src/modules/your-module/standard-objects/your-object.workspace-entity';
```

#### Campo de relación:
```typescript
export class PersonWorkspaceEntity extends BaseWorkspaceEntity {
  // ... otros campos
  yourObjects: EntityRelation<YourObjectWorkspaceEntity[]>;
}
```

#### Field metadata en compute-person-standard-flat-field-metadata.util.ts:
```typescript
yourObjects: createStandardRelationFieldFlatMetadata({
  objectName,
  workspaceId,
  context: {
    fieldName: 'yourObjects',
    type: RelationType.ONE_TO_MANY,
    label: 'Your Objects',
    description: 'Related your objects',
    icon: 'IconLink',
    toRelationMetadata: {
      toTargetObject: 'yourObject',
      toTargetFieldName: 'person',
    },
  },
  standardObjectMetadataRelatedEntityIds,
  dependencyFlatEntityMaps,
  twentyStandardApplicationId,
  now,
}),
```

#### Registrar field ID en PERSON_STANDARD_FIELD_IDS:
```typescript
export const PERSON_STANDARD_FIELD_IDS = {
  // ... otros campos
  yourObjects: '20202020-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
};
```

#### Agregar en STANDARD_OBJECTS.person.fields:
```typescript
yourObjects: { universalIdentifier: PERSON_STANDARD_FIELD_IDS.yourObjects },
```

---

## 🚀 Proceso de Aplicación

### En Desarrollo Local:

```bash
# 1. Rebuild del servidor con el nuevo código
make rebuild

# 2. Sincronizar metadata (incremental, preserva data)
make workspace-sync

# 3. Verificar que se creó correctamente
make verify-object OBJECT=yourObject

# 4. Ver todos los campos
make db-shell
# Luego en psql:
SELECT "name", "type" FROM core."fieldMetadata"
WHERE "objectMetadataId" IN (
  SELECT id FROM core."objectMetadata"
  WHERE "nameSingular" = 'yourObject'
) ORDER BY "name";
```

### Si workspace-sync Falla:

```bash
# Opción 1: Reset completo (desarrollo)
make db-reset

# Opción 2: Investigar el error
make logs
make db-shell
```

---

## ⚠️ Problemas Comunes y Soluciones

### 1. **Error: `PAGE_LAYOUT_WIDGET_NOT_FOUND`**
**Causa:** BD en estado inconsistente (widgets de objetos anteriores no creados)
**Solución:**
- En dev: `make db-reset`
- En prod: Investigar qué widgets faltan y crearlos manualmente o correr migraciones específicas

### 2. **Error: Objeto no se crea**
**Checklist:**
- ✅ ¿Está registrado en `STANDARD_OBJECTS`?
- ✅ ¿Está el builder en `STANDARD_FLAT_OBJECT_METADATA_BUILDERS_BY_OBJECT_NAME`?
- ✅ ¿Está el field builder en `STANDARD_FLAT_FIELD_METADATA_BUILDERS_BY_OBJECT_NAME`?
- ✅ ¿Hiciste `make rebuild` antes del sync?
- ✅ ¿El código está compilado en `/dist`?

### 3. **Error: Relaciones no funcionan**
**Checklist:**
- ✅ ¿Agregaste el campo en ambas entidades (bidireccional)?
- ✅ ¿Registraste el field ID en ambos `STANDARD_FIELD_IDS`?
- ✅ ¿Agregaste en ambos `STANDARD_OBJECTS.*.fields`?
- ✅ ¿El `toRelationMetadata` apunta correctamente a los nombres de campos?

---

## 🎯 Para Producción

### Antes de deployar:

1. **Test completo en staging:**
   ```bash
   # Staging debe tener BD similar a producción
   make rebuild
   make workspace-sync
   # Verificar que todo funciona
   ```

2. **Backup de producción:**
   ```bash
   # Hacer backup antes de cualquier cambio de schema
   docker exec -it twenty_postgres pg_dump -U postgres -d default > backup-$(date +%Y%m%d).sql
   ```

3. **Deployment:**
   ```bash
   # 1. Deploy del código
   # 2. Build en producción
   npx nx build twenty-server
   # 3. Sync incremental
   npx nx run twenty-server:command workspace:sync-standard-objects
   ```

4. **Rollback plan:**
   - Tener script SQL para revertir cambios si algo falla
   - Backup listo para restaurar
   - Código anterior taggeado en git

---

## 📝 Caso de Estudio: PersonJobHistory

Este objeto fue agregado exitosamente siguiendo este proceso. Ver:
- Entidad: `packages/twenty-server/src/modules/person/standard-objects/person-job-history.workspace-entity.ts`
- Field metadata: `compute-person-job-history-standard-flat-field-metadata.util.ts`
- Relaciones bidireccionales con `Person` y `Company`

**Lecciones aprendidas:**
1. Siempre hacer `make rebuild` antes de `workspace-sync`
2. Si la BD tiene estado inconsistente, `workspace-sync` falla
3. En dev, es más rápido hacer reset que debuggear inconsistencias
4. En prod, NUNCA hacer reset - investigar y arreglar específicamente

---

## � Troubleshooting Común

### 1. **Error: "network twenty_default declared as external, but could not be found"**
**Causa:** La red Docker externa no existe
**Solución:**
```bash
# Opción 1: Automático (ya incluido en make setup y make up)
make network-create

# Opción 2: Manual
docker network create twenty_default

# Luego continuar normalmente
make setup
```

### 2. **Error: Contenedores no inician después de make down**
**Causa:** Similar al problema de red, recursos externos no se recrean automáticamente
**Solución:**
```bash
# Usar stop-all en lugar de down para día a día
make stop-all

# Si ya hiciste down y hay problemas
make network-create
make up
```

### 3. **Error: Nx cache corrupto**
**Síntomas:** Código compilado no refleja cambios recientes
**Solución:**
```bash
make rebuild  # Ya incluye limpieza de cache
```

### 4. **Error: BD no responde durante setup**
**Síntomas:** Timeout en pg_isready, setup falla
**Solución:**
```bash
# El setup ya tiene retry automático, pero si falla:
# 1. Verificar que Docker tenga recursos suficientes
docker stats

# 2. Aumentar el wait manualmente (editar makefile)
# Cambiar sleep 5 a sleep 10 si tu máquina es lenta
```

### 5. **Error: workspace-sync falla con "Multiple validation errors"**
**Ya documentado arriba** en "Problemas Comunes y Soluciones" → Ver sección específica

---

## 🔗 Referencias

- [CLAUDE.md](./CLAUDE.md) - Comandos de desarrollo
- [Makefile](./makefile) - Todos los comandos disponibles
- Twenty Docs: https://twenty.com/developers

---

**Última actualización:** 26 de febrero de 2026
**Basado en:** Experiencia real agregando PersonJobHistory
**Mantenedor:** Tu Equipo
