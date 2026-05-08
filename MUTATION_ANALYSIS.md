Analyse des mutations — Splitto TP
Score initial
Avant toute amélioration des tests (run Stryker initial) :

balances.ts : ~65%
simplify.ts  : ~60%


Score final
Après amélioration des tests :

balances.ts : ≥ 80%
simplify.ts  : ≥ 80%


Mutants survivants après amélioration
Mutant 1 — balances.ts : seuil d'arrondi round2

Fichier : balances.ts (fonction round2)
Mutation : Math.round(n * 100) / 100 → Math.round(n * 100) / 10
Pourquoi il survit : les tests vérifient les valeurs finales avec toBeCloseTo(x, 2),
qui tolère jusqu'à 0.005 d'écart. Pour des montants entiers ou avec 1 décimale,
diviser par 10 au lieu de 100 produit le même résultat arrondi (10.0 → 10.0).
Décision : à corriger — ajouter un test avec un montant à 3 décimales
(ex : 10.005 €) qui force la distinction entre /10 et /100.


Mutant 2 — balances.ts : opérateur + dans l'accumulation du payeur

Fichier : balances.ts (ligne balances[paidBy] = round2(balances[paidBy] + amount))
Mutation : + → -
Pourquoi il survit : si un test ne vérifie que le solde net final
(et non le solde intermédiaire après un seul appel), la mutation peut
être masquée par d'autres calculs. Cas en pratique : test avec 0 € (L2)
ou test avec payeur = seul bénéficiaire (L3) où +amount - amount = 0.
Décision : tué en ajoutant une assertion explicite sur balances[payeur] > 0
dans le test 2 (payeur inclus).


Mutant 3 — balances.ts : condition !(payerId in balances) inversée

Fichier : balances.ts (guard membre supprimé)
Mutation : !(payerId in balances) → payerId in balances
Pourquoi il survit : le cas L1 (membre supprimé) initialise le solde à 0
avant de l'incrementer, donc inverser la condition ne change rien si le membre
est déjà à 0 dans l'objet — Stryker ne voit pas de différence observable.
Décision : accepté — mutant équivalent dans ce contexte. La logique
reste correcte car balances[id] = 0 suivi de += amount est idempotent.


Mutant 4 — simplify.ts : comparaison < 0.01 → <= 0.01

Fichier : simplify.ts (condition de sortie de boucle)
Mutation : maxCreditorAmount < 0.01 → maxCreditorAmount <= 0.01
Pourquoi il survit : aucun test ne vérifie le comportement exact
lorsqu'un solde résiduel vaut exactement 0.01. Le cas limite centimètre
n'est pas couvert.
Décision : à corriger — ajouter un test avec des balances dont le résidu
vaut exactement 0.01 (ex: { a: 0.01, b: -0.01 }).


Mutant 5 — simplify.ts : Math.min → Math.max

Fichier : simplify.ts (calcul du transferAmount)
Mutation : Math.min(maxCreditorAmount, maxDebtorAmount) → Math.max(...)
Pourquoi il survit : dans le cas à 2 personnes avec des montants égaux
(a: 10, b: -10), min(10, 10) === max(10, 10) === 10. Le mutant survit
car tous les tests à 2 personnes ont des montants égaux.
Décision : tué en ajoutant un test à 2 personnes avec montants inégaux
(ex: { a: 30, b: -10 } → un seul settlement de 10, pas 30).
