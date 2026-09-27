"""
Regles d'acces, miroir exact de src/utils/permissions.ts cote frontend.

- Admin                -> voit tout, partout.
- Professeur titulaire d'une classe (classe.professeur_principal == user)
                       -> voit TOUTES les notes / le bulletin complet de CETTE classe,
                         meme les matieres qu'il n'enseigne pas lui-meme.
- Professeur non-titulaire -> voit / saisit UNIQUEMENT les notes des matieres
                         qu'il enseigne lui-meme dans cette classe (matiere.professeur == user).
- Parent               -> voit le bulletin complet de son/ses enfant(s) uniquement (lecture seule).

La saisie de notes (ajout/modif) est toujours limitee aux matieres que le prof
enseigne reellement -- etre titulaire ne donne PAS le droit de noter la matiere
d'un collegue, seulement de consulter.
"""
from .models import Classe, Matiere, Eleve


def is_titulaire_de_classe(user, classe: Classe) -> bool:
    return bool(user and classe and classe.professeur_principal_id == user.id)


def matieres_enseignees_par_prof(user_id, classe_id):
    """Matieres qu'un professeur enseigne reellement dans une classe donnee."""
    return Matiere.objects.filter(classe_id=classe_id, professeur_id=user_id)


def classes_du_professeur(user_id):
    """Toutes les classes ou ce professeur intervient (matiere enseignee OU titulaire)."""
    ids_via_matieres = Matiere.objects.filter(professeur_id=user_id).values_list('classe_id', flat=True)
    ids_via_titulaire = Classe.objects.filter(professeur_principal_id=user_id).values_list('id', flat=True)
    ids = set(ids_via_matieres) | set(ids_via_titulaire)
    return Classe.objects.filter(id__in=ids)


def eleves_du_professeur(user_id):
    """Eleves qu'un professeur a le droit de voir (dans ses classes)."""
    return Eleve.objects.filter(classe__in=classes_du_professeur(user_id))


def matieres_visibles(user, eleve: Eleve):
    """
    Matieres visibles pour l'utilisateur courant sur le bulletin d'un eleve donne.
    - admin / titulaire de la classe de l'eleve -> toutes les matieres de la classe
    - professeur non-titulaire -> seulement les matieres qu'il enseigne dans cette classe
    - parent / surveillant -> toutes les matieres de la classe (lecture seule)
    """
    matieres_de_la_classe = Matiere.objects.filter(classe=eleve.classe)
    if not user or not user.is_authenticated:
        return Matiere.objects.none()
    if user.role == 'admin':
        return matieres_de_la_classe
    if user.role == 'professeur':
        if is_titulaire_de_classe(user, eleve.classe):
            return matieres_de_la_classe
        return matieres_de_la_classe.filter(professeur=user)
    return matieres_de_la_classe
