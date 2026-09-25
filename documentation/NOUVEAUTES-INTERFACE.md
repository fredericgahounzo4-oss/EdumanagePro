# SchoolManager Pro — version 6 : bulletins fidèles à vos modèles papier

Vous avez signalé que les bulletins « papier » (Vogan, Baguida, La Réussite) ne ressemblaient pas du tout à vos
photos. En comparant précisément le code à vos quatre photos (dont le nouveau modèle Lycée Vogan 1, 1er semestre),
j'ai trouvé et corrigé quatre écarts concrets :

1. **Fonds colorés retirés.** J'avais ajouté des bandeaux gris/bleu derrière les en-têtes, les lignes de catégorie et
   les totaux. Vos bulletins réels n'ont **aucune trame** : uniquement des lignes noires sur papier blanc ou bleu.
   C'était sans doute la plus grande source de « ça ne ressemble à rien » : un bulletin administratif ne doit pas
   avoir l'air d'un tableau de site web.
2. **Colonnes « 1ère NOTE » / « 2ème NOTE » réparées.** Elles affichaient une moyenne et une case vide au lieu des deux
   vraies notes d'interrogation saisies par le professeur — la moitié du tableau semblait vide sur chaque bulletin.
3. **Intitulé de la 3e catégorie de matières corrigé** : « MATIERES SPORTIVES, ARTISTIQUES ET COMPLEMENTAIRES »
   (au lieu de « MATIERES FACULTATIVES »). Un vrai bug était même caché ici : pour le Collège et le Primaire,
   cet intitulé s'affichait brut en « AUTRES » ou « COMPLÉMENTAIRES », faute de correspondance dans le code.
4. **Format du rang corrigé** : « 50e - Faible » (comme sur vos bulletins), au lieu de « 50e .. Faible ».
5. **« MOY.1er S »** s'affiche maintenant au premier semestre/trimestre de l'année (au lieu de « MOY. » tout court),
   et rien ne s'affiche à tort pour le rappel des moyennes ou la moyenne annuelle tant qu'une seule période existe.

Revoyez `apercu-modeles-bulletins-et-recus.pdf` : la page 1 (Vogan) utilise maintenant exactement les notes et le nom
de l'élève de votre photo « Lycée Vogan 1 », pour comparaison directe.

**Si ce n'est toujours pas conforme**, dites-moi précisément quoi (une zone, une police, un espacement, un mot) sur
quelle photo : je corrigerai ligne par ligne plutôt que de deviner.

---

# SchoolManager Pro — version 5 : mots de passe et correction de la fiche élève

## Mise en service
1. **Neon** : exécuter `db/migration-v5.sql` (2 colonnes, idempotent). Les migrations v3 et v4 doivent déjà être passées.
2. `git push`, puis Ctrl+Maj+R.

## Qui gère quel mot de passe

| Compte | Réinitialisation | Changement par lui-même |
|---|---|---|
| Administrateur d'école | **Superadmin uniquement** | Oui, toujours (*Mon compte → Changer mon mot de passe*) |
| Enseignant | **Administrateur de l'école uniquement** — jamais le superadmin | **Seulement si l'administrateur l'autorise** (*Paramètres → Mots de passe des enseignants*). Par défaut : non |
| Caissier, élève, parent | Administrateur de l'école | Non |

- Le superadmin ne voit plus que les **administrateurs** dans la fenêtre « Comptes » d'une école ; toute tentative sur un
  autre compte est refusée par le serveur.
