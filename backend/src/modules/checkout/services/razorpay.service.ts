import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationResolverService } from '../../integrations/services/integration-resolver.service';
import * as crypto from 'crypto';
import * as https from 'https';

export interface RazorpayOrderPayload {
  amountMinor: number;
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResponse {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt?: string;
  status: string;
  attempts: number;
  notes?: Record<string, any>;
  created_at: number;
}

export interface RazorpayPaymentResponse {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: string; // 'created' | 'authorized' | 'captured' | 'refunded' | 'failed'
  order_id: string;
  invoice_id?: string | null;
  international: boolean;
  method: string;
  amount_refunded: number;
  refund_status?: string | null;
  captured: boolean;
  description?: string;
  card_id?: string | null;
  bank?: string | null;
  wallet?: string | null;
  vpa?: string | null;
  email?: string;
  contact?: string;
  notes?: Record<string, any>;
  fee?: number;
  tax?: number;
  error_code?: string | null;
  error_description?: string | null;
  created_at: number;
}

export interface RazorpayRefundPayload {
  amountMinor?: number;
  reverseAll?: boolean;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface RazorpayRefundResponse {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  payment_id: string;
  notes?: Record<string, any>;
  receipt?: string;
  status: 'processed' | 'pending' | 'failed' | string;
  speed_processed?: string;
  speed_requested?: string;
  created_at: number;
  error_code?: string | null;
  error_description?: string | null;
}

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly integrationResolver: IntegrationResolverService,
  ) {}

  /**
   * Dynamically resolves Razorpay credentials via IntegrationResolverService.
   * Order: Active DB Credential -> .env Fallback.
   * If active DB credential exists but fails decryption -> Fails Fast.
   */
  private async getResolvedCredentials(): Promise<{
    keyId: string;
    keySecret: string;
    webhookSecret: string;
    isTestMode: boolean;
  }> {
    const resolved = await this.integrationResolver.resolveRazorpay(null);

    const nodeEnv =
      this.configService.get<string>('NODE_ENV') || process.env.NODE_ENV || 'development';

    const keyId = resolved.keyId || '';
    const keySecret = resolved.keySecret || '';
    const webhookSecret = resolved.webhookSecret || '';

    if (nodeEnv === 'production') {
      if (
        !keyId ||
        keyId.startsWith('rzp_test_mock') ||
        !keySecret ||
        keySecret === 'mock_secret_key_hrnexa' ||
        !webhookSecret ||
        webhookSecret === 'mock_webhook_secret_hrnexa'
      ) {
        throw new Error(
          'FATAL: Production environment requires live, non-mock Razorpay credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET).',
        );
      }
    }

    const isTestMode =
      !keyId ||
      keyId.startsWith('rzp_test_mock') ||
      nodeEnv === 'test';

    return {
      keyId: keyId || 'rzp_test_mock_key_id',
      keySecret: keySecret || 'mock_secret_key_hrnexa',
      webhookSecret: webhookSecret || 'mock_webhook_secret_hrnexa',
      isTestMode,
    };
  }

  public async getKeyId(): Promise<string> {
    const creds = await this.getResolvedCredentials();
    return creds.keyId;
  }

