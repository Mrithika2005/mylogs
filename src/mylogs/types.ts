/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Level enum
 * 📖 Ubiquitous Language — shared severity vocabulary.
 */
export enum LogLevel {
    DEBUG = 10,
    INFO = 20,
    WARN = 30,
    ERROR = 40,
    FATAL = 50
}

/**
 * Layer enum
 * 🗺️ Bounded Context Map — architectural layer markers.
 */
export enum LogLayer {
    PRESENTATION = 'PRESENTATION',
    GATEWAY = 'GATEWAY',
    APPLICATION = 'APPLICATION',
    DOMAIN = 'DOMAIN',
    PERSISTENCE = 'PERSISTENCE',
    INFRA = 'INFRA',
    SECURITY = 'SECURITY',
    OBSERVABILITY = 'OBSERVABILITY',
    PAYMENT = 'PAYMENT'
}

/**
 * LogRecord Interface
 * 📐 Value Object — immutable domain facts.
 */
export interface LogRecord {
    readonly message: string;
    readonly level: LogLevel;
    readonly layer: LogLayer;
    readonly timestamp: string; // ISO String
    readonly record_id: string; // UUID v4
    readonly trace_id?: string;
    readonly span_id?: string;
    readonly service?: string;
    readonly env?: string;
    readonly context: Record<string, any>;
}

/**
 * HttpRecord
 * 🗺️ Bounded Context: GATEWAY
 */
export interface HttpRecord extends LogRecord {
    readonly method: string;
    readonly status_code: number;
    readonly url: string;
    readonly latency_ms?: number;
    readonly rate_limited: boolean;
    readonly bot_score?: number;
}

/**
 * UIRecord
 * 🗺️ Bounded Context: PRESENTATION
 */
export interface UIRecord extends LogRecord {
    readonly event_type: 'click' | 'navigation' | 'scroll' | 'form' | 'error' | 'vital' | 'asset';
    readonly vitals?: Record<string, number>;
    readonly variant?: string;
}

/**
 * BizRecord
 * 🗺️ Bounded Context: DOMAIN (The Core Domain)
 */
export interface BizRecord extends LogRecord {
    readonly event_name: string;
    readonly entity_type: string;
    readonly entity_id: string;
    readonly prev_state?: string;
    readonly next_state?: string;
    readonly saga_id?: string;
    readonly rule_id?: string;
    readonly score?: number;
}

/**
 * DbRecord
 * 🗺️ Bounded Context: PERSISTENCE
 */
export interface DbRecord extends LogRecord {
    readonly query_hash: string;
    readonly slow_flag: boolean;
    readonly duration_ms: number;
    readonly tx_id?: string;
}

/**
 * SecRecord
 * 🗺️ Bounded Context: SECURITY
 */
export interface SecRecord extends LogRecord {
    readonly actor_id?: string;
    readonly action: 'AUTH_FAIL' | 'PRIV_ESCALATE' | 'WAF_BLOCK' | 'TOKEN_REVOKE' | 'GDPR_ACCESS' | string;
    readonly cve?: string;
}

/**
 * PaymentRecord
 * 🗺️ Bounded Context: PAYMENT
 *
 * ⚠️  PII CONTRACT — this record must NEVER contain raw card numbers (PAN),
 * CVV, full account numbers, or raw bank details. Use tokenised references
 * only (e.g. Stripe charge IDs, last-4 digits). The PiiScrubEnricher
 * enforces this at runtime, but callers must also honour the contract.
 */
export interface PaymentRecord extends LogRecord {
    /** e.g. 'CHARGE_INITIATED' | 'CHARGE_SUCCESS' | 'CHARGE_FAILED' | 'REFUND_ISSUED' | 'DISPUTE_OPENED' */
    readonly payment_event: string;
    /** Gateway token / charge ID — never a raw PAN */
    readonly payment_id: string;
    /** ISO 4217 currency code */
    readonly currency: string;
    /** Amount in minor units (e.g. paise / cents) to avoid float precision bugs */
    readonly amount_minor: number;
    /** Payment gateway used (stripe | razorpay | paypal | etc.) */
    readonly gateway: string;
    /** Last 4 digits of the card — safe to log */
    readonly card_last4?: string;
    /** Gateway-returned decline/error code if applicable */
    readonly gateway_code?: string;
    /** Whether this event relates to a disputed charge */
    readonly is_dispute?: boolean;
    /** Order / saga this payment belongs to */
    readonly order_id?: string;
}
