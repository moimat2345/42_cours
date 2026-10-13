# 42 Cours — Design

Date : 2026-10-13 · Statut : à relire par Mateo

## 1. Objectif

Un site statique, déployable sur Vercel, qui regroupe un cours par projet 42 de Mateo.

- **Accueil** : une carte par projet (nom + une phrase). Clic → page de cours.
- **Public visé** : quelqu'un qui a le projet à faire et veut comprendre **comment s'y prendre**. Le cours explique le sujet et la démarche, pas le code de Mateo.
- **Marque de fabrique** : des **démos interactives** pour comprendre en manipulant.
- **Bilingue FR + EN**, livrés ensemble.
- Une rubrique **Cours supplémentaires** pour les sujets transverses (ex. *public vs private*).

## 2. Décisions validées

| Sujet | Décision |
|---|---|
| Stack | HTML statique + `build.mjs` (Node, **zéro dépendance**) qui génère `dist/` |
| Langues | FR écrit d'abord, puis traduit en EN **dans la foulée**, livraison FR+EN d'un bloc |
| Périmètre | Projets 42 faits par Mateo, y compris **libft** et **minishell** (so_long non fait : fractol à la place) |
| CPP | 6 cartes séparées (CPP00 → CPP05) regroupées dans un bloc « C++ Modules » |
| Cours existants | Contenu repris et **harmonisé** dans le design commun |
| Contenu | Basé sur **le sujet / l'exercice**, pas sur le code de Mateo. Une courte section « Comment je l'ai fait » en bonus |
| Design | Thème sombre des pages existantes (Chakra Petch / Sora / JetBrains Mono) |
| Déploiement | `vercel.json` préparé. **Aucun push / déploiement / commit** sans demande explicite |

## 3. Périmètre : 17 cours + extras

| id | Projet | Groupe | État de départ | Sources |
|---|---|---|---|---|
| `libft` | libft | C | à écrire | pas de PDF ; `42bangkok_course/Libft` |
| `ft_printf` | ft_printf | C | à écrire | pas de PDF ; `clean_github/ft_printf` |
| `get_next_line` | get_next_line | C | à écrire | PDF + repo |
| `born2beroot` | born2beroot | Système/Réseau | à écrire | PDF + repo |
| `push_swap` | push_swap | C | à écrire | PDF + repo |
| `pipex` | pipex | C | à écrire | PDF + repo |
| `minishell` | minishell | C | à écrire | pas de PDF ; `42bangkok_course/minishell`, `test/42-Minishell` |
| `fractol` | fract'ol | Graphique | à écrire | PDF + repo |
| `philosophers` | philosophers | C | à écrire | PDF + repo |
| `netpractice` | NetPractice | Système/Réseau | **à harmoniser** | PDF + `net_practice/netpractice_course(_fr).html` + site *Subnet Notes* |
| `cub3d` | cub3D | Graphique | **à harmoniser** | PDF + `cub3D/cub3d_course.html` |
| `cpp00` | CPP00 | C++ | à écrire | PDF + repo |
| `cpp01` | CPP01 | C++ | **à migrer** (FR+EN existent) | `doc/{fr,en}/cpp01-*` |
| `cpp02` | CPP02 | C++ | **à harmoniser** | PDF + `cpp_02/cpp02_cours.html` |
| `cpp03` | CPP03 | C++ | à écrire | PDF + repo |
| `cpp04` | CPP04 | C++ | à écrire | PDF + repo |
| `cpp05` | CPP05 | C++ | **à migrer** (FR+EN existent) | `doc/{fr,en}/cpp05-*` |

