import { HIGH_PRICE_IMPACT_BPS } from "../../configs/factors.js";
import { FeeItem } from "../../types/fees.js";
import { MarketInfo } from "../../types/markets.js";
import { SwapStats } from "../../types/trade.js";
import { bigMath } from "../../utils/bigmath.js";
import { applyFactor, getBasisPoints, PRECISION } from "../../utils/numbers.js";

export * from "./estimateOraclePriceCount.js";
export * from "./executionFee.js";
export * from "./priceImpact.js";

export function getSwapFee(
    marketInfo: MarketInfo,
    swapAmount: bigint,
    forPositiveImpact: boolean,
    isAtomicSwap: boolean
) {
    let factor: bigint;

    if (isAtomicSwap) {
        factor = marketInfo.atomicSwapFeeFactor;
    } else {
        factor = forPositiveImpact ? marketInfo.swapFeeFactorForPositiveImpact : marketInfo.swapFeeFactorForNegativeImpact;
    }

    return applyFactor(swapAmount, factor);
}

export function getPositionFee(
    marketInfo: MarketInfo,
    sizeDeltaUsd: bigint,
    balanceWasImproved: boolean,
    referralInfo: { totalRebateFactor: bigint; discountFactor: bigint } | undefined,
    uiFeeFactor?: bigint
) {
    const factor = balanceWasImproved
        ? marketInfo.positionFeeFactorForBalanceWasImproved
        : marketInfo.positionFeeFactorForBalanceWasNotImproved;

    let positionFeeUsd = applyFactor(sizeDeltaUsd, factor);
    const uiFeeUsd = applyFactor(sizeDeltaUsd, uiFeeFactor ?? 0n);

    if (!referralInfo) {
        return { positionFeeUsd, discountUsd: 0n, totalRebateUsd: 0n };
    }

    const totalRebateUsd = applyFactor(positionFeeUsd, referralInfo.totalRebateFactor);
    const discountUsd = applyFactor(totalRebateUsd, referralInfo.discountFactor);

    positionFeeUsd = positionFeeUsd - discountUsd;

    return {
        positionFeeUsd,
        discountUsd,
        totalRebateUsd,
        uiFeeUsd,
    };
}

export function getPositionFeeOrig(
    marketInfo: MarketInfo,
    sizeDeltaUsd: bigint,
    forPositiveImpact: boolean,
    referralInfo: { totalRebateFactor: bigint; discountFactor: bigint } | undefined,
    uiFeeFactor?: bigint
) {
    console.log("Market Info")
    console.log(marketInfo.positionFeeFactorForPositiveImpact)
    console.log(marketInfo.positionFeeFactorForNegativeImpact)

    console.log("For Positive Impact")
    console.log(forPositiveImpact)

    const factor = forPositiveImpact
        ? marketInfo.positionFeeFactorForPositiveImpact
        : marketInfo.positionFeeFactorForNegativeImpact;

    console.log("FACTOR")
    console.log(factor)

    console.log("SIZE DELTA USD")
    console.log(sizeDeltaUsd)

    let positionFeeUsd = applyFactor(sizeDeltaUsd, factor);
    console.log("POSITION FEE USD")
    console.log(positionFeeUsd)
    const uiFeeUsd = applyFactor(sizeDeltaUsd, uiFeeFactor ?? 0n);
    console.log("UI FEE USD")
    console.log(uiFeeUsd)

    if (!referralInfo) {
        return { positionFeeUsd, discountUsd: 0n, totalRebateUsd: 0n };
    }

    const totalRebateUsd = applyFactor(positionFeeUsd, referralInfo.totalRebateFactor);
    console.log("TOTAL REBATE USD")
    console.log(totalRebateUsd)
    const discountUsd = applyFactor(totalRebateUsd, referralInfo.discountFactor);
    console.log("DISCOUNT USD")
    console.log(discountUsd)

    positionFeeUsd = positionFeeUsd - discountUsd;
    console.log("POSITION FEE USD AFTER DISCOUNT")
    console.log(positionFeeUsd)

    return {
        positionFeeUsd,
        discountUsd,
        totalRebateUsd,
        uiFeeUsd,
    };
}

