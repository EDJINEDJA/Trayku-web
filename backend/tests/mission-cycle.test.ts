import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootstrap, type TraikuApp } from '../framework/app';
import { Modules, type PaymentModuleService } from '../framework';
import { MEMBER_MODULE, type MemberModuleService } from '../src/modules/member';
import { MISSION_MODULE, type MissionModuleService } from '../src/modules/mission';
import { createMissionWorkflow, type CreateMissionInput } from '../src/workflows/missions/create-mission';
import { acceptMissionWorkflow } from '../src/workflows/missions/accept-mission';
import { cancelMissionWorkflow } from '../src/workflows/missions/cancel-mission';
import { amountDue, missionTotal, payMissionWorkflow, settleMissionPayment } from '../src/workflows/payments';
import expireMissions from '../src/jobs/expire-missions';
import { PAYOUT_MODULE, type PayoutModuleService } from '../src/modules/payout';

/**
 * The life of a mission and its money, on the development base (after `npm run seed`): published,
 * paid with the test payment, taken by Karim, then delivered or cancelled; the reservation captured
 * or released each time. Everything it creates is removed at the end.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TITLE = 'Test auto · ';
let app: TraikuApp;
let missions: MissionModuleService;
let payments: PaymentModuleService;
let chloe: string;
let karim: string;
const created: string[] = [];

/** The subscribers run after the event: waits until `check` holds. */
async function eventually<T>(read: () => Promise<T>, check: (v: T) => boolean, ms = 4000): Promise<T> {
  const until = Date.now() + ms;
  for (;;) {
    const v = await read();
    if (check(v) || Date.now() > until) return v;
    await new Promise((r) => setTimeout(r, 100));
  }
}

const inDays = (d: number) => new Date(Date.now() + d * 86400000);

async function publish(title: string, extra: Partial<CreateMissionInput> = {}) {
  const input: CreateMissionInput = {
    requester_id: chloe,
    type: 'parcel',
    category: 'transfer',
    catalog_id: 'colis-carton',
    title: TITLE + title,
    description: 'Créée par les tests automatiques.',
    size: 'S',
    weight_kg: 1,
    pickup: { label: '12 rue Garibaldi, 69006 Lyon', city: 'Lyon 6e', latitude: 45.7701, longitude: 4.8519 },
    dropoff: { label: '4 place Bellecour, 69002 Lyon', city: 'Lyon 2e', latitude: 45.7578, longitude: 4.832 },
    deadline: inDays(3),
    recipient_name: 'Léa',
    recipient_phone: '+33600000009',
    price: 10,
    ...extra,
  };
  const { result } = await createMissionWorkflow(app.container).run({ input });
  created.push(result.id);
  return result;
}

const pay = (missionId: string, provider_id = 'system') =>
  payMissionWorkflow(app.container).run({ input: { mission_id: missionId, requester_id: chloe, provider_id, base_url: 'http://localhost:9000' } }).then((r) => r.result);

/** The mission's last payment, whatever its status. */
const paymentOf = async (id: string) => (await payments.listPayments({ resource_id: id }, { order: { created_at: 'DESC' }, take: 1 }))[0] ?? null;

before(async () => {
  app = await bootstrap(root, { subscribers: true });
  missions = app.container.resolve(MISSION_MODULE);
  payments = app.container.resolve(Modules.PAYMENT);
  const members = app.container.resolve<MemberModuleService>(MEMBER_MODULE);
  const idOf = async (phone: string) => {
    const [m] = await members.listMembers({ phone }, { take: 1 });
    assert.ok(m, `Compte ${phone} introuvable : lancez npm run seed`);
    return m.id;
  };
  chloe = await idOf('+33600000001');
  karim = await idOf('+33600000002');
});

after(async () => {
  if (!app) return;
  if (created.length) {
    const runs = await missions.listRuns({ mission_id: created });
    if (runs.length) await missions.deleteRuns(runs.map((r) => r.id));
    // The earnings the closing subscribers recorded for these missions.
    const payouts = app.container.resolve<PayoutModuleService>(PAYOUT_MODULE);
    const earnings = await payouts.listEarnings({ mission_id: created });
    if (earnings.length) await payouts.deleteEarnings(earnings.map((e) => e.id));
    const pays = await payments.listPayments({ resource_id: created });
    if (pays.length) await payments.deletePayments(pays.map((p) => p.id));
    await missions.deleteMissions(created);
  }
  await app.shutdown();
});

