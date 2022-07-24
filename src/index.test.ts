import AxiosQueueProvider from './index';
import { strict as assert } from 'assert';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { BigNumber } from 'ethers';

/**
 * Test specs written according to
 * https://eth.wiki/json-rpc/API
 * https://docs.ethers.io/v5/api/providers/
 */
describe('ethers-queue-provider', () => {
  it('eth_blockNumber', async () => {
    const axiosInstance = axios;
    const mock = new MockAdapter(axiosInstance, { onNoMatch: 'throwException' });
    const provider = new AxiosQueueProvider('/', { axios: axiosInstance, timeout: 100, retryMax: 0 });
    const chainId = { 'jsonrpc': '2.0', 'id': 1, 'result': '0x5' };
    const blockNumber = { 'jsonrpc': '2.0', 'id': 2, 'result': '0x1' };
    mock
      .onPost('/', { 'jsonrpc': '2.0', 'id': 1, 'method': 'eth_chainId', 'params': [] })
      .reply(200, chainId)
      .onPost('/', { 'jsonrpc': '2.0', 'id': 2, 'method': 'eth_blockNumber', 'params': [] })
      .reply(200, blockNumber);
    const result = await provider.getBlockNumber();
    assert.deepEqual(result, 1);
  });

  it('batch test', async () => {
    const axiosInstance = axios;
    const mock = new MockAdapter(axiosInstance, { onNoMatch: 'throwException' });
    const provider = new AxiosQueueProvider('/', { axios: axiosInstance, timeout: 100, retryMax: 0 });
    const chainId = { 'jsonrpc': '2.0', 'id': 1, 'result': '0x38' };
    const getBlock = [
      { 'jsonrpc': '2.0', 'id': 2, 'result': '0x1' },
      {
        'jsonrpc': '2.0',
        'id': 3,
        'result': {
          'difficulty': '0x2',
          'extraData': '0xd883010002846765746888676f312e31332e34856c696e757800000000000000924cd67a1565fdd24dd59327a298f1d702d6b7a721440c063713cecb7229f4e162ae38be78f6f71aa5badeaaef35cea25061ee2100622a4a1631a07e862b517401',
          'gasLimit': '0x25ff7a7',
          'gasUsed': '0x300b37',
          'hash': '0x04055304e432294a65ff31069c4d3092ff8b58f009cdb50eba5351e0332ad0f6',
          'logsBloom': '0x08000000000000000000000000000000000000000000000000000000000000000000000000000000000000000020000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000',
          'miner': '0x2a7cdd959bfe8d9487b2a43b33565295a698f7e2',
          'mixHash': '0x0000000000000000000000000000000000000000000000000000000000000000',
          'nonce': '0x0000000000000000',
          'number': '0x1',
          'parentHash': '0x0d21840abff46b96c84b2ac9e10e4f5cdaeb5693cb665db62a2f3b02d2d57b5b',
          'receiptsRoot': '0xfc7c0fda97e67ed8ae06e7a160218b3df995560dfcb209a3b0dddde969ec6b00',
          'sha3Uncles': '0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347',
          'size': '0x558',
          'stateRoot': '0x1db428ea79cb2e8cc233ae7f4db7c3567adfcb699af668a9f583fdae98e95588',
          'timestamp': '0x5f49ca59',
          'totalDifficulty': '0x3',
          'transactions': [
            '0xbaf8ffa0b475a67cfeac3992d24422804452f0982e4e21a8816db2e0c9e5f224',
            '0x8ea486df4eafaf713fbbe3b4b0b4196e50fbd1ea93daf66675accf3bf3f59d00',
            '0x9ebc5237eabb339a103a34daf280db3d9498142b49fa47f1af71f64a605acffa',
            '0xc043c5d33f8c3a6d6c0853ff8cbe88ebdf746f8092cb763b18de65db45246a6e',
            '0x2f64d7e926e6fb62f906e18258097af179c213f0c87a717476cce1b334049797',
            '0x463f0a179a89f47b055df14897dd7c55a2d819351568045dcb0496f2875c71ee',
            '0xc02fd5fc71fe8bdc4fec3f97a019a4dc9961eb95e5251c55fcb3da76f5cb5bca'
          ],
          'transactionsRoot': '0x53a8743b873570daa630948b1858eaf5dc9bb0bca2093a197e507b2466c110a0',
          'uncles': []
        }
      }
    ];
    mock
      .onPost('/', { 'jsonrpc': '2.0', 'id': 1, 'method': 'eth_chainId', 'params': [] })
      .reply(200, chainId)
      .onPost('/', [
        { 'jsonrpc': '2.0', 'id': 2, 'method': 'eth_blockNumber', 'params': [] },
        { 'jsonrpc': '2.0', 'id': 3, 'method': 'eth_getBlockByNumber', 'params': ['latest', false] },
      ])
      .reply(200, getBlock);
    const result = await Promise.all([
      provider.getBlockNumber(),
      provider.getBlock('latest')
    ]);
    assert.deepEqual(result, [
      1,
      {
        'hash': '0x04055304e432294a65ff31069c4d3092ff8b58f009cdb50eba5351e0332ad0f6',
        'parentHash': '0x0d21840abff46b96c84b2ac9e10e4f5cdaeb5693cb665db62a2f3b02d2d57b5b',
        'number': 1,
        'timestamp': 1598671449,
        'nonce': '0x0000000000000000',
        'difficulty': 2,
        'gasLimit': BigNumber.from('0x25ff7a7'),
        'gasUsed': BigNumber.from('0x300b37'),
        'miner': '0x2a7cdd959bFe8D9487B2a43B33565295a698F7e2',
        'extraData': '0xd883010002846765746888676f312e31332e34856c696e757800000000000000924cd67a1565fdd24dd59327a298f1d702d6b7a721440c063713cecb7229f4e162ae38be78f6f71aa5badeaaef35cea25061ee2100622a4a1631a07e862b517401',
        'transactions': [
          '0xbaf8ffa0b475a67cfeac3992d24422804452f0982e4e21a8816db2e0c9e5f224',
          '0x8ea486df4eafaf713fbbe3b4b0b4196e50fbd1ea93daf66675accf3bf3f59d00',
          '0x9ebc5237eabb339a103a34daf280db3d9498142b49fa47f1af71f64a605acffa',
          '0xc043c5d33f8c3a6d6c0853ff8cbe88ebdf746f8092cb763b18de65db45246a6e',
          '0x2f64d7e926e6fb62f906e18258097af179c213f0c87a717476cce1b334049797',
          '0x463f0a179a89f47b055df14897dd7c55a2d819351568045dcb0496f2875c71ee',
          '0xc02fd5fc71fe8bdc4fec3f97a019a4dc9961eb95e5251c55fcb3da76f5cb5bca'
        ],
        '_difficulty': BigNumber.from('0x2')
      }
    ]);
  });
});
