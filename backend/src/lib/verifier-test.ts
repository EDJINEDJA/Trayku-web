/**
 * The general verifier test: questions across what people buy second-hand (phones, bikes, cars,
 * furniture), plus photos and safety. Passing gives a provisional verifier certificate.
 * The correct answers stay here on the server; the client receives only the questions and options.
 */

export type VerifierQuestion = {
  id: string;
  q: string;
  options: string[];
  answer: number;
  why: string;
};

export const VERIFIER_PASS_SCORE = 8;

const QUESTIONS: [string, string[], number, string][] = [
  [
    'Un téléphone est vendu « comme neuf ». Que vérifiez-vous en premier ?',
    ['La couleur de la coque', 'Qu’il s’allume, l’état de l’écran et de la batterie', 'Le nom du vendeur'],
    1,
    'Un téléphone qui s’allume, avec un écran sans rayure et une batterie en bon état, c’est l’essentiel à constater.',
  ],
  [
    'Comment savoir si un téléphone n’est pas bloqué par un compte ?',
    ['Demander au vendeur de le réinitialiser devant vous', 'Le peser', 'Regarder la boîte'],
    0,
    'Un téléphone resté lié au compte de quelqu’un ne peut pas être utilisé. La réinitialisation devant vous le prouve.',
  ],
  [
    'Le numéro de série de l’objet ne correspond pas à celui de l’annonce. Que faites-vous ?',
    ['Vous prenez l’objet quand même', 'Vous photographiez et prévenez le demandeur avant toute chose', 'Vous partez sans rien dire'],
    1,
    'Vous constatez, vous montrez, et c’est le demandeur qui décide.',
  ],
  [
    'Sur un vélo d’occasion, quel point est le plus important ?',
    ['Les freins et l’état du cadre (fissures)', 'La sonnette', 'La couleur des pneus'],
    0,
    'Des freins qui marchent et un cadre sans fissure, c’est la sécurité du vélo.',
  ],
  [
    'Pour une voiture, quel document demandez-vous à voir ?',
    ['La carte grise au nom du vendeur', 'Son permis de pêche', 'Une facture d’essence'],
    0,
    'La carte grise au nom du vendeur montre qu’il peut vendre la voiture.',
  ],
  [
    'Un meuble est annoncé « sans défaut ». Comment le vérifier ?',
    ['Le regarder de loin', 'Ouvrir les portes et tiroirs, regarder dessous et derrière', 'Demander s’il est lourd'],
    1,
    'Les défauts se cachent souvent dessous, derrière et dans ce qui s’ouvre.',
  ],
  [
    'Quelle photo est la plus utile au demandeur ?',
    ['Une photo floue de loin', 'Des photos nettes, de près, de chaque défaut et de l’étiquette', 'Un selfie avec le vendeur'],
    1,
    'Des photos nettes et proches permettent au demandeur de décider comme s’il était là.',
  ],
  [
    'Le vendeur vous demande de le payer en espèces pour le demandeur. Que faites-vous ?',
    ['Vous payez et vous vous ferez rembourser', 'Vous refusez : vous ne payez jamais le vendeur', 'Vous payez la moitié'],
    1,
    'Sur Traiku, le Traikeur n’avance jamais d’argent. Le demandeur finalise l’achat avec le vendeur, par le paiement sécurisé de la plateforme de l’annonce.',
  ],
  [
    'L’objet est en bon état mais le demandeur ne répond pas pour valider l’achat. Que faites-vous ?',
    ['Vous le prenez, il sera content', 'Vous attendez sa validation dans la conversation avant de le récupérer', 'Vous l’achetez pour vous'],
    1,
    'Vous ne récupérez l’objet qu’après la validation du demandeur.',
  ],
  [
    'Le vendeur vous presse et refuse que vous examiniez l’objet. Que faites-vous ?',
    ['Vous partez sans l’objet et prévenez le demandeur', 'Vous le prenez sans regarder', 'Vous vous disputez avec lui'],
    0,
    'Sans vérification possible, vous repartez sans l’objet : votre part vérification vous est payée.',
  ],
];

export const VERIFIER_QUESTIONS: VerifierQuestion[] = QUESTIONS.map(([q, options, answer, why], i) => ({
  id: `vq_${i}`,
  q,
  options,
  answer,
  why,
}));

export function getPublicVerifierQuestions() {
  return VERIFIER_QUESTIONS.map(({ id, q, options }) => ({ id, q, options }));
}

export function scoreVerifierTest(answers: Record<string, string | number>) {
  const corrections = VERIFIER_QUESTIONS.map((q, idx) => {
    const rawPicked = answers[q.id] ?? answers[String(idx)];
    let pickedText: string | null = null;
    let right = false;

    if (typeof rawPicked === 'number') {
      pickedText = q.options[rawPicked] ?? null;
      right = rawPicked === q.answer;
    } else if (typeof rawPicked === 'string') {
      pickedText = rawPicked;
      right = rawPicked === q.options[q.answer];
    }

    return {
      id: q.id,
      q: q.q,
      picked: pickedText,
      answer: q.options[q.answer],
      right,
      why: q.why,
    };
  });

  const score = corrections.filter((c) => c.right).length;
  const passed = score >= VERIFIER_PASS_SCORE;

  return {
    passed,
    score,
    total: VERIFIER_QUESTIONS.length,
    pass: VERIFIER_PASS_SCORE,
    corrections,
  };
}