**Extras** (rubrique « Cours supplémentaires ») : `public-vs-private` (migré depuis `doc/`, il quitte CPP00 pour l'extra).

**Hors périmètre** : CPP06-09, projets non faits (so_long…), projets perso non-42, version `.md` des cours.

Les PDF manquants (libft, ft_printf, minishell) : le cours est écrit d'après la connaissance du sujet standard. Mateo peut fournir le PDF pour vérification.

## 4. Architecture du dépôt

```
42_cours/
├── vercel.json                  # build, redirections de langue
├── build.mjs                    # génère dist/ (Node, 0 dépendance)
├── scripts/check.mjs            # vérifications (liens, fragments FR/EN, JSON des démos)
├── content/
│   ├── projects.json            # liste des projets (métadonnées FR/EN)
│   ├── extras.json              # cours supplémentaires
│   └── courses/<id>/{fr,en}.html   # corps du cours (fragment, sans <head>)
├── templates/                   # gabarits : home, course, shell commun (header/footer/nav)
├── assets/
│   ├── site.css                 # tokens + composants communs
│   ├── site.js                  # filtre, reveal, sommaire, bascule de langue
│   └── demos/<nom>.js           # moteurs de démos partagés FR/EN
├── public/subnet-notes/         # copie statique du site NetPractice/dist (si compatible sous-chemin)
└── dist/                        # généré, ignoré par git
```

### `projects.json` (une entrée)

```json
{
  "id": "push_swap", "group": "c", "order": 5, "icon": "🔀", "accent": "#5b9dff",
  "tag":     { "fr": "Algorithmique", "en": "Algorithms" },
  "name":    "push_swap",
  "summary": { "fr": "Trier une pile avec deux piles et peu de coups.",
               "en": "Sort a stack using two stacks in as few moves as possible." }
}
```

Les démos d'un cours ne sont pas déclarées ici : le build les détecte via les attributs `data-demo="…"` du fragment, ce qui évite que plusieurs rédacteurs modifient ce fichier en parallèle.

### Sortie générée

- `/fr/` et `/en/` : accueil.
- `/fr/<id>/` et `/en/<id>/` : cours. `/fr/extras/<id>/` pour les extras.
- `/` : redirection de langue. `vercel.json` redirige vers `/en/` si l'en-tête `Accept-Language` commence par `en`, sinon `/fr/`. Une page `dist/index.html` avec JS (`navigator.language`) sert de repli hors Vercel.
- Le choix manuel FR/EN est mémorisé dans `localStorage` (try/catch, jamais bloquant).
- `cleanUrls` activé.

## 5. Build

`node build.mjs` :

1. Lit `projects.json`, `extras.json`.
2. Pour chaque langue et chaque projet, lit `content/courses/<id>/<lang>.html` et l'insère dans `templates/course.html` (head, fil d'Ariane, sommaire généré depuis les `<h2 id>`, précédent/suivant, bascule de langue, pied de page).
3. Génère les accueils (grille filtrable, bloc C++, bloc extras).
4. Copie `assets/` et `public/`.
5. **Mode strict** (`--strict`, utilisé par Vercel) : échec si un fragment FR ou EN manque. En dev, un EN manquant retombe sur le FR avec un bandeau.

## 6. Accueil

