// JettonConstants.js - Op kodları ve hata kodları

exports.Op = {
    // Ortak kodlar
    transfer: 0xf8a7ea5,
    transfer_notification: 0x7362d09c,
    internal_transfer: 0x178d4519,
    excesses: 0xd53276db,
    burn: 0x595f07bc,
    burn_notification: 0x7bdd97de,
    provide_wallet_address: 0x2c76b973,
    take_wallet_address: 0xd1735400,
    top_up: 0xd372158c,

    // Jetton-minter
    mint: 0x642b7d07,
    change_admin: 0x6501f354,
    claim_admin: 0xfb88e119,
    upgrade: 0x2508d66a,
    change_metadata_uri: 0xcb862902,
    drop_admin: 0x7431f221,
    merkle_airdrop_claim: 0x0df602d6, // Claim işlemi için gerekli op kodu
};

exports.Errors = {
    invalid_op: 72,
    wrong_op: 0xffff,
    not_owner: 73,
    not_valid_wallet: 74,
    wrong_workchain: 333,
    balance_error: 47,
    not_enough_gas: 48,
    invalid_message: 49,
    airdrop_already_claimed: 54,
    airdrop_not_ready: 55,
    airdrop_finished: 56,
    unknown_custom_payload: 57,
    non_canonical_address: 58
};