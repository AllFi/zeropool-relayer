import BN from 'bn.js'
import { toBN } from 'web3-utils'
import { TxType } from 'zp-memo-parser'
import { Helpers, Proof } from 'libzeropool-rs-node'
import { logger } from './services/appLogger'
import { config } from './config/config'
import { pool } from './pool'

const ZERO = toBN(0)

export interface Delta {
  transferIndex: BN
  energyAmount: BN
  tokenAmount: BN
  poolId: BN
}

export function checkCommitment(treeProof: Proof, txProof: Proof) {
  return treeProof.inputs[2] === txProof.inputs[2]
}

export function checkTxProof(txProof: Proof) {
  return pool.verifyProof(txProof.proof, txProof.inputs)
}

export async function checkNullifier(nullifier: string) {
  const exists = await pool.PoolInstance.methods.nullifiers(nullifier).call()
  return toBN(exists).eq(ZERO)
}

export function checkTransferIndex(contractPoolIndex: BN, transferIndex: BN) {
  return transferIndex.lte(contractPoolIndex)
}

export function checkTxSpecificFields(txType: TxType, tokenAmount: BN, energyAmount: BN, nativeAmount: BN | null, msgValue: BN) {
  logger.debug(`TOKENS ${tokenAmount.toString()}, ENERGY ${energyAmount.toString()}, MEMO NATIVE ${nativeAmount?.toString()}, MSG VALUE ${msgValue.toString()}`)
  let isValid = false
  if (txType === TxType.DEPOSIT) {
    isValid =
      tokenAmount.gte(ZERO) &&
      energyAmount.eq(ZERO) &&
      msgValue.eq(ZERO)
  } else if (txType === TxType.TRANSFER) {
    isValid =
      tokenAmount.eq(ZERO) &&
      energyAmount.eq(ZERO) &&
      msgValue.eq(ZERO)
  } else if (txType === TxType.WITHDRAWAL) {
    isValid =
      tokenAmount.lte(ZERO) &&
      energyAmount.lte(ZERO)
    if (nativeAmount)
      isValid = isValid && msgValue.eq(nativeAmount.mul(pool.denominator))
  }
  return isValid
}

export function parseDelta(delta: string): Delta {
  const { poolId, index, e, v } = Helpers.parseDelta(delta)
  return {
    transferIndex: toBN(index),
    energyAmount: toBN(e),
    tokenAmount: toBN(v),
    poolId: toBN(poolId),
  }
}

export function checkNativeAmount(nativeAmount: BN | null) {
  logger.debug(`Native amount: ${nativeAmount}`)
  // Check native amount (relayer faucet)
  if (nativeAmount && nativeAmount > config.maxFaucet) {
    return false
  }
  return true
}

export function checkFee(fee: BN) {
  logger.debug(`Fee: ${fee}`)
  return fee >= config.relayerFee
}

export async function checkAssertion(f: Function, errStr: string) {
  const res = await f()
  if (!res) {
    logger.error(errStr)
    throw new Error(errStr)
  }
}