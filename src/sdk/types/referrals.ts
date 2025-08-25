export type UserReferralInfo = {
    userReferralCode: string;
    userReferralCodeString: string;
    referralCodeForTxn: string;
    attachedOnChain: boolean;
    affiliate: string;
    tierId: number;
    totalRebate: bigint;
    totalRebateFactor: bigint;
    discountShare: bigint;
    discountFactor: bigint;
    error?: Error;
};
