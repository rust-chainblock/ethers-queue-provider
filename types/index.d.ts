/// <reference types="node" />
import { providers } from 'ethers';
import PQueue from 'browser-queue';
import type { fetchConfig } from 'axios-auto';
export declare type providerConfig = fetchConfig & {
    batchSize?: number;
};
export declare type extraConfig = Omit<providerConfig, 'url'>;
export interface queueConfig {
    concurrency?: number;
    autoStart?: boolean;
    intervalCap?: number;
    interval?: number;
    carryoverConcurrencyCount?: boolean;
    timeout?: number;
    throwOnTimeout?: boolean;
}
export default class AxiosBatchProvider extends providers.JsonRpcProvider {
    private axiosConfig;
    private queueConfig;
    private batchSize;
    _requestId: number;
    _pendingBatchAggregator: NodeJS.Timer | null;
    _pendingBatch: Array<{
        request: {
            method: string;
            params: Array<any>;
            id: number;
            jsonrpc: '2.0';
        };
        resolve: (result: any) => void;
        reject: (error: Error) => void;
    }> | null;
    _queue: PQueue;
    constructor(urlOrConfig: string | providerConfig, extraConfig?: extraConfig, queueConfig?: queueConfig, network?: providers.Networkish);
    send(method: string, params: Array<any>): Promise<any>;
}
