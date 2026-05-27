# CM2B — Instructions pour Claude

## Présentation du projet

CM2B est un outil de **gestion d'inventaire organisationnel** (CMDB légère).
Il permet de définir les catégories d'actifs d'une organisation (personnes, machines,
logiciels, locaux, processus…), de les relier entre eux et de naviguer dans l'inventaire
via des vues canvas (diagrammes) et des vues liste.

Le modèle de données est entièrement configurable par l'administrateur :
- **Méta-modèle** : types, classes d'éléments et leurs propriétés (simples ou relationnelles)
- **Éléments** : instances des classes, avec leurs valeurs d'attributs et leurs relations
- **Structures** (aka documents) : gabarits de vues qui définissent quels types d'éléments
  peuvent apparaître ensemble et comment (Organigramme, Macro-processus, Ecosystème…)
- **Vues** : instances d'une structure pour une organisation donnée, avec positions canvas

L'application est pensée pour être déployée en auto-hébergement via Docker,
avec un wizard de premier démarrage pour la création du compte administrateur.

## Stack
- **Backend** : NestJS v11 + TypeORM + better-sqlite3 (SQLite)
- **Frontend** : Angular 21 (standalone components, signals, `@angular/build:application`)
- **Auth** : JWT (access token sessionStorage + refresh token localStorage) + bcrypt
- **Docker** : multi-stage build (node:20-alpine), NestJS sert les statics Angular en prod

## Structure
```
src/              # NestJS backend
  entities/       # TypeORM entities
  auth/           # JWT auth, guards, decorators
  map/            # Éléments, relations
  elementclasses/ # Classes, AttributeDefinitions
  view/           # Vues canvas, positions
  admin/          # Export/import seed
  database/seed/  # Seed idempotent + fixtures/classes.json
client/           # Angular SPA
  src/app/
    core/         # Services, guards, interceptors, models
    features/     # canvas, liste, admin, auth
  src/environments/
    environment.ts              # dev (http://localhost:3000/api/v1)
    environment.production.ts   # prod (/api/v1)
```

## Commandes utiles
```bash
# Dev
npm run start:dev              # NestJS watch mode (port 3000)
cd client && npm run start     # Angular dev server (port 4200)

# Seed
npm run seed                   # seed métamodèle depuis fixtures/classes.json

# Build & prod
npm run build:all              # Angular puis NestJS
docker compose up -d           # Stack complète
docker compose down && docker volume rm cm2b-data  # Reset données
```

## Conventions importantes

### Seed vs Service
Le seed (`seed-metamodel.seed.ts`) écrit **directement dans le repository TypeORM**,
sans passer par les services NestJS. Tout effet de bord normalement géré par un service
(ex : `inverseAttributeDefinitionId` sur les attrs COMPLEX) doit être résolu
**manuellement dans le seed** avec une passe dédiée.

### Routage NestJS (serve-static v5 / path-to-regexp v8)
Utiliser `/{*path}` et non `/*` ni `(.*)` :
```typescript
renderPath: '/{*path}',
exclude: ['/api/{*path}'],
```

### Angular production build
Le `fileReplacements` dans `angular.json` est **requis** pour que la prod utilise
`environment.production.ts` (URL relatives). Sans ça, toutes les requêtes API partent
vers `http://localhost:3000` quel que soit le port servi.

### Attributs COMPLEX (relations bidirectionnelles)
- Chaque attr COMPLEX a un `inverseAttributeDefinitionId` qui pointe vers son miroir.
- Les vues (liste, canvas edit panel) utilisent ce champ pour résoudre les relations entrantes.
- Sans ce lien, les propriétés inverses apparaissent vides à l'édition.

### Auth guards Angular
- `authGuard` : redirige vers `/login` si pas de token
- `setupGuard` : redirige vers `/login` si setup déjà fait (protège `/setup`)
- `roleGuard` : vérifie le rôle (ADMIN pour `/admin`)
- `authInterceptor` : injecte Bearer + gère le refresh 401 automatique

## Entités clés
| Entité | Rôle |
|---|---|
| `ElementType` | Type de classe (ex: Organisationnel, Actifs Humains) |
| `ElementClass` | Classe d'élément, avec héritage `parentClassId` |
| `AttributeDefinition` | Propriété d'une classe (SIMPLE ou COMPLEX) |
| `Element` | Instance d'une classe |
| `Relation` | Lien entre deux éléments, avec `attributeDefinitionId` |
| `ViewElementPosition` | Position canvas x/y d'un élément dans une vue |
| `User` + `RefreshToken` | Auth JWT |
