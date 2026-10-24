export const sachBazaarDomain = (chainId: bigint | number, verifyingContract: string) => ({
  name: 'SachBazaar',
  version: '1',
  chainId,
  verifyingContract,
} as const);

export const createBatchTypes = {
  CreateBatch: [
    { name: 'batchId', type: 'bytes32' },
    { name: 'farmerId', type: 'bytes32' },
    { name: 'coopId', type: 'bytes32' },
    { name: 'cropCode', type: 'uint16' },
    { name: 'weightGrams', type: 'uint32' },
    { name: 'pricePerKgPaise', type: 'uint32' },
    { name: 'photoHash', type: 'bytes32' },
    { name: 'metadataHash', type: 'bytes32' },
    { name: 'geoHash', type: 'bytes32' },
    { name: 'signer', type: 'address' },
    { name: 'signerRole', type: 'uint8' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export const handoverTypes = {
  Handover: [
    { name: 'batchId', type: 'bytes32' },
    { name: 'fromSigner', type: 'address' },
    { name: 'toSigner', type: 'address' },
    { name: 'nextStage', type: 'uint8' },
    { name: 'pricePerKgPaise', type: 'uint32' },
    { name: 'locationHash', type: 'bytes32' },
    { name: 'prevRecordHash', type: 'bytes32' },
    { name: 'signer', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export const aiAttestationTypes = {
  AIAttestation: [
    { name: 'batchId', type: 'bytes32' },
    { name: 'aiGrade', type: 'uint8' },
    { name: 'aiFlags', type: 'uint16' },
    { name: 'resultHash', type: 'bytes32' },
    { name: 'oracleSigner', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export const saleTypes = {
  Sale: [
    { name: 'batchId', type: 'bytes32' },
    { name: 'finalPricePerKgPaise', type: 'uint32' },
    { name: 'signer', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;