describe('cycle d’une mission et de son paiement', () => {
  it('reste cachée tant qu’elle n’est pas payée, puis s’ouvre', async () => {
    const m = await publish('payée puis ouverte');
    assert.equal(m.status, 'awaiting_payment');
    const search = () => missions.searchOpen({ deadlineAfter: new Date(), excludeRequester: karim, professions: [], obdReader: false, take: 500, skip: 0 });
    assert.ok(!(await search()).rows.some((r) => r.id === m.id), 'visible avant paiement');

    const res = await pay(m.id);
    assert.equal(res.payment.status, 'authorized');
    assert.equal(res.redirect_url, null);
    assert.equal(Number(res.payment.amount), missionTotal(m));
    assert.equal(res.mission.status, 'open');
    assert.ok((await search()).rows.some((r) => r.id === m.id), 'cachée après paiement');

    await assert.rejects(pay(m.id), /déjà payée/);
  });

  it('refuse un moyen de paiement inconnu', async () => {
    const m = await publish('moyen inconnu');
    await assert.rejects(pay(m.id, 'carte-cadeau'), /pas disponible/);
    assert.equal((await missions.retrieveMission(m.id)).status, 'awaiting_payment');
  });

  it('encaisse le total une fois livrée', async () => {
    const m = await publish('livrée');
    await pay(m.id);
    await acceptMissionWorkflow(app.container).run({ input: { mission_id: m.id, traveler_id: karim } });
    assert.equal((await missions.retrieveMission(m.id)).status, 'accepted');
    // The delivery itself needs the codes and photos of the run: here the mission is just closed.
    const run = await missions.activeRun(m.id);
    await missions.updateRuns({ id: run!.id, step: 'delivered', status: 'done', delivered_at: new Date(), tip: 2 });
    await missions.updateMissions({ id: m.id, status: 'delivered' });
    const settled = await settleMissionPayment(app.container, m.id);
    assert.equal(settled?.status, 'captured');
    // The tip comes on top, within what was reserved: the total at most.
    assert.equal(Number(settled?.captured_amount), missionTotal(m));
    // Twice: nothing more.
    assert.equal(await settleMissionPayment(app.container, m.id), null);
  });

  it('libère la réservation quand elle est annulée avant qu’on l’accepte', async () => {
    const m = await publish('annulée ouverte');
    await pay(m.id);
    const { result: terms } = await cancelMissionWorkflow(app.container).run({ input: { mission_id: m.id, requester_id: chloe } });
    assert.equal(terms.fee, 0);
    const p = await eventually(() => paymentOf(m.id), (p) => p?.status === 'canceled');
    assert.equal(p?.status, 'canceled');
    assert.equal(Number(p?.captured_amount), 0);
  });

  it('n’encaisse que les frais d’une annulation tardive', async () => {
    const m = await publish('annulée tard', { deadline: new Date(Date.now() + 2 * 3600000) });
    await pay(m.id);
    await acceptMissionWorkflow(app.container).run({ input: { mission_id: m.id, traveler_id: karim } });
    // Accepted an hour ago: past the free minutes.
    const run = await missions.activeRun(m.id);
    await missions.updateRuns({ id: run!.id, accepted_at: new Date(Date.now() - 3600000) });
    const { result: terms } = await cancelMissionWorkflow(app.container).run({ input: { mission_id: m.id, requester_id: chloe } });
    assert.ok(terms.fee > 0, 'des frais');
    const p = await eventually(() => paymentOf(m.id), (p) => p?.status === 'captured');
    assert.equal(p?.status, 'captured');
    assert.equal(Number(p?.captured_amount), terms.fee);
  });

  it('annule une mission jamais payée à son échéance', async () => {
    const m = await publish('jamais payée');
    await missions.updateMissions({ id: m.id, deadline: new Date(Date.now() - 60000) });
    await expireMissions(app.container);
    const after = await missions.retrieveMission(m.id);
    assert.equal(after.status, 'cancelled');
    assert.equal(await paymentOf(m.id), null);
  });

  it('lève la réservation d’une mission payée que personne n’a prise', async () => {
    const m = await publish('expirée payée');
    await pay(m.id);
    await missions.updateMissions({ id: m.id, deadline: new Date(Date.now() - 60000) });
    await expireMissions(app.container);
    assert.equal((await missions.retrieveMission(m.id)).status, 'cancelled');
    assert.equal((await paymentOf(m.id))?.status, 'canceled');
  });
});

describe('montant dû', () => {
  const base = { price: 18, service_fee: 2, insurance_fee: 0.5, cancel_fee: null, verify_only_price: 9, metadata: null };
  it('rien tant que la mission n’est pas close', () => {
    assert.equal(amountDue({ ...base, status: 'accepted' }), null);
  });
  it('le prix, les frais, le pourboire et le temps en plus une fois livrée', () => {
    assert.equal(amountDue({ ...base, status: 'delivered' }, [{ status: 'done', tip: 3, extra_amount: 4 }]), 27.5);
  });
  it('le prix « vérification seule » quand l’objet est refusé', () => {
    assert.equal(amountDue({ ...base, status: 'delivered', metadata: { outcome: 'verify_only' } }), 11.5);
  });
  it('les frais d’annulation, ou rien', () => {
    assert.equal(amountDue({ ...base, status: 'cancelled', cancel_fee: 5 }), 5);
    assert.equal(amountDue({ ...base, status: 'cancelled' }), 0);
  });
});
