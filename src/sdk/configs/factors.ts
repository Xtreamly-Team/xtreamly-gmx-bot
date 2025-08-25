import { BASIS_POINTS_DIVISOR } from "../utils/numbers.js";
export { USD_DECIMALS, BASIS_POINTS_DIVISOR, BASIS_POINTS_DIVISOR_BIGINT, BASIS_POINTS_DECIMALS } from "../utils/numbers.js";

// V2
export const HIGH_PRICE_IMPACT_BPS = 80; // 0.8%
export const HIGH_POSITION_IMPACT_BPS = 50; // 0.5%
export const HIGH_COLLATERAL_IMPACT_BPS = 500; // 5%
export const HIGH_SWAP_IMPACT_BPS = 50; // 0.5%
export const DEFAULT_ACCEPTABLE_PRICE_IMPACT_BUFFER = 30; // 0.3%
export const HIGH_ALLOWED_SWAP_SLIPPAGE_BPS = 20; // 0.2%
export const DEFAULT_ALLOWED_SWAP_SLIPPAGE_BPS = 100n; // 1%

export const FACTOR_TO_PERCENT_MULTIPLIER_BIGINT = 100n;

/**
 * @deprecated for v2: calculate leverage based on marketInfo.minCollateralFactor
 */
export const MAX_LEVERAGE = 100 * BASIS_POINTS_DIVISOR;
/**
 * @deprecated for v2: calculate leverage based on marketInfo.minCollateralFactor
 */
export const MAX_ALLOWED_LEVERAGE = 50 * BASIS_POINTS_DIVISOR;

export const COLLATERAL_SPREAD_SHOW_AFTER_INITIAL_ZERO_THRESHOLD = 5; // 0.05%

export const DEFAULT_SLIPPAGE_AMOUNT = 100; // 1%
export const DEFAULT_HIGHER_SLIPPAGE_AMOUNT = 100; // 1%
export const EXCESSIVE_SLIPPAGE_AMOUNT = 2 * 100; // 2%
export const HIGH_ACCEPTABLE_POSITION_IMPACT_BPS = 50; // 0.5%
export const HIGH_SWAP_PROFIT_FEE_BPS = 100; // 1%
