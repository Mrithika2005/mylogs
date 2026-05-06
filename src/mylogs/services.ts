/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LogRecord } from './types';
import { LogEnricher, LogHandler } from './logger';
import { DomainLogger, BrowserLogger, SecurityLogger, HttpLogger, PaymentLogger, HttpLogHandler, BatchLogHandler, MinLevelHandler } from './concrete_loggers';
import { LogLevel } from './types';

/**
 * EnrichService
 * 🏛️ Domain Service — manages the ordered chain of enrichers.
 */
export class EnrichService {
    private enrichers: LogEnricher[] = [];

    public register(enricher: LogEnricher) {
        this.enrichers.push(enricher);
    }

    public runChain(record: LogRecord): LogRecord {
        let current = record;
        for (const e of this.enrichers) {
            current = e.enrich(current);
        }
        return current;
    }
}

/**
 * TraceEnricher
 * 🔗 Context Mapping — correlates logs across services.
 */
export class TraceEnricher implements LogEnricher {
    constructor(private traceId: string) {}
    enrich(record: LogRecord): LogRecord {
        return { ...record, trace_id: this.traceId };
    }
}

/**
 * PiiScrubEnricher
 * 🛡️ Privacy Guard — strips known PII fields from context before any
 * handler receives the record.
 *
 * Fields scrubbed by default:
 *   email, phone, mobile, address, full_name, name, ssn, pan, cvv,
 *   card_number, account_number, password, token, secret, ip_address
 *
 * You can extend the scrub list by passing extra keys to the constructor.
 *
 * ⚠️ Register this as the FIRST enricher so that all subsequent enrichers
 *    and all handlers only ever see scrubbed data.
 */
const DEFAULT_PII_KEYS = new Set([
    'email', 'phone', 'mobile', 'address', 'full_name', 'name',
    'ssn', 'pan', 'cvv', 'card_number', 'account_number',
    'password', 'token', 'secret', 'ip_address', 'dob',
    'date_of_birth', 'national_id', 'passport',
]);

export class PiiScrubEnricher implements LogEnricher {
    private scrubKeys: Set<string>;

    constructor(extraKeys: string[] = []) {
        this.scrubKeys = new Set([...DEFAULT_PII_KEYS, ...extraKeys]);
    }

    enrich(record: LogRecord): LogRecord {
        const cleanContext = this.scrubObject(record.context);
        return { ...record, context: cleanContext };
    }

    private scrubObject(obj: Record<string, any>): Record<string, any> {
        const result: Record<string, any> = {};
        for (const [key, value] of Object.entries(obj)) {
            if (this.scrubKeys.has(key.toLowerCase())) {
                result[key] = '[REDACTED]';
            } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                result[key] = this.scrubObject(value);
            } else {
                result[key] = value;
            }
        }
        return result;
    }
}

/**
 * LoggerRegistry
 * 🏛️ Domain Service — Factory + singleton cache for all application loggers.
 *
 * Each get* method wires up the correct handler(s) automatically:
 *  - getDomainLogger    → BatchLogHandler (high-volume domain events)
 *  - getBrowserLogger   → BatchLogHandler (UI telemetry)
 *  - getSecurityLogger  → HttpLogHandler (immediate delivery) + MinLevelHandler(WARN) guard
 *  - getHttpLogger      → BatchLogHandler (gateway access logs)
 *  - getPaymentLogger   → HttpLogHandler (immediate, PCI-sensitive) + PiiScrubEnricher first
 */
export class LoggerRegistry {
    private static loggers: Map<string, any> = new Map();
    private static collectorUrl: string = '/api/logs';
    private static batchCollectorUrl: string = '/api/logs/batch';

    /**
     * Set the global endpoint for single-record log ingestion.
     * Use this if the dashboard is hosted on a different domain.
     */
    static setCollectorUrl(url: string) {
        this.collectorUrl = url;
    }

