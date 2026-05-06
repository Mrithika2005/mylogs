/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { v4 as uuidv4 } from 'uuid';
import { LogRecord, LogLevel, LogLayer } from './types';

/**
 * LogEnricher Interface
 * 📐 Value Object pattern — immutable enrichment.
 */
export interface LogEnricher {
    enrich(record: LogRecord): LogRecord;
}

/**
 * LogSampler Interface
 * 🏛️ Domain Service — volume control.
 */
export interface LogSampler {
    shouldSample(record: LogRecord): boolean;
}

/**
 * LogHandler Interface
 * 🔌 Repository Pattern — sink contract.
 */
export interface LogHandler {
    handle(record: LogRecord): Promise<void>;
}

/**
 * Logger Abstract Class
 * 🏛️ Domain Service — orchestrates the pipeline.
 */
export abstract class Logger<T extends LogRecord = LogRecord> {
    protected enrichers: LogEnricher[] = [];
    protected handlers: LogHandler[] = [];
    protected sampler?: LogSampler;
    protected defaultContext: Record<string, any> = {};

    constructor(
        protected readonly layer: LogLayer,
        protected readonly serviceName?: string,
        protected readonly env?: string
    ) {}

    /**
     * Core logging methods matching Ubiquitous Language.
     */
    public debug(msg: string, ctx: Record<string, any> = {}) { this.log(msg, LogLevel.DEBUG, ctx); }
    public info(msg: string, ctx: Record<string, any> = {}) { this.log(msg, LogLevel.INFO, ctx); }
    public warn(msg: string, ctx: Record<string, any> = {}) { this.log(msg, LogLevel.WARN, ctx); }
    public error(msg: string, ctx: Record<string, any> = {}) { this.log(msg, LogLevel.ERROR, ctx); }
    public fatal(msg: string, ctx: Record<string, any> = {}) { this.log(msg, LogLevel.FATAL, ctx); }

    protected log(message: string, level: LogLevel, context: Record<string, any> = {}) {
        let record = this.createRecord(message, level, { ...this.defaultContext, ...context });
        
        // Enrichment
        for (const enricher of this.enrichers) {
            record = enricher.enrich(record) as T;
        }

        // Sampling
        if (this.sampler && !this.sampler.shouldSample(record)) {
            return;
        }

        // Handle
        if (this.shouldHandle(record)) {
            this.handlers.forEach(h => h.handle(record));
        }
    }

    /**
     * MUST OVERRIDE. Each subclass returns its own typed record.
     */
    protected abstract createRecord(message: string, level: LogLevel, context: Record<string, any>): T;

    /**
     * Optional override for handled rules.
     */
    protected shouldHandle(record: T): boolean {
        return true;
    }

    /**
     * Child logger for scoped context.
     */
    public abstract child(ctx: Record<string, any>): Logger<T>;

    public addEnricher(e: LogEnricher) { this.enrichers.push(e); }
    public addHandler(h: LogHandler) { this.handlers.push(h); }
    public setSampler(s: LogSampler) { this.sampler = s; }
}

/**
 * Base Record Creation Helper
 */
export function createBaseRecord(
    message: string, 
    level: LogLevel, 
    layer: LogLayer, 
    context: Record<string, any>,
    service?: string,
    env?: string
): LogRecord {
    return {
        record_id: uuidv4(),
        timestamp: new Date().toISOString(),
        message,
        level,
        layer,
        service,
        env,
        context,
    };
}
