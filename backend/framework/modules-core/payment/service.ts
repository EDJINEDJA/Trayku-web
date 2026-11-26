import { TraikuService } from '../../modules';
import { TraikuError } from '../../utils';
import Payment from './models/payment';
import { currencyDigits, type PaymentMode, type PaymentProvider } from './providers';

type PaymentRow = Awaited<ReturnType<PaymentModuleService['retrievePayment']>>;

export type InitiatePaymentInput = {
  resource_id: string;
  payer_id?: string | null;
  provider_id: string;
  amount: number;
  currency_code: string;
  description: string;
  /** Builds the provider's return and cancel addresses from the new payment's id. */
  urls: (payment_id: string) => { return_url: string; cancel_url: string };
};

const round = (v: number, currency: string) => Number(v.toFixed(currencyDigits(currency)));

/**
 * As Medusa's payment module: the providers registered from traiku-config.ts (`payment`), all in
 * the same mode, test or live. Each payment is reserved, then captured (the whole or a part, the rest
 * released), cancelled, or refunded once captured. Every change is kept on the row.
 */
export default class PaymentModuleService extends TraikuService({ Payment }) {
  private providers = new Map<string, PaymentProvider>();
  mode: PaymentMode = 'test';

  registerProvider(provider: PaymentProvider) {
    if (provider.mode !== this.mode) throw new Error(`Paiement : ${provider.id} est en mode ${provider.mode}, le module en mode ${this.mode}`);
    this.providers.set(provider.id, provider);
  }

  /** What the payer can choose, in this mode. */
  listProviders() {
    return [...this.providers.values()].map((p) => ({ id: p.id, label: p.label, mode: p.mode }));
  }

  private provider(id: string) {
    const p = this.providers.get(id);
    if (!p) throw new TraikuError(TraikuError.Types.INVALID_DATA, 'Ce moyen de paiement n’est pas disponible.', 'payment_provider_unknown');
    return p;
  }

  /** The payment of a resource that still counts: reserved or captured, else the last one opened. */
  async paymentOf(resource_id: string): Promise<PaymentRow | null> {
    const list = await this.listPayments({ resource_id }, { order: { created_at: 'DESC' }, take: 10 });
    return list.find((p) => p.status === 'authorized' || p.status === 'captured') ?? list.find((p) => p.status === 'pending') ?? null;
  }

  /** Opens a payment; the ones still pending for the same resource are dropped. */
  async initiatePayment(input: InitiatePaymentInput) {
    const provider = this.provider(input.provider_id);
    if (!(input.amount > 0)) throw new TraikuError(TraikuError.Types.INVALID_DATA, 'Montant invalide.');
    const current = await this.paymentOf(input.resource_id);
    if (current && current.status !== 'pending') throw new TraikuError(TraikuError.Types.CONFLICT, 'Le paiement est déjà fait.', 'payment_done');
    for (const old of await this.listPayments({ resource_id: input.resource_id, status: 'pending' })) await this.cancelPayment(old.id).catch(() => undefined);

    const row = await this.createPayments({
      resource_id: input.resource_id,
      payer_id: input.payer_id ?? null,
      provider_id: provider.id,
      mode: provider.mode,
      amount: round(input.amount, input.currency_code),
      currency_code: input.currency_code.toUpperCase(),
    });
    try {
      const res = await provider.initiate({ payment_id: row.id, amount: Number(row.amount), currency_code: row.currency_code, description: input.description, ...input.urls(row.id) });
      const payment = await this.updatePayments({ id: row.id, data: res.data, status: res.status, ...(res.status === 'authorized' && { authorized_at: new Date() }) });
      return { payment, redirect_url: res.redirect_url ?? null };
    } catch (e) {
      await this.updatePayments({ id: row.id, status: 'error', error: (e as Error).message });
      this.logger.error(`paiement ${row.id} (${provider.id}) : ${(e as Error).message}`);
      throw new TraikuError(TraikuError.Types.UNEXPECTED_STATE, 'Le paiement n’a pas pu démarrer. Réessayez ou choisissez un autre moyen.', 'payment_failed');
    }
  }

  /** Asks the provider where a pending payment stands (back from its page, or on its webhook). */
  async syncPayment(id: string) {
    const row = await this.retrievePayment(id);
    if (row.status !== 'pending') return row;
    const { data, status } = await this.provider(row.provider_id).getStatus(row.data, { amount: Number(row.amount), currency_code: row.currency_code });
    if (status === 'pending') return this.updatePayments({ id, data });
    return this.updatePayments({ id, data, status, ...(status === 'authorized' && { authorized_at: new Date() }), ...(status === 'canceled' && { canceled_at: new Date() }) });
  }

  /** Takes `amount` of what is reserved (never more); the rest is released. Nothing to take: cancelled. */
  async capturePayment(id: string, amount: number) {
    const row = await this.retrievePayment(id);
    if (row.status !== 'authorized') throw new TraikuError(TraikuError.Types.NOT_ALLOWED, `Paiement ${row.status} : rien à encaisser.`, 'payment_not_authorized');
    const take = round(Math.min(Math.max(amount, 0), Number(row.amount)), row.currency_code);
    if (take <= 0) return this.cancelPayment(id);
    const data = await this.provider(row.provider_id).capture(row.data, take, row.currency_code);
    return this.updatePayments({ id, data, status: 'captured', captured_amount: take, captured_at: new Date() });
  }

  /** Releases the reservation (or drops a payment never finished). */
  async cancelPayment(id: string) {
    const row = await this.retrievePayment(id);
    if (row.status === 'canceled') return row;
    if (row.status === 'captured') throw new TraikuError(TraikuError.Types.NOT_ALLOWED, 'Déjà encaissé : remboursez plutôt.', 'payment_captured');
    const data = row.status === 'error' ? row.data : await this.provider(row.provider_id).cancel(row.data);
    return this.updatePayments({ id, data, status: 'canceled', canceled_at: new Date() });
  }

  /** Gives back part or all of what was captured. */
  async refundPayment(id: string, amount: number) {
    const row = await this.retrievePayment(id);
    const left = Number(row.captured_amount) - Number(row.refunded_amount);
    if (row.status !== 'captured' || left <= 0) throw new TraikuError(TraikuError.Types.NOT_ALLOWED, 'Rien à rembourser.', 'payment_not_captured');
    const give = round(Math.min(amount, left), row.currency_code);
    if (give <= 0) return row;
    const data = await this.provider(row.provider_id).refund(row.data, give, row.currency_code);
    return this.updatePayments({ id, data, refunded_amount: round(Number(row.refunded_amount) + give, row.currency_code) });
  }

  /** A provider's webhook, checked by it: the payment it is about, looked at again. */
  async handleWebhook(provider_id: string, raw: Buffer, headers: Record<string, string | string[] | undefined>) {
    const provider = this.provider(provider_id);
    if (!provider.webhook) throw new TraikuError(TraikuError.Types.NOT_FOUND, 'Pas de webhook pour ce moyen de paiement.');
    const { payment_id } = await provider.webhook(raw, headers).catch((e: Error) => {
      throw new TraikuError(TraikuError.Types.UNAUTHORIZED, e.message);
    });
    if (!payment_id) return null;
    const [row] = await this.listPayments({ id: payment_id }, { take: 1 });
    return row ? this.syncPayment(row.id) : null;
  }
}