- L'administrateur d'école réinitialise un enseignant depuis *Comptes utilisateurs → Mot de passe* (un mot de passe
  provisoire de 12 caractères s'affiche une seule fois). Il ne peut pas toucher aux autres administrateurs.
- Un enseignant sans autorisation voit « Mot de passe géré par l'administrateur » à la place du bouton.
- **Sécurité** : réinitialiser ou changer un mot de passe **ferme les sessions déjà ouvertes** avec l'ancien (avant : elles
  survivaient jusqu'à 12 h). Le changement personnel exige le mot de passe actuel, 8 caractères minimum.

## Correction : le bouton « Ouvrir » (fiche élève)
La fiche élève restait bloquée sur « Chargement… » : elle attendait la période pour charger l'élève, alors que la période
vient de l'élève (bug déjà présent dans la version d'origine). Elle se charge maintenant normalement depuis *Élèves* et
*Résultats*, et s'affiche sur une seule colonne sur téléphone.
Correction annexe : les boutons ne passent plus sur deux lignes ; le tableau des comptes ne déborde plus.

---

# SchoolManager Pro — version 4 : cycle de vie des écoles

## Mise en service (dans cet ordre)

1. **Neon** : exécuter dans l'éditeur SQL tout le fichier `db/migration-v4.sql` (idempotent, sans risque pour les données).
2. **Vercel** → *Settings → Environment Variables* : ajouter `CRON_SECRET` avec une longue chaîne aléatoire (le même
   principe que `JWT_SECRET`). Vercel appelle alors chaque jour à 03 h (UTC) la tâche qui applique les fermetures et
   suppressions échues. *Sans `CRON_SECRET`, le cycle s'applique quand même* : à la connexion d'un utilisateur et à
   l'ouverture de la page Écoles (au plus une fois par heure) — mais la tâche quotidienne reste préférable.
3. `git push`, puis rechargement forcé (Ctrl+Maj+R).

## Comment ça fonctionne

`Active` → *suspension* (superadmin, **motif obligatoire**) → **30 jours** → *fermeture et archivage automatiques*
→ **1 an** d'archives → *suppression définitive automatique*.

- **Une école ne peut jamais être supprimée directement**, même par le superadmin : la suppression a été retirée
  (l'ancienne route répond désormais 405).
- **Suspension** : l'accès de **tous** les comptes de l'école (administrateurs, enseignants, élèves, parents) est coupé
  **immédiatement, y compris les sessions déjà ouvertes** (délai maximal de 15 secondes). Ils voient un écran expliquant le
  motif et la date limite de régularisation. Les données restent intactes.
- **Régularisation** : le superadmin clique sur *Réactiver* ; l'accès revient aussitôt.
- **Fermeture automatique** après 30 jours sans régularisation : l'école passe dans **Archives**. Plus personne ne peut se
  connecter, mais ses données sont conservées.
- **Archives** : pendant 1 an, le superadmin peut **restaurer** l'école ou **exporter ses données** (Excel), par exemple
  pour les remettre à une école qui les réclame.
- **Suppression définitive** automatique après 1 an d'archives (école, comptes et toutes ses données).
- **Journal permanent** de chaque étape (qui, quand, pourquoi), conservé même après la suppression définitive.
- Les écoles qui étaient déjà suspendues avec l'ancien interrupteur entrent dans le cycle : leur délai de 30 jours
  démarre à la date de la migration.

## Autres corrections
- **Erreur 504** : dans Express 4, une erreur dans une route asynchrone laissait la requête sans réponse jusqu'au délai
  d'expiration. Elle renvoie désormais une réponse d'erreur immédiate, partout dans l'application.
- Un compte supprimé, ou dont l'école n'existe plus, perd aussitôt son accès (un jeton ne survit plus à la suppression).

## Limites connues
- Une école supprimée **avant** cette version (ancienne suppression immédiate) n'est pas récupérable par l'application.
- Le message de blocage renvoie à « l'administration de la plateforme » : aucun contact précis n'y est affiché.

---

# SchoolManager Pro — version 3 : notes, titulaire, bulletins et reçus

## Mise en service (dans cet ordre)

1. **Neon** : ouvrir l'éditeur SQL et exécuter **tout** le contenu de `db/migration-v3.sql` (idempotent : sans risque
   sur vos données, on peut le relancer). Il crée la table des titulaires et celle du conseil de classe, ajoute les
   colonnes des interros multiples, du sexe/statut des élèves et des réglages d'impression, et reprend vos notes existantes.