    /**
     * Set the global endpoint for batch log ingestion.
     */
    static setBatchCollectorUrl(url: string) {
        this.batchCollectorUrl = url;
    }

    static getDomainLogger(serviceName: string, env: string = 'prod'): DomainLogger {
        const key = `domain:${serviceName}:${env}`;
        if (!this.loggers.has(key)) {
            const logger = new DomainLogger(serviceName, env);
            logger.addEnricher(new PiiScrubEnricher());
            logger.addHandler(new BatchLogHandler(this.batchCollectorUrl));
            this.loggers.set(key, logger);
        }
        return this.loggers.get(key);
    }

    static getBrowserLogger(serviceName: string, env: string = 'prod'): BrowserLogger {
        const key = `browser:${serviceName}:${env}`;
        if (!this.loggers.has(key)) {
            const logger = new BrowserLogger(serviceName, env);
            logger.addEnricher(new PiiScrubEnricher());
            logger.addHandler(new BatchLogHandler(this.batchCollectorUrl));
            this.loggers.set(key, logger);
        }
        return this.loggers.get(key);
    }

    /**
     * SecurityLogger — wired with immediate delivery (no batching) and a
     * MinLevelHandler guard so only WARN and above are forwarded.
     */
    static getSecurityLogger(serviceName: string, env: string = 'prod'): SecurityLogger {
        const key = `security:${serviceName}:${env}`;
        if (!this.loggers.has(key)) {
            const logger = new SecurityLogger(serviceName, env);
            logger.addEnricher(new PiiScrubEnricher());
            // Security events are sensitive — send immediately, no batching
            logger.addHandler(new MinLevelHandler(new HttpLogHandler(this.collectorUrl), LogLevel.WARN));
            this.loggers.set(key, logger);
        }
        return this.loggers.get(key);
    }

    /**
     * HttpLogger — for gateway/API access log telemetry.
     */
    static getHttpLogger(serviceName: string, env: string = 'prod'): HttpLogger {
        const key = `http:${serviceName}:${env}`;
        if (!this.loggers.has(key)) {
            const logger = new HttpLogger(serviceName, env);
            logger.addEnricher(new PiiScrubEnricher(['user_agent', 'referer']));
            logger.addHandler(new BatchLogHandler(this.batchCollectorUrl));
            this.loggers.set(key, logger);
        }
        return this.loggers.get(key);
    }

    /**
     * PaymentLogger — PiiScrubEnricher is always the first enricher.
     * Uses immediate delivery (no batching) for PCI audit trail integrity.
     */
    static getPaymentLogger(serviceName: string, env: string = 'prod'): PaymentLogger {
        const key = `payment:${serviceName}:${env}`;
        if (!this.loggers.has(key)) {
            const logger = new PaymentLogger(serviceName, env);
            // PII scrub MUST be first — before any other enricher sees the record
            logger.addEnricher(new PiiScrubEnricher(['billing_address', 'cardholder_name']));
            // Payment events must be delivered immediately for PCI audit trail
            logger.addHandler(new HttpLogHandler(this.collectorUrl));
            this.loggers.set(key, logger);
        }
        return this.loggers.get(key);
    }
}

/**
 * FlushService
 * 🏛️ Domain Service — legacy single-record buffering wrapper.
 * Prefer BatchLogHandler for new integrations.
 */
export class FlushService {
    private buffer: LogRecord[] = [];
    private maxBatchSize: number = 20;
    private flushInterval: number = 5000;

    constructor(private handler: LogHandler) {
        setInterval(() => this.flush(), this.flushInterval);
    }

    public schedule(record: LogRecord) {
        this.buffer.push(record);
        if (this.buffer.length >= this.maxBatchSize) {
            this.flush();
        }
    }

    private async flush() {
        if (this.buffer.length === 0) return;
        const batch = [...this.buffer];
        this.buffer = [];
        for (const record of batch) {
            await this.handler.handle(record);
        }
    }
}