export function getFundingFactorPerPeriod(marketInfo: MarketInfo, isLong: boolean, periodInSeconds: number) {
    const { fundingFactorPerSecond, longsPayShorts, longInterestUsd, shortInterestUsd } = marketInfo;

    const largerInterestUsd = bigMath.max(longInterestUsd, shortInterestUsd);

    const payingInterestUsd = longsPayShorts ? longInterestUsd : shortInterestUsd;
    const receivingInterestUsd = longsPayShorts ? shortInterestUsd : longInterestUsd;

    let fundingForPayingSide = 0n;
    if (payingInterestUsd !== 0n) {
        fundingForPayingSide = bigMath.mulDiv(fundingFactorPerSecond, largerInterestUsd, payingInterestUsd);
    }
    let fundingForReceivingSide = 0n;
    if (receivingInterestUsd !== 0n) {
        fundingForReceivingSide = bigMath.mulDiv(fundingForPayingSide, payingInterestUsd, receivingInterestUsd);
    }

    if ((longsPayShorts && isLong) || (!longsPayShorts && !isLong)) {
        // paying side
        return fundingForPayingSide * BigInt(periodInSeconds) * -1n;
    } else {
        // receiving side
        return fundingForReceivingSide * BigInt(periodInSeconds);
    }
}

export function getFundingFeeRateUsd(
    marketInfo: MarketInfo,
    isLong: boolean,
    sizeInUsd: bigint,
    periodInSeconds: number
) {
    const factor = getFundingFactorPerPeriod(marketInfo, isLong, periodInSeconds);

    return applyFactor(sizeInUsd, factor);
}

export function getBorrowingFactorPerPeriod(marketInfo: MarketInfo, isLong: boolean, periodInSeconds: number) {
    const factorPerSecond = isLong
        ? marketInfo.borrowingFactorPerSecondForLongs
        : marketInfo.borrowingFactorPerSecondForShorts;

    return factorPerSecond * BigInt(periodInSeconds || 1);
}

export function getBorrowingFeeRateUsd(
    marketInfo: MarketInfo,
    isLong: boolean,
    sizeInUsd: bigint,
    periodInSeconds: number
) {
    const factor = getBorrowingFactorPerPeriod(marketInfo, isLong, periodInSeconds);

    return applyFactor(sizeInUsd, factor);
}

export function getIsHighPriceImpact(positionPriceImpact?: FeeItem, swapPriceImpact?: FeeItem) {
    const totalPriceImpact = getTotalFeeItem([positionPriceImpact, swapPriceImpact]);
    return totalPriceImpact.deltaUsd < 0 && bigMath.abs(totalPriceImpact.bps) >= HIGH_PRICE_IMPACT_BPS;
}

export function getFeeItem(
    feeDeltaUsd?: bigint,
    basis?: bigint,
    opts: { shouldRoundUp?: boolean } = {}
): FeeItem | undefined {
    const { shouldRoundUp = false } = opts;
    if (feeDeltaUsd === undefined) return undefined;

    return {
        deltaUsd: feeDeltaUsd,
        bps: basis !== undefined && basis > 0 ? getBasisPoints(feeDeltaUsd, basis, shouldRoundUp) : 0n,
        precisePercentage: basis !== undefined && basis > 0 ? bigMath.mulDiv(feeDeltaUsd, PRECISION, basis) : 0n,
    };
}

export function getTotalFeeItem(feeItems: (FeeItem | undefined)[]): FeeItem {
    const totalFeeItem: FeeItem = {
        deltaUsd: 0n,
        bps: 0n,
        precisePercentage: 0n,
    };

    (feeItems.filter(Boolean) as FeeItem[]).forEach((feeItem) => {
        totalFeeItem.deltaUsd = totalFeeItem.deltaUsd + feeItem.deltaUsd;
        totalFeeItem.bps = totalFeeItem.bps + feeItem.bps;
        totalFeeItem.precisePercentage = totalFeeItem.precisePercentage + feeItem.precisePercentage;
    });

    return totalFeeItem;
}

export function getTotalSwapVolumeFromSwapStats(swapSteps?: SwapStats[]) {
    if (!swapSteps) return 0n;

    return swapSteps.reduce((acc, curr) => {
        return acc + curr.usdIn;
    }, 0n);
}
