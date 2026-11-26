import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scoreVerifierTest, getPublicVerifierQuestions, VERIFIER_PASS_SCORE } from '../src/lib/verifier-test';

describe('Vérificateur Test', () => {
  it('masque les bonnes réponses dans les questions publiques', () => {
    const questions = getPublicVerifierQuestions();
    assert.equal(questions.length, 10);
    for (const q of questions) {
      assert.ok(q.id);
      assert.ok(q.q);
      assert.ok(Array.isArray(q.options));
      assert.equal((q as any).answer, undefined);
    }
  });

  it('calcule correctement un score parfait', () => {
    const answers: Record<string, number> = {
      vq_0: 1,
      vq_1: 0,
      vq_2: 1,
      vq_3: 0,
      vq_4: 0,
      vq_5: 1,
      vq_6: 1,
      vq_7: 1,
      vq_8: 1,
      vq_9: 0,
    };

    const res = scoreVerifierTest(answers);
    assert.equal(res.score, 10);
    assert.equal(res.passed, true);
    assert.equal(res.pass, VERIFIER_PASS_SCORE);
  });

  it('échoue si le score est inférieur au seuil requis', () => {
    const answers: Record<string, number> = {
      vq_0: 0,
      vq_1: 0,
      vq_2: 0,
      vq_3: 0,
      vq_4: 0,
    };

    const res = scoreVerifierTest(answers);
    assert.ok(res.score < VERIFIER_PASS_SCORE);
    assert.equal(res.passed, false);
  });
});
