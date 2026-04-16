// ─── suggestions.js ───────────────────────────────────────────────────────────
// Données des objectifs proposés dans le catalogue et l'onboarding.
// Chaque entrée contient :
//   key          : identifiant unique (string)
//   emoji        : icône affichée sur la carte
//   title        : intitulé de l'objectif
//   period       : 'day' | 'week' | 'month' | 'year'
//   mode         : 'list' (tâches à cocher) | 'percent' (slider 0-100%)
//   tasks        : tableau de libellés de tâches (vide si mode 'percent')
//   tips         : tableau de conseils { msg, url }
//                  - msg : conseil court (1-2 phrases max)
//                  - url : lien "En savoir plus" (optionnel)
//
// ⚠️  Chaque 'key' doit être unique — elle sert à relier un objectif à ses conseils.
// Pour ajouter un objectif : copier-coller un bloc existant et changer la key.
// ─────────────────────────────────────────────────────────────────────────────

const SUGGESTIONS = [

  // ════════════════════════════════════════════════════════════
  //  ANNUELS
  // ════════════════════════════════════════════════════════════

  {
    key: 'stop-smoking',
    emoji: '🚭',
    title: "J'arrête de fumer",
    period: 'year',
    mode: 'list',
    tasks: [
      "Ne pas acheter de cigarettes aujourd'hui",
      "Appeler un proche si envie forte",
      "Télécharger une app d'aide au sevrage",
      "Consulter un médecin ou tabacologue",
    ],
    tips: [
      { msg: "Les envies durent en moyenne 3 à 5 minutes. Tiens bon, ça passe ! 💪", url: "https://www.tabac-info-service.fr" },
      { msg: "Après 24h sans tabac, ton cœur commence déjà à récupérer.", url: "https://www.ameli.fr/assure/sante/tabac/arreter-de-fumer" },
      { msg: "L'app Tabac Info Service offre un suivi personnalisé gratuit.", url: "https://www.tabac-info-service.fr/J-arrete-de-fumer/Nos-outils-pour-vous-aider/Application-mobile" },
      { msg: "Remplace une cigarette par 5 min de marche — le manque s'évapore.", url: "https://www.who.int/fr/news-room/fact-sheets/detail/tobacco" },
    ],
  },

  {
    key: 'health',
    emoji: '❤️',
    title: "Prendre soin de ma santé",
    period: 'year',
    mode: 'list',
    tasks: [
      "Prendre rendez-vous chez le médecin généraliste",
      "Faire une prise de sang annuelle",
      "Consulter le dentiste",
      "Faire contrôler ma vue",
      "Consulter le dermatologue",
    ],
    tips: [
      { msg: "Un bilan annuel permet de détecter 80% des maladies chroniques tôt.", url: "https://www.ameli.fr/assure/sante/themes/suivi-medical" },
      { msg: "Les Français consultent le dentiste en moyenne 1 fois tous les 2 ans — trop peu !", url: "https://www.ameli.fr/assure/sante/themes/bucco-dentaire" },
      { msg: "La téléconsultation permet d'obtenir un rendez-vous rapidement.", url: "https://www.ameli.fr/assure/sante/telesante/teleconsultation-teleexpertise" },
    ],
  },

  // ════════════════════════════════════════════════════════════
  //  MENSUELS
  // ════════════════════════════════════════════════════════════

  {
    key: 'reduce-smoking',
    emoji: '🚬',
    title: "Je réduis ma consommation de tabac",
    period: 'month',
    mode: 'list',
    tasks: [
      "Passer de 20 à 15 cigarettes/jour cette semaine",
      "Eviter de fumer après les repas",
      "Repousser la première cigarette d'1h chaque matin",
      "Tenir un journal de ma consommation",
    ],
    tips: [
      { msg: "Repousser la première cigarette d'1h réduit la dépendance physique.", url: "https://www.tabac-info-service.fr" },
      { msg: "Tenir un journal aide à identifier tes déclencheurs.", url: "https://www.inpes.sante.fr/CFESBases/catalogue/pdf/1254.pdf" },
      { msg: "Réduire de 50% la consommation diminue significativement les risques.", url: "https://www.ameli.fr/assure/sante/tabac/arreter-de-fumer" },
    ],
  },

  {
    key: 'stop-snacking',
    emoji: '🍎',
    title: "J'arrête de grignoter",
    period: 'month',
    mode: 'list',
    tasks: [
      "Préparer des encas sains à la maison",
      "Ne pas acheter de biscuits ou chips",
      "Boire un grand verre d'eau avant de craquer",
      "Identifier mes déclencheurs (stress, ennui…)",
    ],
    tips: [
      { msg: "La faim émotionnelle arrive soudainement, la faim physique progressivement.", url: "https://www.mangerbouger.fr" },
      { msg: "Garder des fruits à portée de main réduit les grignotages de 30%.", url: "https://www.mangerbouger.fr/manger-mieux/que-veut-dire-bien-manger" },
      { msg: "Boire un verre d'eau coupe souvent une fausse sensation de faim.", url: "https://www.anses.fr/fr/content/les-references-nutritionnelles-en-vitamines-et-mineraux" },
    ],
  },

  {
    key: 'move-more',
    emoji: '🏃',
    title: "Bouger davantage",
    period: 'month',
    mode: 'list',
    tasks: [
      "Marcher 30 min par jour",
      "Prendre les escaliers plutôt que l'ascenseur",
      "M'inscrire à une activité sportive",
      "Faire du vélo ou de la course le week-end",
    ],
    tips: [
      { msg: "30 min de marche/jour réduisent le risque cardio-vasculaire de 35%.", url: "https://www.who.int/fr/news-room/fact-sheets/detail/physical-activity" },
      { msg: "L'OMS recommande 150 min d'activité modérée par semaine.", url: "https://www.who.int/fr/news-room/fact-sheets/detail/physical-activity" },
      { msg: "Marcher 10 000 pas/jour équivaut à environ 500 calories brûlées.", url: "https://www.mangerbouger.fr/bouger-plus" },
      { msg: "La sédentarité est le 4e facteur de risque de mortalité mondial.", url: "https://www.inserm.fr/dossier/sedentarite" },
    ],
  },

  {
    key: 'sleep',
    emoji: '😴',
    title: "Mieux dormir",
    period: 'month',
    mode: 'list',
    tasks: [
      "Me coucher avant minuit",
      "Arrêter les écrans 30 min avant de dormir",
      "Garder une heure de réveil fixe",
      "Créer une routine du soir apaisante",
    ],
    tips: [
      { msg: "La lumière bleue des écrans retarde la mélatonine de 90 min en moyenne.", url: "https://www.inserm.fr/dossier/sommeil" },
      { msg: "Un adulte a besoin de 7 à 9h de sommeil par nuit.", url: "https://www.inserm.fr/dossier/sommeil" },
      { msg: "Garder un horaire de réveil fixe est plus efficace qu'aller au lit tôt.", url: "https://www.sommeil-mg.net" },
      { msg: "La chambre idéale est à 18°C pour favoriser l'endormissement.", url: "https://www.inserm.fr/dossier/sommeil" },
    ],
  },

  {
    key: 'budget',
    emoji: '💰',
    title: "Mieux gérer mon budget",
    period: 'month',
    mode: 'list',
    tasks: [
      "Noter toutes mes dépenses cette semaine",
      "Préparer mes repas plutôt que commander",
      "Annuler les abonnements inutilisés",
      "Mettre de côté 10% de mes revenus",
    ],
    tips: [
      { msg: "La règle 50/30/20 : 50% besoins, 30% envies, 20% épargne.", url: "https://www.service-public.fr/particuliers/vosdroits/F2909" },
      { msg: "Les Français dépensent en moyenne 200€/an en abonnements inutilisés.", url: "https://www.moneyvox.fr" },
      { msg: "Cuisiner à la maison coûte 3x moins cher qu'une livraison.", url: "https://www.budget.gouv.fr" },
      { msg: "Automatiser son épargne est la méthode la plus efficace pour s'y tenir.", url: "https://www.lafinancepourtous.com/pratique/mes-finances" },
    ],
  },

  {
    key: 'screen-time',
    emoji: '📵',
    title: "Réduire le temps d'écran",
    period: 'month',
    mode: 'list',
    tasks: [
      "Limiter les réseaux sociaux à 30 min/jour",
      "Pas de téléphone pendant les repas",
      "Mode avion une heure avant de dormir",
      "Lire un livre à la place du scroll",
    ],
    tips: [
      { msg: "Les Français passent en moyenne 4h30/jour sur leur smartphone.", url: "https://www.arcom.fr" },
      { msg: "Le 'doomscrolling' augmente l'anxiété — mets un minuteur sur les apps.", url: "https://www.who.int/fr/campaigns/connecting-the-world-to-combat-coronavirus/healthyathome/healthyathome---mental-health" },
      { msg: "Activer le mode niveaux de gris rend l'écran moins attrayant.", url: "https://www.numerique.gouv.fr" },
      { msg: "Sans écran 1h avant de dormir améliore la qualité du sommeil de 25%.", url: "https://www.inserm.fr/dossier/sommeil" },
    ],
  },

  {
    key: 'self-care',
    emoji: '🧘',
    title: "Prendre du temps pour moi",
    period: 'month',
    mode: 'percent',
    tasks: [],
    tips: [
      { msg: "10 min de méditation par jour réduit le stress de façon mesurable.", url: "https://www.inserm.fr/dossier/meditation" },
      { msg: "Prendre soin de soi n'est pas égoïste, c'est essentiel.", url: "https://www.psycom.org" },
      { msg: "Les activités créatives (dessin, musique, cuisine) rechargent les batteries.", url: "https://www.who.int/fr/news-room/fact-sheets/detail/mental-health-strengthening-our-response" },
    ],
  },

  {
    key: 'reading',
    emoji: '📚',
    title: "Lire davantage",
    period: 'month',
    mode: 'list',
    tasks: [
      "Lire 20 pages par jour",
      "Toujours avoir un livre en cours",
      "Rejoindre un club de lecture",
      "Finir un livre ce mois-ci",
    ],
    tips: [
      { msg: "20 min de lecture/jour = 1 à 2 livres par mois.", url: "https://www.centrenationaldulivre.fr" },
      { msg: "La lecture de fiction développe l'empathie et la créativité.", url: "https://www.inserm.fr" },
      { msg: "Les bibliothèques municipales sont gratuites et souvent très bien fournies.", url: "https://www.culture.gouv.fr/Thematiques/Livre-et-Lecture/Les-bibliotheques" },
      { msg: "Lire 6 min réduit le stress de 68% selon une étude de l'université de Sussex.", url: "https://www.sussex.ac.uk" },
    ],
  },

  // ════════════════════════════════════════════════════════════
  //  HEBDOMADAIRES
  // ════════════════════════════════════════════════════════════

  {
    key: 'eat-well',
    emoji: '🥗',
    title: "Manger équilibré cette semaine",
    period: 'week',
    mode: 'list',
    tasks: [
      "Cuisiner maison au moins 4 repas",
      "Manger 5 fruits/légumes par jour",
      "Éviter la junk food",
      "Préparer ma liste de courses",
    ],
    tips: [
      { msg: "5 fruits et légumes/jour réduisent le risque de maladies chroniques de 20%.", url: "https://www.mangerbouger.fr" },
      { msg: "Préparer sa liste de courses évite 30% d'achats impulsifs.", url: "https://www.mangerbouger.fr/manger-mieux" },
      { msg: "Manger lentement aide à ressentir la satiété avant de trop manger.", url: "https://www.ameli.fr/assure/sante/themes/alimentation-adulte" },
    ],
  },

  {
    key: 'sport-week',
    emoji: '🏋️',
    title: "Faire du sport cette semaine",
    period: 'week',
    mode: 'list',
    tasks: [
      "3 séances de sport minimum",
      "Marcher 8000 pas/jour",
      "Faire 15 min d'étirements",
      "Aller à la piscine ou courir",
    ],
    tips: [
      { msg: "3 séances de 30 min suffisent à améliorer l'humeur et l'énergie.", url: "https://www.who.int/fr/news-room/fact-sheets/detail/physical-activity" },
      { msg: "S'étirer après le sport réduit les courbatures et améliore la souplesse.", url: "https://www.ffepgv.fr" },
      { msg: "Alterner cardio et renforcement musculaire est plus efficace qu'une seule activité.", url: "https://www.vidal.fr/sante/sport" },
    ],
  },

  {
    key: 'tidy-up',
    emoji: '🧹',
    title: "Organiser mon espace de vie",
    period: 'week',
    mode: 'list',
    tasks: [
      "Faire le ménage complet",
      "Désencombrer un tiroir ou placard",
      "Faire la lessive",
      "Préparer mes affaires pour la semaine",
    ],
    tips: [
      { msg: "Un espace rangé réduit le cortisol (hormone du stress) selon des études.", url: "https://www.psychologies.com" },
      { msg: "La méthode KonMari : ne garder que ce qui procure de la joie.", url: "https://konmari.com" },
      { msg: "Ranger 15 min par jour évite le grand ménage du week-end.", url: "https://www.psychologies.com/Bien-etre/Prevention/Hygiene-de-vie" },
    ],
  },

  {
    key: 'relationships',
    emoji: '🤝',
    title: "Entretenir mes relations",
    period: 'week',
    mode: 'list',
    tasks: [
      "Appeler un ami ou un proche",
      "Répondre aux messages en attente",
      "Planifier une sortie ou un dîner",
      "Prendre des nouvelles de ma famille",
    ],
    tips: [
      { msg: "Les liens sociaux forts sont le premier facteur de bonheur selon Harvard.", url: "https://www.adultdevelopmentstudy.org" },
      { msg: "Un simple SMS de soutien améliore l'humeur du destinataire.", url: "https://www.psychologies.com/Relations" },
      { msg: "Les personnes bien entourées vivent en moyenne 7 ans de plus.", url: "https://www.who.int/fr/news-room/fact-sheets/detail/mental-health-strengthening-our-response" },
    ],
  },

  {
    key: 'personal-project',
    emoji: '🎯',
    title: "Avancer sur mon projet perso",
    period: 'week',
    mode: 'list',
    tasks: [
      "Définir les 3 priorités de la semaine",
      "Consacrer 1h/jour à mon projet",
      "Faire un bilan vendredi",
      "Éliminer une distraction",
    ],
    tips: [
      { msg: "La règle des 2 min : si c'est faisable en 2 min, fais-le maintenant.", url: "https://gettingthingsdone.com" },
      { msg: "Travailler en blocs de 25 min (Pomodoro) booste la concentration.", url: "https://fr.wikipedia.org/wiki/Technique_Pomodoro" },
      { msg: "Écrire ses 3 priorités le soir pour le lendemain améliore la productivité.", url: "https://www.psychologies.com/Travail/Carrieres/Performance" },
      { msg: "Éliminer une distraction vaut plus qu'ajouter une heure de travail.", url: "https://www.deepwork.io" },
    ],
  },

];
