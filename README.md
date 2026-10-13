# 42 Cours

Un cours interactif par projet 42, en français et en anglais. Site statique généré par `build.mjs`, sans dépendance.

## Commandes

```bash
npm run dev          # build + serveur sur http://localhost:4242 (rebuild automatique)
npm run build        # valide le contenu puis génère dist/
npm run build:strict # idem, échoue si un cours FR ou EN manque
npm run check        # vérifie liens, démos, parité FR/EN
npm test             # tests unitaires
```

## Ajouter ou modifier un cours

1. Ajouter l'entrée dans `content/projects.json`. Champs requis : `id`, `group` (`c`, `sys`, `gfx` ou `cpp`), `order`, `icon`, `accent` (couleur hexadécimale), `tag` {fr,en}, `name`, `summary` {fr,en}. Les extras (notions transverses) vivent à part : entrée dans `content/extras.json` (groupe `extras`) et fragments dans `content/extras/<id>/`.
2. Écrire `content/courses/<id>/fr.html` et `en.html` en suivant `docs/COURSE_AUTHORING.md`.
3. Les démos vont dans `assets/demos/<id>-<nom>.js` ; le build les détecte via `data-demo`.
4. `npm run build && npm run check` doit afficher `OK`.

La carte `_template` (gabarit pour écrire et tester les démos, `content/courses/_template/`) n'apparaît que sous `npm run dev` (qui construit `dist/` avec elle) : elle n'est jamais dans le `dist/` de production, produit par `npm run build` et par le build Vercel.

## Déployer sur Vercel

Importer le dépôt dans Vercel : `vercel.json` fournit la commande de build, le dossier de sortie et la redirection de langue (`/` → `/fr/` ou `/en/` selon `Accept-Language`).
