// Qui peut changer SON PROPRE mot de passe ?
//   Superadmin et administrateur d'école : toujours.
//   Enseignant : seulement si l'administrateur de son école l'a autorisé (Paramètres).
//   Caissier, élève, parent : non — leur mot de passe est géré par l'administrateur de l'école.
// (Le serveur applique la même règle : ceci ne sert qu'à afficher ou masquer l'option.)
export function peutChangerMdp(user, ecole) {
  if (!user) return false;
  if (user.role === "SuperAdmin" || user.role === "Administrateur") return true;
  return user.role === "Enseignant" && !!ecole?.profsChangentMdp;
}
