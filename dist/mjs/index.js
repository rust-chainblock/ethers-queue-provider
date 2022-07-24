/*!
 * MIT License
 * 
 * Copyright (c) 2022 AyanamiTech
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * 
 */
import { post } from 'axios-auto';
import { utils, providers } from 'ethers';
import PQueue from 'browser-queue';

const version = "ethers-queue-provider@5.6.9-beta.1";

const logger = new utils.Logger(version);
function sliceToChunks(array, size = 10) {
  const results = [];
  for (let i = 0; i < array.length; i += size) {
    results.push(array.slice(i, i + size));
  }
  return results;
}
class AxiosBatchProvider extends providers.JsonRpcProvider {
  constructor(urlOrConfig, extraConfig, queueConfig, network) {
    var _a;
    if (typeof urlOrConfig === "object" && !urlOrConfig.url) {
      logger.throwArgumentError("missing node url", "urlOrConfig", urlOrConfig);
    }
    let batchSize = 3;
    const axiosConfig = {
      url: typeof urlOrConfig === "string" ? urlOrConfig : urlOrConfig.url
    };
    if (typeof urlOrConfig === "object") {
      if (urlOrConfig.batchSize) {
        batchSize = urlOrConfig.batchSize;
        delete urlOrConfig.batchSize;
      }
      Object.assign(axiosConfig, urlOrConfig);
    }
    if (extraConfig) {
      if (extraConfig.batchSize) {
        batchSize = extraConfig.batchSize;
        delete extraConfig.batchSize;
      }
      Object.assign(axiosConfig, extraConfig);
    }
    axiosConfig.headers || (axiosConfig.headers = {});
    (_a = axiosConfig.headers)["Content-Type"] || (_a["Content-Type"] = "application/json;charset=utf-8");
    axiosConfig.timeout || (axiosConfig.timeout = 6e4);
    const QueueConfig = {};
    if (queueConfig) {
      Object.assign(QueueConfig, queueConfig);
    }
    QueueConfig.concurrency || (QueueConfig.concurrency = 3);
    QueueConfig.interval || (QueueConfig.interval = 2e3);
    QueueConfig.intervalCap || (QueueConfig.intervalCap = 6);
    if (typeof QueueConfig.carryoverConcurrencyCount === "undefined") {
      QueueConfig.carryoverConcurrencyCount = true;
    }
    super(axiosConfig.url.replace(/\s+/g, "").split(",")[0], network);
    this._requestId = 1;
    this.batchSize = batchSize;
    this.axiosConfig = axiosConfig;
    this.queueConfig = QueueConfig;
    this._pendingBatchAggregator = null;
    this._pendingBatch = null;
    this._queue = new PQueue(this.queueConfig);
  }
  send(method, params) {
    var _a;
    if (method === "eth_chainId" && ((_a = this._network) == null ? void 0 : _a.chainId)) {
      return new Promise((resolve) => {
        var _a2;
        return resolve((_a2 = this._network) == null ? void 0 : _a2.chainId);
      });
    }
    const url = Object.assign({}, this.axiosConfig).url;
    const payload = {
      method,
      params,
      id: this._requestId++,
      jsonrpc: "2.0"
    };
    const options = Object.assign({}, this.axiosConfig);
    delete options.url;
    const sendTxMethods = ["eth_sendRawTransaction", "eth_sendTransaction"];
    const sendTransaction = sendTxMethods.includes(method) ? true : false;
    if (sendTransaction && url.replace(/\s+/g, "").split(",").length > 0) {
      throw new Error("AxiosBatchProvider: eth_sendRawTransaction not supported with multiple nodes");
    }
    const filter = (data, count, retryMax) => {
      if (typeof count === "number" && typeof retryMax === "number") {
        if (Array.isArray(data)) {
          const errorArray = data.map((d) => {
            let message;
            if (d.error) {
              message = typeof d.error.message === "string" ? d.error.message : typeof d.error === "string" ? d.error : typeof d.error === "object" ? JSON.stringify(d.error) : "";
            } else if (typeof d.result === "undefined") {
              message = typeof d === "string" ? d : typeof d === "object" ? JSON.stringify(d) : "Result not available from remote node";
            }
            if (typeof message !== "undefined" && count < retryMax + 1) {
              return new Error(message);
            }
          }).filter((d) => d);
          if (errorArray.length > 0) {
            throw errorArray;
          }
        } else {
          let message;
          if (data.error) {
            message = typeof data.error.message === "string" ? data.error.message : typeof data.error === "string" ? data.error : typeof data.error === "object" ? JSON.stringify(data.error) : "";
          } else if (typeof data.result === "undefined") {
            message = typeof data === "string" ? data : typeof data === "object" ? JSON.stringify(data) : "Result not available from remote node";
          }
          if (typeof message !== "undefined" && count < retryMax + 1) {
            throw new Error(message);
          }
        }
      }
    };
    options.filter || (options.filter = filter);
    if (this._pendingBatch == null) {
      this._pendingBatch = [];
    }
    const inflightRequest = { request: payload, resolve: null, reject: null };
    const promise = new Promise((resolve, reject) => {
      inflightRequest.resolve = resolve;
      inflightRequest.reject = reject;
    });
    this._pendingBatch.push(inflightRequest);
    if (!this._pendingBatchAggregator) {
      this._pendingBatchAggregator = setTimeout(() => {
        const array = [];
        const batch = Object.assign(array, this._pendingBatch);
        this._pendingBatch = null;
        this._pendingBatchAggregator = null;
        return Promise.all(sliceToChunks(batch, this.batchSize).map((chunk) => {
          const request = chunk.map((inflight) => inflight.request);
          const requestString = request.length === 1 ? JSON.stringify(request[0]) : JSON.stringify(request);
          return this._queue.add(() => post(url, requestString, options).then((result) => {
            if (!Array.isArray(result) || result.length === 1) {
              const payload2 = !Array.isArray(result) ? result : result[0];
              chunk.forEach((inflightRequest2) => {
                if (payload2.error) {
                  const error = new Error(payload2.error.message);
                  error.code = payload2.error.code;
                  error.data = payload2.error.data;
                  inflightRequest2.reject(error);
                } else if (typeof payload2.result === "undefined") {
                  const msg = typeof payload2 === "string" ? payload2 : typeof payload2 === "object" ? JSON.stringify(payload2) : "Result not available from remote node";
                  inflightRequest2.reject(new Error(msg));
                } else {
                  inflightRequest2.resolve(payload2.result);
                }
              });
            } else {
              chunk.forEach((inflightRequest2, index) => {
                const payload2 = result[index];
                if (payload2.error) {
                  const error = new Error(payload2.error.message);
                  error.code = payload2.error.code;
                  error.data = payload2.error.data;
                  inflightRequest2.reject(error);
                } else if (typeof payload2.result === "undefined") {
                  const msg = typeof payload2 === "string" ? payload2 : typeof payload2 === "object" ? JSON.stringify(payload2) : "Result not available from remote node";
                  inflightRequest2.reject(new Error(msg));
                } else {
                  inflightRequest2.resolve(payload2.result);
                }
              });
            }
          }, (error) => {
            chunk.forEach((inflightRequest2) => {
              inflightRequest2.reject(error);
            });
          }));
        }));
      }, 10);
    }
    return promise;
  }
}

export { AxiosBatchProvider as default };