2. `git push` : Vercel reconstruit tout seul.
3. Rechargement forcé (Ctrl+Maj+R) puis, dans **Paramètres**, choisir le modèle de bulletin, le modèle de reçu, la ville,
   le titre et le nom du chef d'établissement.

> À faire **avant** le push : le SQL. Sans lui, la saisie des notes et les nouveaux bulletins ne fonctionnent pas.

## Ce qui change

**1. Tableaux sur téléphone** — tout tableau trop large défile maintenant horizontalement (avec une ombre qui indique
qu'il reste des colonnes), au lieu d'être coupé.

**2. Enseignants cloisonnés + professeur titulaire**
- Un enseignant ne voit que les classes où il intervient : élèves, notes, présences, résultats, statistiques,
  **emploi du temps, examens, collègues et messagerie** (4 fuites corrigées : il voyait auparavant tout l'emploi du temps,
  tous les examens, tous les collègues et tous les parents/élèves de l'école).
- Dans sa classe, il ne note que **sa matière**.
- **Titulaire** : l'administrateur le désigne dans *Classes → détail → Professeur titulaire*. Le titulaire voit et gère
  **toute** la classe (toutes les matières), remplit le **conseil de classe** et imprime les **bulletins** de sa classe.
  Il est prévenu par une notification. (Les finances/écolage restent réservées à l'administration et à la caisse.)

**3. Calcul des notes** — plusieurs interros par matière, un devoir, une composition (plusieurs devoirs/compositions
possibles à titre exceptionnel) :
`moyenne des interros = somme ÷ nombre d'interros` → `note de classe = (moyenne des interros + devoir) ÷ 2` →
`moyenne générale = (note de classe + composition) ÷ 2`. Une interro manquée compte pour 0. La feuille de notes affiche
le résultat en direct. *Primaire : la note saisie est la note sur 20 (auparavant elle était divisée par 4).*

**4. Bulletins et reçus qui reproduisent vos documents papier** — nouveaux modèles : **Vogan** (paysage, matières
groupées littéraires/scientifiques/facultatives, rappel des semestres, montants en lettres ; blanc ou papier bleu),
**Baguida** (portrait, notes de classe, points obtenus, conduite, observations du conseil), **La Réussite** (trimestriel,
relevés de discipline, avertissement/blâme ; blanc ou papier bleu) et **reçu à talon** (B.P.F., somme en lettres,
année scolaire, classe, signatures ; blanc ou bleu). Les 5 modèles d'origine sont conservés. Le fichier
`apercu-modeles-bulletins-et-recus.pdf` montre chacun d'eux.
Nouvelles données sur les bulletins : sexe et statut de l'élève (formulaire Élèves), conduite, retards, absences,
décision du conseil, observations, avertissement/blâme, félicitations... (page **Conseil de classe**).

**5. Ordre de mérite** — impression par **classe/série**, par **niveau** ou pour **toute l'école** (page Résultats,
Classes ou Conseil de classe) : les bulletins sortent classés par niveau, puis classe, puis série, et dans chaque groupe
du 1er au dernier. Les ex æquo sont indiqués (« 3e ex »). Un lot de 60 bulletins se génère en quelques requêtes.

## Limites connues
- Pas de code QR sur les bulletins ; les cachets, signatures et filigranes se posent à la main sur le papier imprimé.
- Les modèles reprennent la structure, les colonnes et les couleurs de vos bulletins, pas le pixel près.
- Retards et absences du bulletin se saisissent dans le conseil de classe (ils ne sont pas repris automatiquement du
  module Présences, faute de dates de début et de fin de période dans l'application).
- Dans le modèle La Réussite, les notes sont sur 20 (le bulletin papier affiche des notes multipliées par le coefficient).

---

# SchoolManager Pro — refonte de l'interface (v2)

Cette version reprend la **structure** d'EduManagePro (menus par sections, barre du haut, cloche de
notifications, tableaux de bord par rôle, thème sombre, multi-langue) avec la **palette de SchoolManager Pro**
(vert tableau, laiton, parchemin). La logique métier (notes, moyennes, rangs, écolage, bulletins, cartes,
portée par enseignant, mode hors connexion) n'a pas été modifiée.

## Mise en service (3 commandes)

```bash
npm run db:init            # crée la table `notifications` (idempotent, sans risque sur une base existante)
cd client && npm install   # installe lucide-react (icônes) et met à jour package-lock.json — à committer
npm run build              # ou le build habituel (Vercel exécute déjà `npm install` puis `npm run build`)
```

Si votre déploiement utilise `npm ci`, lancez d'abord `npm install` une fois en local et committez le
`package-lock.json` mis à jour, sinon `npm ci` échouera (la dépendance `lucide-react` a été ajoutée).

Tant que `db:init` n'a pas été exécuté, l'application fonctionne normalement : seules les nouvelles
notifications de la cloche ne sont pas enregistrées (elles n'interrompent jamais une action métier).

## Ce qui est nouveau

**Interface**
- Barre latérale à sections avec icônes, logo et nom de l'école (repris des Paramètres), pastilles de non-lus.
- Barre du haut : titre de page, recherche instantanée d'élève (Ctrl/⌘ + K), période active, thème, langue,
  cloche de notifications, menu utilisateur.
- Thème clair / sombre / automatique, français / anglais (mémorisés sur l'appareil, sans flash au chargement).
- Tableau de bord par rôle : Administrateur (KPI, alertes, recouvrement, présences du jour, derniers paiements
  et inscrits, examens) et Enseignant (planning du jour, mes classes, accès direct à l'appel et aux notes).
  L'analyse pédagogique par niveau d'origine est conservée.
- Page 404, protection contre les « écrans blancs » (une erreur dans une page n'arrête plus l'application),
  squelettes de chargement, titre d'onglet dynamique, styles d'impression.
- Connexion en deux volets, adaptée au mobile.

**Nouvelles pages**
- **Présences** : appel d'une classe en quelques clics (Présent / Absent / Retard), refaire un appel, historique
  et élèves les plus absents. Fonctionne hors connexion (mise en file d'attente comme les notes).
- **Classes** : effectif, moyenne, réussite, assiduité, enseignants ; détail avec classement, bulletins et cartes.
- **Statistiques** : moyennes par matière, mentions, présences par mois, encaissements, recouvrement par niveau,
  meilleurs élèves / élèves en difficulté / plus absents. Un enseignant ne voit que ses classes ; les finances
  sont réservées à l'administration.
- **Notifications** : absences et retards (aux parents et à l'élève), nouvel examen, encaissement (à l'administration),
  plus les messages système déjà envoyés (reçus de paiement).

**Serveur (ajouts uniquement)** : `notifications`, `classes`, `stats`, `dashboard/apercu`,
`attendance/appel` et `attendance/synthese`. Trois déclencheurs de notification ont été ajoutés (présences,
examens, encaissements) ; ils sont protégés et ne peuvent pas faire échouer l'action d'origine.

**Correctifs** : le service worker servait `index.html` « cache d'abord », ce qui empêchait les utilisateurs de
recevoir les nouvelles versions ; il est maintenant « réseau d'abord » pour les pages. Le cache de données
hors connexion est aussi vidé à la déconnexion (postes partagés).

## Limites connues

- La traduction anglaise couvre la coque, le tableau de bord, la connexion et les nouvelles pages. Les écrans
  historiques (Élèves, Notes, Écolage, Bulletins…) restent en français.
- Le taux de présence suit la définition existante de la fiche élève : présents / total des appels
  (un retard n'est pas compté comme présent).
- Il n'y a pas de champ « sexe » sur les élèves : aucune statistique garçons/filles n'est affichée.
