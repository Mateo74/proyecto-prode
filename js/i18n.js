/**
 * i18n.js — Internationalization module for Once Metros.
 *
 * Usage:
 *   t('key')            — translated string
 *   t('key', {x:'y'})  — with {{x}} interpolation
 *   I18n.getLang()      — 'es' | 'en'
 *   I18n.setLang('en')  — save preference & reload page
 *   I18n.init()         — apply data-i18n attributes + inject lang toggle
 */
const I18n = (() => {
  const LANG_KEY = 'once_metros_lang';

  const STRINGS = {
    es: {
      // ── Navigation ───────────────────────────────────────────────────
      'nav.competitions':        'Competencias',
      'nav.friendTournaments':   'Torneos de amigos',
      'nav.groups':              'Grupos',
      'nav.predictions':         'Predicciones',
      'nav.myAccount':           'Mi cuenta',
      'nav.signIn':              'Ingresar',
      'nav.signOut':             'Cerrar sesión',
      'nav.menu':                'Menú',
      'nav.close':               'Cerrar',
      'nav.activeSession':       'Sesión activa',
      'nav.back':                'Volver',
      'nav.backToCompetitions':  'Volver a competencias',
      'nav.howPoints':           'Reglas',
      'nav.settings':            'Ajustes',

      // ── Section labels ─────────────────────────────────────────────
      'section.available':           'Disponibles',
      'section.competition':         'Competencia',
      'section.myPlays':             'Mis jugadas',
      'section.myTournaments':       'Mis torneos',
      'section.account':             'Cuenta',
      'section.invitation':          'Invitación',
      'section.friendTournament':    'Torneo de amigos',
      'section.friendTournamentCap': 'Torneo de Amigos',

      // ── Page headings ──────────────────────────────────────────────
      'page.competitions':  'Competencias',
      'page.matches':       'Partidos',
      'page.predictions':   'Predicciones',
      'page.groups':        'Grupos del Mundial',
      'page.myPredictions': 'Mis predicciones',
      'page.tournaments':   'Torneos de amigos',
      'page.ranking':       'Ranking',
      'page.match':         'Partido',
      'page.matchRanking':  'Ranking del partido',
      'page.signIn':        'Ingresar',
      'page.myAccount':     'Mi cuenta',
      'page.invitations':   'Invitaciones',
      'page.invite':        'Invitar',
      'page.loadingInvite': 'Cargando invitación...',

      // ── Tabs ──────────────────────────────────────────────────────
      'tab.signIn':            'Ingresar',
      'tab.register':          'Crear cuenta',
      'tab.pending':           'Pendientes',
      'tab.history':           'Historial',
      'tab.standings':         'Posiciones',
      'tab.myPredictions':     'Mis predicciones',
      'tab.predictions':       'Predicciones',
      'tab.matches':           'Partidos',
      'tab.groups':            'Grupos',
      'tab.friendTournaments': 'Torneos de Amigos',

      // ── Filters ───────────────────────────────────────────────────
      'filter.all':      'Todos',
      'filter.upcoming': 'Próximos',
      'filter.live':     'En vivo',
      'filter.finished': 'Finalizados',

      // ── Match badges ───────────────────────────────────────────────
      'badge.upcoming':  'Próximo',
      'badge.live':      'En Vivo',
      'badge.finished':  'Finalizado',
      'badge.cancelled': 'Cancelado',
      'badge.suspended': 'Suspendido',
      'match.final':     'FINAL',
      'match.live':      'EN VIVO',

      // ── Prediction ─────────────────────────────────────────────────
      'pred.label':   'Predicción',
      'pred.pending': 'Pendiente',
      'pred.hit':     'Acierto',
      'pred.miss':    'Fallo',
      'pred.noPred':  'Sin pred.',
      'pred.myPred':  'Mi pred: {{score}}',

      // ── Stats ─────────────────────────────────────────────────────
      'stat.points':   'Puntos',
      'stat.hits':     'Aciertos',
      'stat.accuracy': 'Efectividad',
      'stat.streak':   'Racha',
      'stat.pts':      'pts',
      'stat.hitsLc':   'aciertos',
      'stat.exactLc':  'exactos',

      // ── Grupos ────────────────────────────────────────────────────
      'groups.title':        'Grupo {{letter}}',
      'groups.team':         'Equipo',
      'groups.played':       'PJ',
      'groups.gf':           'GF',
      'groups.gc':           'GC',
      'groups.points':       'Pts',
      'groups.playedTitle':  'Partidos jugados',
      'groups.gfTitle':      'Goles a favor',
      'groups.gcTitle':      'Goles en contra',
      'groups.pointsTitle':  'Puntos predichos',
      'groups.empty':        'No hay grupos para mostrar.',
      'groups.fab':          'Ver grupos predichos',
      'groups.overlayTitle': 'Grupos predichos',
      'groups.prevGroup':    'Grupo anterior',
      'groups.nextGroup':    'Grupo siguiente',
      'action.close':        'Cerrar',

      // ── Actions ───────────────────────────────────────────────────
      'action.invite':          'Invitar',
      'action.rename':          'Cambiar nombre',
      'action.leaveMenu':       'Salir del torneo',
      'action.deleteMenu':      'Eliminar torneo',
      'action.back':            'Volver',
      'action.change':          'Cambiar',
      'action.create':          '+ Crear',
      'action.createTournament':'Crear torneo',
      'action.editTournament':  'Editar torneo',
      'action.saving':          'Guardando...',
      'action.creating':        'Creando...',
      'action.save':            'Guardar',
      'action.saveChanges':     'Guardar cambios',
      'action.savingChanges':   'Guardando...',
      'action.accept':          'Aceptar',
      'action.reject':          'Rechazar',
      'action.cancel':          'Cancelar',
      'action.delete':          'Eliminar',
      'action.leave':           'Salir',
      'action.revoke':          'Revocar',
      'action.cancelInvitation':'Cancelar invitación',
      'action.generateLink':    'Generar enlace',
      'action.regenerateLink':  'Regenerar',
      'action.copyLink':        'Copiar',
      'action.linkCopied':      '¡Enlace copiado!',
      'action.signInToJoin':    'Ingresar para unirme',
      'action.joinTournament':  'Unirme al torneo',
      'action.seeCompetitions': 'Ver competencias',
      'action.goHome':          'Ir al inicio',
      'action.deleteAccount':   'Eliminar mi cuenta',
      'action.deleteAccount2':  'Eliminar cuenta',
      'action.deleting':        'Eliminando...',
      'action.logout':          'Cerrar sesión',
      'action.processing':      'Procesando...',
      'action.changePhoto':     'Cambiar foto',
      'action.moreOptions':     'Más opciones',
      'action.loadMore':        'Mostrar más',
      'match.liveScoresNotice': 'Los puntajes son provisorios mientras el partido está en vivo.',
      'match.vs':               'vs',

      // ── Auth form ──────────────────────────────────────────────────
      'auth.or':                  'o',
      'auth.userOrEmail':         'Usuario o email',
      'auth.password':            'Clave',
      'auth.username':            'Usuario',
      'auth.name':                'Nombre',
      'auth.lastName':            'Apellido',
      'auth.email':               'Email',
      'auth.error.invalidCredentials': 'Credenciales inválidas.',
      'auth.error.networkError':       'No se pudo conectar con el servidor. Verificá tu conexión.',
      'auth.error.sessionExpired':     'Tu sesión expiró. Iniciá sesión de nuevo.',
      'auth.error.duplicateAccount':   'Ya existe una cuenta con ese usuario o email.',

      // ── Empty states ───────────────────────────────────────────────
      'empty.noCompetitions':    'No hay competencias disponibles.',
      'empty.noMatches':         'No hay partidos para este filtro.',
      'empty.chooseCompetition': 'Elegí una competencia para ver partidos.',
      'empty.noUpcoming':        'No hay partidos en esta competencia.',
      'empty.noUpcomingTorneo':  'No hay partidos para esta competencia.',
      'empty.signInForTorneos':  'Iniciá sesión para ver los Torneos de Amigos.',
      'empty.noTorneosForComp':  'Todavía no sos parte de ningún Torneo de Amigos para esta competencia.',
      'empty.noTorneos':         '¡Todavía no sos parte de ningún Torneo de Amigos. Creá uno o pedí una invitación!',
      'empty.noPendingPreds':    'No tenés predicciones pendientes.',
      'empty.noHistory':         'Todavía no tenés historial.',
      'empty.chooseTorneo':      'Elegí un Torneo de Amigos.',
      'empty.signInForPreds':    'Iniciá sesión para ver tus predicciones.',
      'empty.chooseTorneoRank':  'Elegí un Torneo de Amigos para ver el ranking.',
      'empty.noScoresYet':       'Todavía no hay puntajes en este torneo.',
      'match.predsHidden':       'Las predicciones se revelan cuando el partido empieza.',
      'match.noPred':            'Sin predicción',
      'empty.chooseTorneoMatch': 'Elegí un Torneo de Amigos para ver los próximos partidos.',
      'empty.noInvitations':     'No tenés invitaciones pendientes.',
      'empty.noSentInvitations': 'Todavía no enviaste invitaciones.',
      'empty.noClosedMatches':   'No hay partidos cerrados en esta competencia.',
      'empty.tournamentNotFound':'No se encontró el torneo.',
      'empty.signInForTorneoPage':'Iniciá sesión para ver tus Torneos de Amigos',
      'empty.noCompetencia':     'Sin competencia',
      'empty.noTorneo':          'Sin torneo',

      // ── Confirmations ──────────────────────────────────────────────
      'confirm.leaveTorneo':   '¿Salir del torneo "{{name}}"?',
      'confirm.deleteTorneo':  '¿Eliminar el torneo "{{name}}"?',
      'confirm.revokeLink':    '¿Revocar el enlace? Quien lo tenga no va a poder usarlo.',
      'confirm.cancelInvite':  '¿Cancelar esta invitación?',
      'confirm.deleteAccount': '¿Estás seguro de que querés eliminar tu cuenta?\nSe borrarán todas tus predicciones de forma permanente.',

      // ── Alerts ────────────────────────────────────────────────────
      'alert.inviteLinkError':  'No se pudo generar el enlace. Intentá de nuevo.',
      'alert.noInviteLink':     'El creador del torneo aún no generó un enlace de invitación.',
      'alert.leaveTorneoError': 'No se pudo salir del torneo.',
      'alert.deleteTorneoError':'No se pudo eliminar el torneo.',

      // ── Feedback messages ──────────────────────────────────────────
      'feedback.invitationSent':  'Invitación enviada a {{value}}.',
      'feedback.linkRegenerated': 'Enlace regenerado.',
      'feedback.linkRevoked':     'Enlace revocado.',
      'feedback.linkCopied':      'Enlace copiado.',
      'feedback.joined':          'Te uniste al torneo.',
      'feedback.photoUpdated':    'Foto actualizada.',
      'feedback.photoNotImage':   'El archivo debe ser una imagen.',
      'feedback.photoTooLarge':   'La imagen es demasiado grande. Elegí una más pequeña.',
      'feedback.photoReadError':  'No se pudo leer la imagen.',
      'feedback.changesSaved':    'Cambios guardados.',

      // ── Invite statuses ────────────────────────────────────────────
      'inviteStatus.pending':   'Pendiente',
      'inviteStatus.accepted':  'Aceptada',
      'inviteStatus.rejected':  'Rechazada',
      'inviteStatus.cancelled': 'Cancelada',

      // ── Members count ──────────────────────────────────────────────
      'members.open': 'Abierto',
      'members.one':  '1 miembro',
      'members.many': '{{n}} miembros',

      // ── Share ──────────────────────────────────────────────────────
      'share.title':      'Te invitaron al torneo {{name}} | Once Metros',
      'share.text':       '{{competition}}: Predecí los resultados y competí con tus amigos.',
      'share.promptCopy': 'Copí este enlace para invitar:',

      // ── Tournament / invite landing ────────────────────────────────
      'torneo.invalidInvite':         'Invitación inválida',
      'torneo.invalidInviteRevoked':  'Invitación inválida o revocada',
      'torneo.missingToken':          'Falta el token de la invitación.',
      'torneo.joinTitle':             'Sumate a "{{name}}"',
      'torneo.friendTournament':      'Torneo de amigos',

      // ── Profile ────────────────────────────────────────────────────
      'profile.personalInfo':       'Información personal',
      'profile.session':            'Sesión',
      'profile.sessionDesc':        'Cerrá sesión en este dispositivo. Tu cuenta y predicciones se conservan.',
      'profile.dangerZone':         'Zona de peligro',
      'profile.deleteAccountTitle': 'Eliminar cuenta',
      'profile.deleteAccountDesc':  'Esta acción es permanente. Se borrarán tu cuenta y todas tus predicciones de forma irreversible.',
      'profile.loading':            'Cargando...',
      'profile.saveChanges':        'Guardar cambios',
      'profile.changesSaved':       'Cambios guardados.',
      'profile.loadError':          'No se pudo cargar el perfil.',
      'profile.username':           'Usuario',

      // ── Settings page ─────────────────────────────────────────────
      'settings.language':              'Idioma',
      'settings.languageDesc':          'Eligí el idioma de la aplicación.',
      'section.settings':          'Configuración',
      'page.settings':             'Ajustes',
      'profile.nombre':             'Nombre',
      'profile.apellido':           'Apellido',
      'profile.email':              'Email',

      // ── Scoring page ──────────────────────────────────────────────
      'page.howPoints':             'Cómo se calculan los puntos',
      'section.rules':              'Reglas',
      'scoring.exact':              'Resultado exacto',
      'scoring.sameDiff':           'Misma diferencia / ganador o empate correcto',
      'scoring.correctOutcome':     'Ganador o empate correcto (sin acertar diferencia)',
      'scoring.wrong':              'Resultado incorrecto',
      'scoring.bonusNote':          '<strong>Bonus de goles:</strong> cuando el partido tiene más de 3 goles, los puntos por acierto exacto equivalen al total de goles. Por ejemplo, acertar un 4-2 vale 6 puntos.',
      'scoring.extraTimeNote':      'Para partidos que van a tiempo extra, los puntos se calculan según el resultado al final del tiempo extra (no a los 90 minutos). Los penales no se toman en cuenta.',
      'scoring.lockNote':           'Las predicciones se bloquean automáticamente al inicio del partido (hora de comienzo programada). Podés predecir en cualquier momento antes de esa hora.',
      'scoring.pts3':               '3 pts <small>(o más)</small>',
      'scoring.pts2':               '2 pts',
      'scoring.pts1':               '1 pt',
      'scoring.pts0':               '0 pts',

      // ── Tournament name placeholder ────────────────────────────────
      'torneo.namePlaceholder':     'Nombre del torneo',

      // ── Invite page ────────────────────────────────────────────────
      'invite.searchLabel':      'Por usuario o email',
      'invite.searchPlaceholder':'usuario o email@dominio',
      'invite.linkHead':         'Enlace de invitación',
      'invite.linkPlaceholder':  'Generá un enlace para compartir',
      'invite.sentInvitations':  'Invitaciones enviadas',

      // ── Locale strings for date formatting ────────────────────────
      'locale':     'es-ES',
      'localeDate': 'es-AR',
    },

    en: {
      // ── Navigation ───────────────────────────────────────────────────
      'nav.competitions':        'Competitions',
      'nav.friendTournaments':   'Friends Tournaments',
      'nav.groups':              'Groups',
      'nav.predictions':         'Predictions',
      'nav.myAccount':           'My account',
      'nav.signIn':              'Sign in',
      'nav.signOut':             'Sign out',
      'nav.menu':                'Menu',
      'nav.close':               'Close',
      'nav.activeSession':       'Active session',
      'nav.back':                'Back',
      'nav.backToCompetitions':  'Back to competitions',
      'nav.howPoints':           'Rules',
      'nav.settings':            'Settings',

      // ── Section labels ─────────────────────────────────────────────
      'section.available':           'Available',
      'section.competition':         'Competition',
      'section.myPlays':             'My plays',
      'section.myTournaments':       'My tournaments',
      'section.account':             'Account',
      'section.invitation':          'Invitation',
      'section.friendTournament':    'Friends tournament',
      'section.friendTournamentCap': 'Friends Tournament',

      // ── Page headings ──────────────────────────────────────────────
      'page.competitions':  'Competitions',
      'page.matches':       'Matches',
      'page.predictions':   'Predictions',
      'page.groups':        'World Cup Groups',
      'page.myPredictions': 'My predictions',
      'page.tournaments':   'Friends Tournaments',
      'page.ranking':       'Ranking',
      'page.match':         'Match',
      'page.matchRanking':  'Match ranking',
      'page.myAccount':     'My account',
      'page.invitations':   'Invitations',
      'page.invite':        'Invite',
      'page.loadingInvite': 'Loading invitation...',

      // ── Tabs ──────────────────────────────────────────────────────
      'tab.signIn':            'Sign in',
      'tab.register':          'Create account',
      'tab.pending':           'Pending',
      'tab.history':           'History',
      'tab.standings':         'Standings',
      'tab.myPredictions':     'My predictions',
      'tab.predictions':       'Predictions',
      'tab.matches':           'Matches',
      'tab.groups':            'Groups',
      'tab.friendTournaments': 'Friends Tournaments',

      // ── Filters ───────────────────────────────────────────────────
      'filter.all':      'All',
      'filter.upcoming': 'Upcoming',
      'filter.live':     'Live',
      'filter.finished': 'Finished',

      // ── Match badges ───────────────────────────────────────────────
      'badge.upcoming':  'Upcoming',
      'badge.live':      'Live',
      'badge.finished':  'Finished',
      'badge.cancelled': 'Cancelled',
      'badge.suspended': 'Suspended',
      'match.final':     'FINAL',
      'match.live':      'LIVE',

      // ── Prediction ─────────────────────────────────────────────────
      'pred.label':   'Prediction',
      'pred.pending': 'Pending',
      'pred.hit':     'Hit',
      'pred.miss':    'Miss',
      'pred.noPred':  'No pred.',
      'pred.myPred':  'My pred: {{score}}',

      // ── Stats ─────────────────────────────────────────────────────
      'stat.points':   'Points',
      'stat.hits':     'Hits',
      'stat.accuracy': 'Accuracy',
      'stat.streak':   'Streak',
      'stat.pts':      'pts',
      'stat.hitsLc':   'hits',
      'stat.exactLc':  'exact',

      // ── Grupos ────────────────────────────────────────────────────
      'groups.title':        'Group {{letter}}',
      'groups.team':         'Team',
      'groups.played':       'MP',
      'groups.gf':           'GF',
      'groups.gc':           'GA',
      'groups.points':       'Pts',
      'groups.playedTitle':  'Matches played',
      'groups.gfTitle':      'Goals for',
      'groups.gcTitle':      'Goals against',
      'groups.pointsTitle':  'Predicted points',
      'groups.empty':        'No groups to show.',
      'groups.fab':          'View predicted groups',
      'groups.overlayTitle': 'Predicted groups',
      'groups.prevGroup':    'Previous group',
      'groups.nextGroup':    'Next group',
      'action.close':        'Close',

      // ── Actions ───────────────────────────────────────────────────
      'action.invite':          'Invite',
      'action.rename':          'Rename',
      'action.leaveMenu':       'Leave tournament',
      'action.deleteMenu':      'Delete tournament',
      'action.back':            'Back',
      'action.change':          'Change',
      'action.create':          '+ Create',
      'action.createTournament':'Create tournament',
      'action.editTournament':  'Edit tournament',
      'action.saving':          'Saving...',
      'action.creating':        'Creating...',
      'action.save':            'Save',
      'action.saveChanges':     'Save changes',
      'action.savingChanges':   'Saving...',
      'action.accept':          'Accept',
      'action.reject':          'Reject',
      'action.cancel':          'Cancel',
      'action.delete':          'Delete',
      'action.leave':           'Leave',
      'action.revoke':          'Revoke',
      'action.cancelInvitation':'Cancel invitation',
      'action.generateLink':    'Generate link',
      'action.regenerateLink':  'Regenerate',
      'action.copyLink':        'Copy',
      'action.linkCopied':      'Link copied!',
      'action.signInToJoin':    'Sign in to join',
      'action.joinTournament':  'Join tournament',
      'action.seeCompetitions': 'View competitions',
      'action.goHome':          'Go to home',
      'action.deleteAccount':   'Delete my account',
      'action.deleteAccount2':  'Delete account',
      'action.deleting':        'Deleting...',
      'action.logout':          'Sign out',
      'action.processing':      'Processing...',
      'action.changePhoto':     'Change photo',
      'action.moreOptions':     'More options',
      'action.loadMore':        'Load more',
      'match.liveScoresNotice': 'Scores are provisional while the match is live.',
      'match.vs':               'vs',

      // ── Auth form ──────────────────────────────────────────────────
      'auth.or':                  'or',
      'auth.userOrEmail':         'Username or email',
      'auth.password':            'Password',
      'auth.username':            'Username',
      'auth.name':                'Name',
      'auth.lastName':            'Last name',
      'auth.email':               'Email',
      'auth.error.invalidCredentials': 'Invalid credentials.',
      'auth.error.networkError':       'Could not connect to the server. Check your connection.',
      'auth.error.sessionExpired':     'Your session expired. Please sign in again.',
      'auth.error.duplicateAccount':   'An account with that username or email already exists.',

      // ── Empty states ───────────────────────────────────────────────
      'empty.noCompetitions':    'No competitions available.',
      'empty.noMatches':         'No matches for this filter.',
      'empty.chooseCompetition': 'Choose a competition to see matches.',
      'empty.noUpcoming':        'No matches in this competition.',
      'empty.noUpcomingTorneo':  'No matches for this competition.',
      'empty.signInForTorneos':  'Sign in to see Friends Tournaments.',
      'empty.noTorneosForComp':  "You're not part of any Friends Tournament for this competition yet.",
      'empty.noTorneos':         "You're not part of any Friends Tournament yet. Create one or request an invite!",
      'empty.noPendingPreds':    'You have no pending predictions.',
      'empty.noHistory':         'No prediction history yet.',
      'empty.chooseTorneo':      'Choose a Friends Tournament.',
      'empty.signInForPreds':    'Sign in to see your predictions.',
      'empty.chooseTorneoRank':  'Choose a Friends Tournament to see the ranking.',
      'empty.noScoresYet':       'No scores yet in this tournament.',
      'match.predsHidden':       'Predictions are revealed when the match kicks off.',
      'match.noPred':            'No prediction',
      'empty.chooseTorneoMatch': 'Choose a Friends Tournament to see upcoming matches.',
      'empty.noInvitations':     'You have no pending invitations.',
      'empty.noSentInvitations': "You haven't sent any invitations yet.",
      'empty.noClosedMatches':   'No closed matches in this competition.',
      'empty.tournamentNotFound':'Tournament not found.',
      'empty.signInForTorneoPage':'Sign in to see your Friends Tournaments',
      'empty.noCompetencia':     'No competition',
      'empty.noTorneo':          'No tournament',

      // ── Confirmations ──────────────────────────────────────────────
      'confirm.leaveTorneo':   'Leave tournament "{{name}}"?',
      'confirm.deleteTorneo':  'Delete tournament "{{name}}"?',
      'confirm.revokeLink':    "Revoke the link? Anyone who has it won't be able to use it.",
      'confirm.cancelInvite':  'Cancel this invitation?',
      'confirm.deleteAccount': "Are you sure you want to delete your account?\nAll your predictions will be permanently deleted.",

      // ── Alerts ────────────────────────────────────────────────────
      'alert.inviteLinkError':  'Could not generate the link. Please try again.',
      'alert.noInviteLink':     'The tournament creator has not generated an invite link yet.',
      'alert.leaveTorneoError': 'Could not leave the tournament.',
      'alert.deleteTorneoError':'Could not delete the tournament.',

      // ── Feedback messages ──────────────────────────────────────────
      'feedback.invitationSent':  'Invitation sent to {{value}}.',
      'feedback.linkRegenerated': 'Link regenerated.',
      'feedback.linkRevoked':     'Link revoked.',
      'feedback.linkCopied':      'Link copied.',
      'feedback.joined':          'You joined the tournament.',
      'feedback.photoUpdated':    'Photo updated.',
      'feedback.photoNotImage':   'The file must be an image.',
      'feedback.photoTooLarge':   'The image is too large. Please choose a smaller one.',
      'feedback.photoReadError':  'Could not read the image. Try a different format.',
      'feedback.changesSaved':    'Changes saved.',

      // ── Invite statuses ────────────────────────────────────────────
      'inviteStatus.pending':   'Pending',
      'inviteStatus.accepted':  'Accepted',
      'inviteStatus.rejected':  'Rejected',
      'inviteStatus.cancelled': 'Cancelled',

      // ── Members count ──────────────────────────────────────────────
      'members.open': 'Open',
      'members.one':  '1 member',
      'members.many': '{{n}} members',

      // ── Share ──────────────────────────────────────────────────────
      'share.title':      "You've been invited to {{name}} | Once Metros",
      'share.text':       '{{competition}}: Predict results and compete with your friends.',
      'share.promptCopy': 'Copy this link to invite:',

      // ── Tournament / invite landing ────────────────────────────────
      'torneo.invalidInvite':        'Invalid invitation',
      'torneo.invalidInviteRevoked': 'Invalid or revoked invitation',
      'torneo.missingToken':         'Missing invitation token.',
      'torneo.joinTitle':            'Join "{{name}}"',
      'torneo.friendTournament':     'Friends tournament',

      // ── Profile ────────────────────────────────────────────────────
      'profile.personalInfo':       'Personal information',
      'profile.session':            'Session',
      'profile.sessionDesc':        'Sign out of this device. Your account and predictions are preserved.',
      'profile.dangerZone':         'Danger zone',
      'profile.deleteAccountTitle': 'Delete account',
      'profile.deleteAccountDesc':  'This action is permanent. Your account and all your predictions will be irreversibly deleted.',
      'profile.loading':            'Loading...',
      'profile.saveChanges':        'Save changes',
      'profile.changesSaved':       'Changes saved.',
      'profile.loadError':          'Could not load profile.',
      'profile.username':           'Username',

      // ── Settings page ─────────────────────────────────────────────
      'settings.language':              'Language',
      'settings.languageDesc':          'Choose the app language.',
      'section.settings':          'Settings',
      'page.settings':             'Settings',
      'profile.nombre':             'First name',
      'profile.apellido':           'Last name',
      'profile.email':              'Email',

      // ── Scoring page ──────────────────────────────────────────────
      'page.howPoints':             'How points are calculated',
      'section.rules':              'Rules',
      'scoring.exact':              'Exact result',
      'scoring.sameDiff':           'Same goal difference / correct winner or draw',
      'scoring.correctOutcome':     'Correct winner or draw (wrong goal difference)',
      'scoring.wrong':              'Incorrect result',
      'scoring.bonusNote':          '<strong>Goal bonus:</strong> when a match has more than 3 goals, the points for an exact prediction equal the total goals. For example, correctly predicting 4-2 is worth 6 points.',
      'scoring.extraTimeNote':      'For matches that go to extra time, points are calculated on the result at the end of extra time (not after 90 minutes). Penalties are not taken into account.',
      'scoring.lockNote':           'Predictions are automatically locked at the scheduled match start time. You can make or update your prediction any time before kick-off.',
      'scoring.pts3':               '3 pts <small>(or more)</small>',
      'scoring.pts2':               '2 pts',
      'scoring.pts1':               '1 pt',
      'scoring.pts0':               '0 pts',

      // ── Tournament name placeholder ────────────────────────────────
      'torneo.namePlaceholder':     'Tournament name',

      // ── Invite page ────────────────────────────────────────────────
      'invite.searchLabel':      'By username or email',
      'invite.searchPlaceholder':'username or email@domain',
      'invite.linkHead':         'Invite link',
      'invite.linkPlaceholder':  'Generate a link to share',
      'invite.sentInvitations':  'Sent invitations',

      // ── Locale strings for date formatting ────────────────────────
      'locale':     'en-US',
      'localeDate': 'en-US',
    },
  };

  function getLang() {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === 'en' || stored === 'es') return stored;
    // Auto-detect from browser/OS language on first visit
    const browserLang = (navigator.language || navigator.userLanguage || 'es').split('-')[0].toLowerCase();
    return browserLang === 'en' ? 'en' : 'es';
  }

  function setLang(lang) {
    localStorage.setItem(LANG_KEY, lang);
    window.location.reload();
  }

  function t(key, vars) {
    const lang = getLang();
    const dict = STRINGS[lang] || STRINGS.es;
    let str = dict[key];
    if (str === undefined) str = STRINGS.es[key];
    if (str === undefined) return key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(new RegExp('\\{\\{' + k + '\\}\\}', 'g'), String(v == null ? '' : v));
      }
    }
    return str;
  }

  function init() {
    const lang = getLang();
    document.documentElement.lang = lang;

    // Apply data-i18n (text content)
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    // Apply data-i18n-placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    // Apply data-i18n-title (tooltip)
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = t(el.dataset.i18nTitle);
    });
    // Apply data-i18n-aria (aria-label)
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      el.setAttribute('aria-label', t(el.dataset.i18nAria));
    });
    // Apply data-i18n-html (innerHTML — use with caution)
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      el.innerHTML = t(el.dataset.i18nHtml);
    });
  }

  return { t, getLang, setLang, init };
})();

// Make t() available globally so app.js / predictions.js can call it directly
function t(key, vars) { return I18n.t(key, vars); }

// Auto-initialize: process data-i18n attrs and inject lang toggle
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => I18n.init());
} else {
  I18n.init();
}