  /**
   * Internal HTTPS Request Dispatcher to Razorpay REST API
   */
  private async makeRequest<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: any,
  ): Promise<T> {
    const creds = await this.getResolvedCredentials();

    if (creds.isTestMode) {
      // Offline mock generator for test environments
      if (path.startsWith('/v1/orders') && method === 'POST') {
        const mockOrderId = `order_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
        return {
          id: mockOrderId,
          entity: 'order',
          amount: body?.amount || 500000,
          amount_paid: 0,
          amount_due: body?.amount || 500000,
          currency: body?.currency || 'INR',
          receipt: body?.receipt,
          status: 'created',
          attempts: 0,
          notes: body?.notes || {},
          created_at: Math.floor(Date.now() / 1000),
        } as unknown as T;
      }

      if (path.startsWith('/v1/payments/') && method === 'GET') {
        const paymentId = path.split('/v1/payments/')[1];
        return {
          id: paymentId,
          entity: 'payment',
          amount: 500000,
          currency: 'INR',
          status: 'captured',
          order_id: 'order_mock',
          captured: true,
          method: 'upi',
          created_at: Math.floor(Date.now() / 1000),
        } as unknown as T;
      }

      if (path.includes('/refund') && method === 'POST') {
        const paymentId = path.split('/v1/payments/')[1].split('/refund')[0];
        const mockRefundId = `rfnd_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
        return {
          id: mockRefundId,
          entity: 'refund',
          amount: body?.amount || 10000,
          currency: 'INR',
          payment_id: paymentId,
          status: 'processed',
          receipt: body?.receipt,
          notes: body?.notes || {},
          created_at: Math.floor(Date.now() / 1000),
        } as unknown as T;
      }

      if (path.startsWith('/v1/refunds/') && method === 'GET') {
        const refundId = path.split('/v1/refunds/')[1];
        return {
          id: refundId,
          entity: 'refund',
          amount: 10000,
          currency: 'INR',
          payment_id: 'pay_mock',
          status: 'processed',
          created_at: Math.floor(Date.now() / 1000),
        } as unknown as T;
      }
    }

    return new Promise((resolve, reject) => {
      const authHeader = `Basic ${Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString('base64')}`;
      const payload = body ? JSON.stringify(body) : '';

      const reqOptions: https.RequestOptions = {
        hostname: 'api.razorpay.com',
        port: 443,
        path,
        method,
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      };

      const req = https.request(reqOptions, (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(rawData);
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed as T);
            } else {
              const errorMessage =
                parsed?.error?.description ||
                parsed?.message ||
                `Razorpay API returned HTTP ${res.statusCode}`;
              reject(new BadRequestException(errorMessage));
            }
          } catch (err: any) {
            reject(new BadRequestException(`Failed to parse Razorpay response: ${err.message}`));
          }
        });
      });

      req.on('error', (err) => {
        this.logger.error(`Razorpay network error on ${path}: ${err.message}`);
        reject(new BadRequestException(`Razorpay network error: ${err.message}`));
      });

      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  }

  /**
   * Creates an order with Razorpay in minor currency units (paise)
   */
  async createOrder(payload: RazorpayOrderPayload): Promise<RazorpayOrderResponse> {
    if (!payload.amountMinor || payload.amountMinor <= 0) {
      throw new BadRequestException('Amount in minor units must be greater than 0');
    }

    return this.makeRequest<RazorpayOrderResponse>('POST', '/v1/orders', {
      amount: payload.amountMinor,
      currency: payload.currency || 'INR',
      receipt: payload.receipt,
      notes: payload.notes || {},
    });
  }

  /**
   * Fetches payment details from Razorpay to verify captured status and amount
   */
  async fetchPayment(paymentId: string): Promise<RazorpayPaymentResponse> {
    if (!paymentId || !paymentId.trim()) {
      throw new BadRequestException('Payment ID is required');
    }
    return this.makeRequest<RazorpayPaymentResponse>(
      'GET',
      `/v1/payments/${encodeURIComponent(paymentId.trim())}`,
    );
  }

  /**
   * Fetches order details from Razorpay
   */
  async fetchOrder(orderId: string): Promise<RazorpayOrderResponse> {
    if (!orderId || !orderId.trim()) {
      throw new BadRequestException('Order ID is required');
    }
    return this.makeRequest<RazorpayOrderResponse>(
      'GET',
      `/v1/orders/${encodeURIComponent(orderId.trim())}`,
    );
  }

  /**
   * Cryptographically validates the client checkout payment signature using timing-safe comparison
   */
  async verifyPaymentSignature(params: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): Promise<boolean> {
    const { orderId, paymentId, signature } = params;
    if (!orderId || !paymentId || !signature) {
      return false;
    }

    try {
      const creds = await this.getResolvedCredentials();
      const payload = `${orderId.trim()}|${paymentId.trim()}`;
      const expectedSignature = crypto
        .createHmac('sha256', creds.keySecret)
        .update(payload)
        .digest('hex');

      const sigBuffer = Buffer.from(signature.trim(), 'hex');
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');

      if (sigBuffer.length !== expectedBuffer.length) {
        return false;
      }
      return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Cryptographically validates webhook signatures using X-Razorpay-Signature and raw request body
   */
  async verifyWebhookSignature(rawBody: Buffer | string, signature: string): Promise<boolean> {
    if (!rawBody || !signature) {
      return false;
    }

    try {
      const creds = await this.getResolvedCredentials();
      const bodyBuffer = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
      const expectedSignature = crypto
        .createHmac('sha256', creds.webhookSecret)
        .update(bodyBuffer)
        .digest('hex');

      const sigBuffer = Buffer.from(signature.trim(), 'hex');
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');

      if (sigBuffer.length !== expectedBuffer.length) {
        return false;
      }
      return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Server-side refund operation via Razorpay REST API
   * POST /v1/payments/:paymentId/refund
   */
  async refundPayment(
    paymentId: string,
    payload: RazorpayRefundPayload = {},
  ): Promise<RazorpayRefundResponse> {
    if (!paymentId || !paymentId.trim()) {
      throw new BadRequestException('Payment ID is required for refund');
    }

    const body: any = {};
    if (payload.amountMinor && payload.amountMinor > 0) {
      body.amount = payload.amountMinor;
    }
    if (payload.reverseAll) {
      body.reverse_all = 1;
    }
    if (payload.receipt) {
      body.receipt = payload.receipt;
    }
    if (payload.notes) {
      body.notes = payload.notes;
    }

    return this.makeRequest<RazorpayRefundResponse>(
      'POST',
      `/v1/payments/${encodeURIComponent(paymentId.trim())}/refund`,
      body,
    );
  }

  /**
   * Fetches refund details from Razorpay
   * GET /v1/refunds/:refundId
   */
  async fetchRefund(refundId: string): Promise<RazorpayRefundResponse> {
    if (!refundId || !refundId.trim()) {
      throw new BadRequestException('Refund ID is required');
    }
    return this.makeRequest<RazorpayRefundResponse>(
      'GET',
      `/v1/refunds/${encodeURIComponent(refundId.trim())}`,
    );
  }
}
