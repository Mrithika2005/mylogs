/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger, createBaseRecord, LogHandler } from './logger';
import { LogRecord, LogLevel, LogLayer, BizRecord, UIRecord, SecRecord, HttpRecord, PaymentRecord } from './types';

/**
 * DomainLogger
 * 🗺️ Bounded Context: DOMAIN
 * Locked to BizRecord.
 */
export class DomainLogger extends Logger<BizRecord> {
    constructor(serviceName?: string, env?: string) {
        super(LogLayer.DOMAIN, serviceName, env);
    }

    protected createRecord(message: string, level: LogLevel, context: Record<string, any>): BizRecord {
        const base = createBaseRecord(message, level, this.layer, context, this.serviceName, this.env);
        return {
            ...base,
            event_name: context.event_name || 'unknown_event',
            entity_type: context.entity_type || 'unknown_entity',
            entity_id: context.entity_id || 'unknown_id',
            prev_state: context.prev_state,
            next_state: context.next_state,
            saga_id: context.saga_id,
            rule_id: context.rule_id,
            score: context.score
        } as BizRecord;
    }

    public child(ctx: Record<string, any>): DomainLogger {
        const logger = new DomainLogger(this.serviceName, this.env);
        logger.defaultContext = { ...this.defaultContext, ...ctx };
        logger.enrichers = [...this.enrichers];
        logger.handlers = [...this.handlers];
        logger.sampler = this.sampler;
        return logger;
    }
}

/**
 * BrowserLogger
 * 🗺️ Bounded Context: PRESENTATION
 */
export class BrowserLogger extends Logger<UIRecord> {
    constructor(serviceName?: string, env?: string) {
        super(LogLayer.PRESENTATION, serviceName, env);
    }

    protected createRecord(message: string, level: LogLevel, context: Record<string, any>): UIRecord {
        const base = createBaseRecord(message, level, this.layer, context, this.serviceName, this.env);
        return {
            ...base,
            event_type: context.event_type || 'click',
            vitals: context.vitals,
            variant: context.variant
        } as UIRecord;
    }

    public child(ctx: Record<string, any>): BrowserLogger {
        const logger = new BrowserLogger(this.serviceName, this.env);
        logger.defaultContext = { ...this.defaultContext, ...ctx };
        logger.enrichers = [...this.enrichers];
        logger.handlers = [...this.handlers];
        logger.sampler = this.sampler;
        return logger;
    }
}

/**
 * SecurityLogger
 * 🗺️ Bounded Context: SECURITY
 * Locked to SecRecord. Automatically wired to FATAL-only alerting sink
 * when constructed via LoggerRegistry.
 */
export class SecurityLogger extends Logger<SecRecord> {
    constructor(serviceName?: string, env?: string) {
        super(LogLayer.SECURITY, serviceName, env);
    }

    protected createRecord(message: string, level: LogLevel, context: Record<string, any>): SecRecord {
        const base = createBaseRecord(message, level, this.layer, context, this.serviceName, this.env);
        return {
            ...base,
            actor_id: context.actor_id,
            action: context.action || 'UNKNOWN_ACTION',
            cve: context.cve,
        } as SecRecord;
    }

    public child(ctx: Record<string, any>): SecurityLogger {
        const logger = new SecurityLogger(this.serviceName, this.env);
        logger.defaultContext = { ...this.defaultContext, ...ctx };
        logger.enrichers = [...this.enrichers];
        logger.handlers = [...this.handlers];
        logger.sampler = this.sampler;
        return logger;
    }
}

/**
 * HttpLogger
 * 🗺️ Bounded Context: GATEWAY
 * Locked to HttpRecord — was previously only a type with no concrete logger.
 */
export class HttpLogger extends Logger<HttpRecord> {
    constructor(serviceName?: string, env?: string) {
        super(LogLayer.GATEWAY, serviceName, env);
    }

    protected createRecord(message: string, level: LogLevel, context: Record<string, any>): HttpRecord {
        const base = createBaseRecord(message, level, this.layer, context, this.serviceName, this.env);
        return {
            ...base,
            method: context.method || 'UNKNOWN',
            status_code: context.status_code ?? 0,
            url: context.url || '',
            latency_ms: context.latency_ms,
            rate_limited: context.rate_limited ?? false,
            bot_score: context.bot_score,
        } as HttpRecord;
    }

