'use strict';

var axiosAuto = require('axios-auto');
var ethers = require('ethers');
var PQueue = require('browser-queue');
var assert = require('assert');
var axios = require('axios');
var MockAdapter = require('axios-mock-adapter');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var PQueue__default = /*#__PURE__*/_interopDefaultLegacy(PQueue);
var axios__default = /*#__PURE__*/_interopDefaultLegacy(axios);
var MockAdapter__default = /*#__PURE__*/_interopDefaultLegacy(MockAdapter);

const version = "ethers-queue-provider@5.6.9-beta.0";

const logger = new ethers.utils.Logger(version);
function sliceToChunks(array, size = 10) {
  const results = [];
  for (let i = 0; i < array.length; i += size) {
    results.push(array.slice(i, i + size));
  }
  return results;
}
class AxiosBatchProvider extends ethers.providers.JsonRpcProvider {
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
    this._queue = new PQueue__default["default"](this.queueConfig);
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
          return this._queue.add(() => axiosAuto.post(url, JSON.stringify(request), options).then((result) => {
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

describe("ethers-queue-provider", () => {
  it("eth_blockNumber", async () => {
    const axiosInstance = axios__default["default"];
    const mock = new MockAdapter__default["default"](axiosInstance, { onNoMatch: "throwException" });
    const provider = new AxiosBatchProvider("/", { axios: axiosInstance, timeout: 100, retryMax: 0 });
    const chainId = [{ "jsonrpc": "2.0", "id": 1, "result": "0x5" }];
    const blockNumber = [{ "jsonrpc": "2.0", "id": 2, "result": "0x1" }];
    mock.onPost("/", [{ "jsonrpc": "2.0", "id": 1, "method": "eth_chainId", "params": [] }]).reply(200, chainId).onPost("/", [{ "jsonrpc": "2.0", "id": 2, "method": "eth_blockNumber", "params": [] }]).reply(200, blockNumber);
    const result = await provider.getBlockNumber();
    assert.strict.deepEqual(result, 1);
  });
  it("batch test", async () => {
    const axiosInstance = axios__default["default"];
    const mock = new MockAdapter__default["default"](axiosInstance, { onNoMatch: "throwException" });
    const provider = new AxiosBatchProvider("/", { axios: axiosInstance, timeout: 100, retryMax: 0 });
    const chainId = [{ "jsonrpc": "2.0", "id": 1, "result": "0x38" }];
    const getBlock = [
      { "jsonrpc": "2.0", "id": 2, "result": "0x1" },
      {
        "jsonrpc": "2.0",
        "id": 3,
        "result": {
          "difficulty": "0x2",
          "extraData": "0xd883010002846765746888676f312e31332e34856c696e757800000000000000924cd67a1565fdd24dd59327a298f1d702d6b7a721440c063713cecb7229f4e162ae38be78f6f71aa5badeaaef35cea25061ee2100622a4a1631a07e862b517401",
          "gasLimit": "0x25ff7a7",
          "gasUsed": "0x300b37",
          "hash": "0x04055304e432294a65ff31069c4d3092ff8b58f009cdb50eba5351e0332ad0f6",
          "logsBloom": "0x08000000000000000000000000000000000000000000000000000000000000000000000000000000000000000020000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000",
          "miner": "0x2a7cdd959bfe8d9487b2a43b33565295a698f7e2",
          "mixHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
          "nonce": "0x0000000000000000",
          "number": "0x1",
          "parentHash": "0x0d21840abff46b96c84b2ac9e10e4f5cdaeb5693cb665db62a2f3b02d2d57b5b",
          "receiptsRoot": "0xfc7c0fda97e67ed8ae06e7a160218b3df995560dfcb209a3b0dddde969ec6b00",
          "sha3Uncles": "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
          "size": "0x558",
          "stateRoot": "0x1db428ea79cb2e8cc233ae7f4db7c3567adfcb699af668a9f583fdae98e95588",
          "timestamp": "0x5f49ca59",
          "totalDifficulty": "0x3",
          "transactions": [
            "0xbaf8ffa0b475a67cfeac3992d24422804452f0982e4e21a8816db2e0c9e5f224",
            "0x8ea486df4eafaf713fbbe3b4b0b4196e50fbd1ea93daf66675accf3bf3f59d00",
            "0x9ebc5237eabb339a103a34daf280db3d9498142b49fa47f1af71f64a605acffa",
            "0xc043c5d33f8c3a6d6c0853ff8cbe88ebdf746f8092cb763b18de65db45246a6e",
            "0x2f64d7e926e6fb62f906e18258097af179c213f0c87a717476cce1b334049797",
            "0x463f0a179a89f47b055df14897dd7c55a2d819351568045dcb0496f2875c71ee",
            "0xc02fd5fc71fe8bdc4fec3f97a019a4dc9961eb95e5251c55fcb3da76f5cb5bca"
          ],
          "transactionsRoot": "0x53a8743b873570daa630948b1858eaf5dc9bb0bca2093a197e507b2466c110a0",
          "uncles": []
        }
      }
    ];
    mock.onPost("/", [{ "jsonrpc": "2.0", "id": 1, "method": "eth_chainId", "params": [] }]).reply(200, chainId).onPost("/", [
      { "jsonrpc": "2.0", "id": 2, "method": "eth_blockNumber", "params": [] },
      { "jsonrpc": "2.0", "id": 3, "method": "eth_getBlockByNumber", "params": ["latest", false] }
    ]).reply(200, getBlock);
    const result = await Promise.all([
      provider.getBlockNumber(),
      provider.getBlock("latest")
    ]);
    assert.strict.deepEqual(result, [
      1,
      {
        "hash": "0x04055304e432294a65ff31069c4d3092ff8b58f009cdb50eba5351e0332ad0f6",
        "parentHash": "0x0d21840abff46b96c84b2ac9e10e4f5cdaeb5693cb665db62a2f3b02d2d57b5b",
        "number": 1,
        "timestamp": 1598671449,
        "nonce": "0x0000000000000000",
        "difficulty": 2,
        "gasLimit": ethers.BigNumber.from("0x25ff7a7"),
        "gasUsed": ethers.BigNumber.from("0x300b37"),
        "miner": "0x2a7cdd959bFe8D9487B2a43B33565295a698F7e2",
        "extraData": "0xd883010002846765746888676f312e31332e34856c696e757800000000000000924cd67a1565fdd24dd59327a298f1d702d6b7a721440c063713cecb7229f4e162ae38be78f6f71aa5badeaaef35cea25061ee2100622a4a1631a07e862b517401",
        "transactions": [
          "0xbaf8ffa0b475a67cfeac3992d24422804452f0982e4e21a8816db2e0c9e5f224",
          "0x8ea486df4eafaf713fbbe3b4b0b4196e50fbd1ea93daf66675accf3bf3f59d00",
          "0x9ebc5237eabb339a103a34daf280db3d9498142b49fa47f1af71f64a605acffa",
          "0xc043c5d33f8c3a6d6c0853ff8cbe88ebdf746f8092cb763b18de65db45246a6e",
          "0x2f64d7e926e6fb62f906e18258097af179c213f0c87a717476cce1b334049797",
          "0x463f0a179a89f47b055df14897dd7c55a2d819351568045dcb0496f2875c71ee",
          "0xc02fd5fc71fe8bdc4fec3f97a019a4dc9961eb95e5251c55fcb3da76f5cb5bca"
        ],
        "_difficulty": ethers.BigNumber.from("0x2")
      }
    ]);
  });
});
