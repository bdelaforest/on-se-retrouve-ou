# On se retrouve où ?

**Application en ligne : <https://bdelaforest.github.io/on-se-retrouve-ou/>**

Application web statique qui trouve la station de métro parisienne la plus équitable pour un groupe : on
saisit les points de départ de chacun, on coche les personnes disponibles, et l'application classe les
stations de Paris intra-muros selon le temps de trajet maximal, total ou l'écart entre participants.

Tout l'état (participants, disponibilités, station retenue) vit dans l'URL : il suffit de partager le lien.

## Fonctionnement

- Les temps de trajet viennent d'une **matrice station à station précalculée** à partir du GTFS
  d'Île-de-France Mobilités (métro + RER A à E), embarquée dans `public/data/network.json`.
- Une adresse est rattachée à ses 4 stations les plus proches (marche à 4,5 km/h sur la distance à vol
  d'oiseau majorée de 30 %) ; on garde le meilleur accès pour chaque destination.
- Les destinations candidates sont les stations desservies par le métro situées dans Paris.
- Géocodage via l'[API Adresse](https://adresse.data.gouv.fr/api-doc/adresse), fond de carte OpenStreetMap.

## Développement

```bash
npm install
npm run dev
```

Autres commandes :

```bash
npm run lint          # oxlint
npm run format        # prettier --write
npm run typecheck     # tsc -b
npm test              # vitest
npm run build         # production build in dist/
```

## Regénérer la matrice

Le réseau change rarement ; la matrice est committée. Pour la regénérer :

```bash
curl -L -o /tmp/IDFM-gtfs.zip https://eu.ftp.opendatasoft.com/stif/GTFS/IDFM-gtfs.zip
unzip -o /tmp/IDFM-gtfs.zip -d /tmp/IDFM-gtfs
npm run build:network -- /tmp/IDFM-gtfs
```

Le script choisit le premier jeudi à venir comme journée de référence (passer une date `YYYYMMDD` en
second argument pour forcer), calcule les temps inter-stations à partir des horaires, ajoute 4 minutes
plus une demi-fréquence par correspondance, puis vérifie quelques trajets connus avant d'écrire le fichier.

## Déploiement

GitHub Actions lance lint, format, typecheck, tests et build sur chaque push, puis déploie `dist/` sur
GitHub Pages depuis `main`.