- Hero (titre, une ligne d'intro), filtres par groupe (Tout · C · Système/Réseau · Graphique · C++).
- Grille de cartes : icône, tag, nom, phrase, flèche. Chaque carte a un accent de couleur.
- Bloc « C++ Modules » : les 6 cartes CPP00-05.
- Rubrique « Cours supplémentaires » : liste de cartes, extensible via `extras.json`.
- Responsive (mobile d'abord), clavier et lecteur d'écran corrects, `prefers-reduced-motion` respecté.

## 7. Page de cours : gabarit éditorial

Tous les cours suivent la même colonne vertébrale (adaptée au projet) :

1. **Le projet en bref** : ce qu'on te demande, en quelques lignes.
2. **La carte du projet** : partie obligatoire / bonus, fichiers à rendre, fonctions autorisées, contraintes.
3. **Concepts clés** : chacun avec schéma et **démo interactive**.
4. **Étape par étape** : comment s'y prendre, par fonction ou par exercice. Pour les CPP, on garde la forme du cours CPP05 : fichiers à rendre, squelette de header, résultat attendu.
5. **Pièges classiques** : ce qui fait échouer en correction.
6. **Comment je l'ai fait** *(court, optionnel)* : l'approche et les choix de Mateo, en prose. Pas de décorticage du code ligne à ligne.
7. **À retenir (défense d'éval)** + checklist avant correction.

### Règles éditoriales

- Partir du **sujet** : le lecteur a le PDF sous les yeux.
- Donner de quoi réussir le sien sans livrer une solution à copier. Pas de gros blocs de code complet. Des extraits courts pour illustrer sont acceptés.
- Exactitude technique d'abord : chaque affirmation sur le sujet ou la Norme est vérifiable dans le PDF.
- Le français comme langue de rédaction, le jargon technique en anglais quand c'est l'usage.

## 8. Démos interactives

Au moins **deux par cours** (une seule pour un cours très court). Pistes indicatives, non contraignantes :

| Projet | Pistes de démos |
|---|---|
| libft | chevauchement de `memmove`, découpe de `split`, liste chaînée (`lstadd_*`) |
| ft_printf | machine à états du format, `va_arg` pas à pas, conversion de base (`%x`, `%p`) |
| get_next_line | tampon statique avec curseur `BUFFER_SIZE`, boucle de lecture pas à pas |
| born2beroot | constructeur de partitions/LVM, vérificateur de politique de mots de passe / sudo |
| push_swap | simulateur de piles (`sa pb ra rra`…), tri par radix en binaire |
| pipex | table des fd avec `fork` / `pipe` / `dup2` animée |
| minishell | tokenizer/parser (quotes, pipes, redirections) avec arbre, expansion de `$VAR` |
| fractol | canvas Mandelbrot/Julia (zoom, itérations, palette), plan complexe ↔ pixels |
| philosophers | chronologie fourchettes/mutex avec détection de deadlock et de famine |
| NetPractice | calculateur de sous-réseaux, masque en binaire, lien vers *Subnet Notes* |
| cub3D | DDA / raycasting pas à pas, carte 2D ↔ vue 3D, colonne de texture |
| CPP00 | formatage de colonnes `setw`, accès `public`/`private`, `static` |
| CPP01 / CPP05 | démos existantes conservées |
| CPP02 | virgule fixe : décalage de bits et arrondi |
| CPP03 | ordre constructeurs/destructeurs, héritage en losange et `virtual` |
| CPP04 | table virtuelle, classe abstraite, copie profonde vs superficielle |

### Implémentation des démos

- Moteur JS partagé dans `assets/demos/<nom>.js`, initialisé sur `[data-demo="<nom>"]`.
- Les textes de l'interface viennent d'un bloc JSON dans le fragment (`<script type="application/json" class="demo-i18n">`), donc **le JS n'est pas dupliqué** entre FR et EN : seul le texte change.
- Sans dépendance externe, accessible au clavier, état initial lisible sans JS (le texte explicatif reste présent).

## 9. Migration des pages existantes

- **CPP01, CPP05, public-vs-private** : le corps est conservé, la coque (head, en-tête, pied) est remplacée par le gabarit. Les CSS/JS propres à chaque page restent isolés dans le fragment, avec les tokens communs extraits dans `site.css`.
- **CPP02, cub3D, NetPractice** : contenu repris, restructuré selon le gabarit §7 et refondu visuellement.
- **Subnet Notes** : le site est recompilé avec une base `/subnet-notes/` (ses chemins d'assets sont absolus et entreraient en collision avec `/assets/`), puis copié dans `public/subnet-notes/` et lié depuis le cours NetPractice. À vérifier : fonctionnement sous un sous-chemin. Plan B si ça échoue : ne pas l'embarquer et lier vers son dépôt GitHub.
- L'ancien `doc/index.html` n'est pas repris.

## 10. Livraison par vagues

| Vague | Contenu |
|---|---|
| 0 | Squelette (`build.mjs`, gabarits, CSS), accueil, migration CPP01 / CPP05 / public-vs-private (FR+EN). **Point de validation visuelle avec Mateo.** |
| 1 | Cours FR : 12 à écrire + 3 à harmoniser, en parallèle par sous-agents (un par cours). Chaque agent lit le sujet PDF et les sources, puis relecture factuelle indépendante |
| 2 | Traduction EN de tous les cours FR, immédiatement après la vague 1 |
| 3 | Vérifications finales, `vercel.json`, README |

Les vagues 1 et 2 s'enchaînent sans pause. L'EN est livré avec le FR.

Coût : la vague 1 représente un gros volume de tokens (≈ 15 cours, avec relecture). La relecture factuelle peut être retirée si Mateo préfère aller plus vite.

## 11. Vérification

- `node build.mjs --strict` passe, sans fragment manquant.
- `scripts/check.mjs` : liens internes valides, `lang` correct, JSON des démos valide, `node --check` sur chaque script de démo.
- Navigateur intégré : accueil et au moins un cours par groupe, en desktop et mobile, avec clics sur chaque démo, console sans erreur.
- Lecture croisée de chaque cours contre le sujet PDF correspondant.

## 12. Déploiement

`vercel.json` :

```json
{
  "buildCommand": "node build.mjs --strict",
  "outputDirectory": "dist",
  "cleanUrls": true,
  "redirects": [
    { "source": "/", "has": [{ "type": "header", "key": "accept-language", "value": "^en.*" }], "destination": "/en/", "permanent": false },
    { "source": "/", "destination": "/fr/", "permanent": false }
  ]
}
```

Mateo pousse sur GitHub et connecte à Vercel, ou me demande de lancer `vercel`.

## 13. Hypothèses et risques

- **Redirection de langue** : interprétée comme `/` → `/fr/` ou `/en/` selon la langue du navigateur, avec bascule manuelle. À corriger si Mateo entendait autre chose.
- **Sujets sans PDF** (libft, ft_printf, minishell) : exactitude vérifiable seulement si le PDF est fourni.
- **Volume** : ~15 cours riches × 2 langues. Les démos sont la partie la plus longue à écrire et à tester.
- **Subnet Notes sous sous-chemin** : peut demander des ajustements de chemins.
- **Aucun commit** n'est fait par défaut, y compris pour ce spec.
