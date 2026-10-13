# Écrire un cours

**Public :** quelqu'un qui a le projet 42 à faire et veut comprendre **comment s'y prendre**. Il a le sujet PDF sous les yeux. Le cours explique le sujet et la démarche ; il ne décortique pas le code de Mateo.

## 1. Ce que tu crées (et rien d'autre)

- `content/courses/<id>/fr.html` : fragment HTML (pas de `<html>`, `<head>`, `<body>`). Le build ajoute la barre du haut, le sommaire, le précédent/suivant et le pied.
- `assets/demos/<id>-<nom>.js` (+ `.css` si besoin) : un fichier par démo. Préfixe `<id>-` obligatoire et **vérifié** par `check`. Seule exception : `bit-toggler`, démo partagée.
- Ne modifie **jamais** `content/projects.json`, `content/ui.json`, `lib/`, `templates/`, `assets/site.*`, ni les cours des autres.
- Les sources de Mateo sont en lecture seule.

## 2. Structure d'un cours

Pars de `content/courses/_template/fr.html` (visible en dev sur `/fr/_template/`). Sections, avec **ids stables** (identiques en FR et EN) :

| id | Section | Contenu |
|---|---|---|
| `overview` | Le projet en bref | Ce qu'on te demande, en 3-4 lignes |
| `map` | La carte du projet | Obligatoire / bonus, fichiers à rendre, fonctions autorisées, contraintes (flags, Norme) |
| `concepts` (ou plusieurs ids) | Concepts clés | Schémas, démos interactives, extraits de code **courts** |
| `steps` (ou `ex00`, `ex01`…) | Étape par étape | Comment s'y prendre, par fonction ou par exercice |
| `pitfalls` | Pièges classiques | Ce qui fait échouer en correction |
| `how` | Comment je l'ai fait | 150 mots max, en prose, l'approche et les choix. **Aucun listing de code** |
| `recap` | À retenir (défense d'éval) | Liste de points + checklist |

Pour un module C++ : une section par exercice, avec fichiers à rendre, squelette de header (déclarations uniquement) et résultat attendu, comme le cours CPP05 (`content/courses/cpp05/fr.html`).

## 3. Règles de rédaction

- Tutoiement, ton direct, phrases courtes. Jargon technique en anglais quand c'est l'usage (`stack`, `heap`, `buffer`).
- **Partir du sujet.** Chaque affirmation sur le sujet (fonctions autorisées, flags, formats de sortie, seuils) doit être vérifiable dans le PDF. Si une valeur n'est pas dans le sujet, ne l'invente pas.
- **Donner de quoi réussir le sien sans livrer une solution à copier.** Pas de fonction complète prête à coller. Des extraits courts pour illustrer une idée sont acceptés.
- On ne fait **pas référence au code de Mateo** (« ma fonction », « le repo de Mateo »…) en dehors de la section `how`. On s'adresse au lecteur en parlant de « ton `ft_split` », « ton exercice » : la fonction ou l'exercice que **le lecteur** écrit.
- Pour « Comment je l'ai fait » : lis le repo de Mateo pour comprendre son approche, puis résume-la en prose.
- Emojis avec parcimonie (titres de section, encarts), comme dans les pages existantes.

## 4. Conventions HTML

- Hero : `header.hero` > `span.kicker(span.dot)` + `h1.title(span.g)` + `p.lead` + `p.subj`. Puis `<div class="wrap">` qui contient les `<section>`.
- Chaque section commence par `.sec-head` : `<section id="…"><div class="sec-head reveal"><span class="sec-num">01</span><h2>Titre <span class="accent">accentué</span></h2></div> …`. **Sauf `recap`**, qui contient directement le bloc `.cheat` (avec son propre `<h2>`), sans `.sec-head`. Le `<h2>` alimente le sommaire. Un sous-titre éventuel va dans `<small>` (ignoré par le sommaire).
- Texte : `p.body`, `code.inline`, `b`.
- Code : `.editor` > `.bar` (`.lights`, `.fname`) + `pre` ; coloration par `span` : `.k` `.ty` `.fn` `.st` `.cm` `.nm` `.op`.
- Grilles : `.map` > `.map-item` (`.ex`, `h4`, `p`) ; `.duo` > `.card` ; tableaux : `.table-wrap` > `table`.
- Encarts : `.callout` (info), `.callout.warn` (piège), `.how`, `.cheat` (récap, liste `li` avec `.chk`).
- Étapes : `.steps` > `.step.on` (`.n`, `.txt`).
- Les couleurs viennent de `var(--accent)` (couleur du projet) et des tokens de `assets/site.css`.
- Les liens internes sont **absolus depuis la racine** (`/fr/extras/public-vs-private/`), jamais relatifs : le checker ne résout que `href="/…"`.
- `id="…"` et `data-demo="…"` s'écrivent **toujours entre guillemets doubles**, jamais simples.
- **Aucune ressource externe** (image, police d'icônes, script, feuille de style, `<iframe>`…) hormis Google Fonts, déjà dans le gabarit : le checker la refuse (`external …`). Les liens `<a href="https://…">` vers un manuel ou un sujet restent permis.

## 5. Démos interactives (la marque de fabrique)

Au moins **deux** par cours (une seule si le cours est très court). Elles doivent faire comprendre en manipulant : l'utilisateur change une entrée, voit le résultat se transformer.

Dans le fragment :

```html
<div class="demo" data-demo="<id>-<nom>">
  <div class="demo-static"><p class="body">Texte statique : ce que la démo montre (visible sans JavaScript).</p></div>
  <div class="demo-mount"></div>
  <script type="application/json" class="demo-i18n">{"title":"…","run":"…"}</script>
</div>
```

`assets/demos/<id>-<nom>.js` (script classique, pas de module, pas de dépendance) :

```js
(window.Demos = window.Demos || {})['<id>-<nom>'] = function (root, T) {
  var mount = root.querySelector('.demo-mount');
  mount.classList.add('demo-body');
  // Construire l'UI avec createElement + textContent. Jamais innerHTML avec des valeurs de T ou de l'utilisateur.
};
```

- **Textes de l'interface** : uniquement dans le JSON `demo-i18n` du fragment (`T.clé`). Le JS est partagé FR/EN, seul le JSON se traduit. Mêmes clés en FR et EN.
- **Styles** : dans `assets/demos/<id>-<nom>.css`, tous les sélecteurs préfixés par `[data-demo="<id>-<nom>"]`. Le build ajoute le `<link>` tout seul.
- **Accessibilité** : vrais `<button type="button">`, `aria-live="polite"` sur la zone de résultat, état jamais porté par la couleur seule, utilisable au clavier.
- Les démos détectent leurs erreurs d'entrée (champ vide, valeur hors limites) et l'affichent, sans exception non gérée.
- Réutilise `bit-toggler` quand une démo de bits suffit (`data-bits="8"`). `data-bits` vaut de 1 à 32 (8 par défaut si la valeur est invalide). Le JSON `demo-i18n` doit contenir les clés `title`, `decimal`, `hex`, `reset`, `bit` : sinon des libellés anglais de repli s'affichent sur la page française.
- **Classes partagées** déjà fournies par `assets/site.css` : `.seg` (onglets), `.demo-actions` (rangée de boutons), `.demo button.btn`, `.verdict-box` (avec `.show`, `.good`, `.bad`), `.mem-code`, et les champs `input`, `select`, `textarea`, `label` déjà stylés à l'intérieur de `.demo`. À réutiliser avant d'en inventer d'autres.

## 6. Définition de « terminé »

1. `node build.mjs --out .tmp/<id>` puis `node scripts/check.mjs --dist .tmp/<id> --only <id>` affiche `OK`. Attention : `--only <id>` affiche `OK` même si rien ne correspond (faute de frappe sur l'id) ; **vérifie donc que `.tmp/<id>/fr/<id>/index.html` existe**. Le préfixe `<id>-` des démos est obligatoire parce que le filtre `--only` repose dessus : sans lui, les erreurs de ta démo seraient masquées, et deux cours pourraient se marcher dessus. `check` le **vérifie** : une démo qui n'est ni `bit-toggler` ni `<id>-<nom>` est une erreur.
   Toutes les commandes se lancent **depuis la racine du dépôt** : `--out` et `--dist` sont résolus par rapport au dossier courant. Ne passe **jamais** `.tmp` lui-même à `--out` (toujours `.tmp/<id>`) : le build vide son dossier de sortie.
2. Serveur : `node scripts/serve.mjs --dir .tmp/<id> --port <port>` (en tâche de fond). Avec `--dir`, le serveur ne reconstruit **jamais** : relance `node build.mjs --out .tmp/<id>` après chaque modification. Dans le navigateur intégré, ouvrir `http://localhost:<port>/fr/<id>/`, jouer chaque démo avec les cas du brief, vérifier la console sans erreur, puis la page à 375 px (`document.documentElement.scrollWidth <= 375`). Arrêter le serveur.
3. Relecture factuelle : chaque affirmation des sections `map` et `pitfalls` vérifiée contre le PDF (numéro de page noté dans ton compte rendu).
4. `how` ≤ 150 mots, sans listing de code.

**Règle générale :** jamais de `git commit`, `git push` ni `vercel` sans demande explicite de Mateo.

## 7. Traduction EN (vague 2)

- Même structure, **mêmes ids**, mêmes classes, mêmes `data-demo`, mêmes clés dans `demo-i18n`.
- Traduire le texte, les valeurs du JSON `demo-i18n` et les commentaires de code. Ne pas traduire les identifiants C/C++, les noms de fichiers, ni les sorties exactes imposées par le sujet.
- Exception : les noms de fichiers d'exemple et de sujet du gabarit (ex. `exemple.c` / `example.c`, `fichier.pdf` / `file.pdf`) sont des libellés d'illustration et peuvent être traduits ; les vrais noms de fichiers du sujet ne se traduisent pas.
- Les `{placeholders}` des valeurs `demo-i18n` sont conservés un à un, sauf les marqueurs de **pluriel** (`{s}`, `{sNa}`…) : la grammaire anglaise peut en demander moins (« met » / « not met » ne s'accordent pas). Les règles propres à une langue (pluriel du 0, séparateurs, virgule ou point décimal, unité) ne se codent JAMAIS en dur dans le JS : elles passent par des clés du JSON, ajoutées dans les DEUX fragments (voir `born2beroot-policy-checker.js`, clés `pluralSuffix`, `pluralZeroSuffix`, `ruleSep`).
- Orthographe : anglais **américain** partout (behavior, defense, optimization, gray, uncheck…). Les noms d'exemple inventés par le cours (`compteur`, `fichier.txt`) se traduisent ; ceux qui viennent du sujet ne se traduisent jamais.
- `node scripts/check.mjs` contrôle la parité FR/EN.