    public child(ctx: Record<string, any>): HttpLogger {
        const logger = new HttpLogger(this.serviceName, this.env);
        logger.defaultContext = { ...this.defaultContext, ...ctx };
        logger.enrichers = [...this.enrichers];
        logger.handlers = [...this.handlers];
        logger.sampler = this.sampler;
        return logger;
    }
}

/**
 * PaymentLogger
 * 🗺️ Bounded Context: PAYMENT
 *
 * Enforces PiiScrubEnricher as the FIRST enricher in its chain so that
 * sensitive fields are stripped before any handler ever sees the record.
 */
export class PaymentLogger extends Logger<PaymentRecord> {
    constructor(serviceName?: string, env?: string) {
        super(LogLayer.PAYMENT, serviceName, env);
    }

    protected createRecord(message: string, level: LogLevel, context: Record<string, any>): PaymentRecord {
        const base = createBaseRecord(message, level, this.layer, context, this.serviceName, this.env);
        return {
            ...base,
            payment_event: context.payment_event || 'UNKNOWN_EVENT',
            payment_id: context.payment_id || 'unknown_id',
            currency: context.currency || 'INR',
            amount_minor: context.amount_minor ?? 0,
            gateway: context.gateway || 'unknown_gateway',
            card_last4: context.card_last4,
            gateway_code: context.gateway_code,
            is_dispute: context.is_dispute ?? false,
            order_id: context.order_id,
        } as PaymentRecord;
    }

    public child(ctx: Record<string, any>): PaymentLogger {
        const logger = new PaymentLogger(this.serviceName, this.env);
        logger.defaultContext = { ...this.defaultContext, ...ctx };
        logger.enrichers = [...this.enrichers];
        logger.handlers = [...this.handlers];
        logger.sampler = this.sampler;
        return logger;
    }
}

/**
 * HttpLogHandler
 * 🔌 Repository Pattern — Sends a single log record to the backend API.
 * Use BatchLogHandler for high-traffic scenarios.
 */
export class HttpLogHandler implements LogHandler {
    constructor(private endpoint: string = '/api/logs') {}

    async handle(record: LogRecord): Promise<void> {
        try {
            await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(record),
                referrerPolicy: 'no-referrer'
            });
        } catch (error) {
            console.error('Failed to send log to backend:', error);
        }
    }
}

/**
 * BatchLogHandler
 * 🔌 True batch POST — collects records and sends them as a JSON array
 * to /api/logs/batch. Flushes on maxBatchSize or flushIntervalMs,
 * whichever comes first. This replaces the old FlushService loop approach.
 */
export class BatchLogHandler implements LogHandler {
    private buffer: LogRecord[] = [];
    private timer: ReturnType<typeof setInterval> | null = null;

    constructor(
        private endpoint: string = '/api/logs/batch',
        private maxBatchSize: number = 20,
        private flushIntervalMs: number = 5000
    ) {
        this.timer = setInterval(() => this.flush(), this.flushIntervalMs);
    }

    async handle(record: LogRecord): Promise<void> {
        this.buffer.push(record);
        if (this.buffer.length >= this.maxBatchSize) {
            await this.flush();
        }
    }

    async flush(): Promise<void> {
        if (this.buffer.length === 0) return;
        const batch = [...this.buffer];
        this.buffer = [];
        try {
            await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(batch),
                referrerPolicy: 'no-referrer'
            });
        } catch (error) {
            console.error('BatchLogHandler: failed to flush batch', error);
            // Re-queue on failure (best-effort)
            this.buffer = [...batch, ...this.buffer];
        }
    }

    destroy(): void {
        if (this.timer) clearInterval(this.timer);
    }
}

/**
 * MinLevelHandler
 * 🔌 Decorator — wraps any LogHandler and gates records by minimum severity.
 *
 * Usage:
 *   logger.addHandler(new MinLevelHandler(new HttpLogHandler('/api/alerts'), LogLevel.ERROR));
 *
 * This ensures DEBUG/INFO/WARN records never reach an alerting sink, while
 * ERROR and FATAL still flow through.
 */
export class MinLevelHandler implements LogHandler {
    constructor(
        private inner: LogHandler,
        private minLevel: LogLevel
    ) {}

    async handle(record: LogRecord): Promise<void> {
        if (record.level >= this.minLevel) {
            await this.inner.handle(record);
        }
    }
}
