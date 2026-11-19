// AUTO-GENERATED from docs/studies/ui/surfaces/*.scm — DO NOT EDIT MANUALLY.
// Zero runtime dependencies; importable by both React (ui/src) and Svelte (frontend/src/lib).

export const FIGURE_TERMS = {
  "everyday-cash": "cash",
  "arriving-cash": "arriving",
  "friends-tabs": "people",
  "savings-balance": "savings",
  "secured-receivable": "secured",
  "unbacked-exposure": "unbacked",
  "owed-payable": "owed",
  "net-position": "net",
  "onchain-cash": "onchain",
  "reserve-cash": "reserve",
  "send-capacity": "send-room",
  "receive-capacity": "receive-room",
  "peer-credit-granted": "peer-credit",
  "own-credit-granted": "own-credit",
  "account-lanes": "lanes",
  "orderbook-frame": "book",
  "dispute-phase": "dispute",
  "entity-board": "board"
} as const;

export const SIGNING_SHEETS = {
  "everyday-inline-action": {
    "delivery": "inline-quiet",
    "covers": [
      "send-routed",
      "send-direct",
      "request-payment-link",
      "move-r2e",
      "extend-peer-tab",
      "deposit-savings",
      "close-savings"
    ],
    "shows": [
      "human-summary",
      "fee-ceiling"
    ],
    "feeBefore": true,
    "survival": null,
    "warns": []
  },
  "external-request-sheet": {
    "delivery": "interrupt-sheet",
    "covers": [
      "send-routed",
      "send-direct",
      "extend-peer-tab"
    ],
    "shows": [
      "program-origin",
      "human-summary",
      "fee-ceiling",
      "expiry-deadline"
    ],
    "feeBefore": true,
    "survival": "Completed payments are final; shared tabs stay between you and the person you named.",
    "warns": [
      "Only open a tab with someone you actually know and trust."
    ]
  },
  "sheet-spend": {
    "delivery": "interrupt-sheet",
    "covers": [
      "send-direct",
      "send-routed",
      "instant-swap",
      "move-r2r"
    ],
    "shows": [
      "program-origin",
      "counterparty",
      "delta-secured",
      "delta-unbacked-risk",
      "fee-exact"
    ],
    "feeBefore": true,
    "survival": "This payment is final once both sides sign it.",
    "warns": []
  },
  "sheet-exposure": {
    "delivery": "interrupt-sheet",
    "covers": [
      "open-account",
      "extend-peer-tab",
      "set-hub-credit",
      "deposit-savings",
      "rebalance-policy"
    ],
    "shows": [
      "program-origin",
      "counterparty",
      "delta-secured",
      "delta-unbacked-risk",
      "delta-credit-limit",
      "fee-exact"
    ],
    "feeBefore": true,
    "survival": "Only collateral secures recovery.",
    "warns": [
      "You are letting them owe you up to this amount with nothing locked behind it.",
      "Credit does not guarantee repayment."
    ]
  },
  "sheet-secure": {
    "delivery": "interrupt-sheet",
    "covers": [
      "request-cover",
      "move-r2c"
    ],
    "shows": [
      "counterparty",
      "delta-secured",
      "delta-unbacked-risk",
      "fee-exact"
    ],
    "feeBefore": true,
    "survival": "For cover requests, you pay the fee now and nothing new is locked until their on-chain deposit confirms; once locked, you can claim it yourself after the waiting period without them.",
    "warns": []
  },
  "sheet-term": {
    "delivery": "interrupt-sheet",
    "covers": [
      "place-limit-order",
      "cancel-order",
      "cross-j-swap",
      "borrow-facility",
      "repay-loan",
      "close-savings"
    ],
    "shows": [
      "program-origin",
      "counterparty",
      "delta-secured",
      "delta-unbacked-risk",
      "delta-owed",
      "expiry-deadline",
      "fee-exact"
    ],
    "feeBefore": true,
    "survival": "Until the deadline this amount is held and you cannot spend it.",
    "warns": [
      "If it does not complete by the deadline, the held amount returns to you."
    ]
  },
  "sheet-exit": {
    "delivery": "interrupt-sheet",
    "covers": [
      "unilateral-exit",
      "finalize-dispute"
    ],
    "shows": [
      "counterparty",
      "delta-secured",
      "delta-unbacked-risk",
      "expiry-deadline",
      "fee-exact"
    ],
    "feeBefore": true,
    "survival": "You get back what is locked. What they owe you beyond that stays owed.",
    "warns": [
      "This ends the Account with them. It cannot be undone."
    ]
  },
  "sheet-treasury-admin": {
    "delivery": "interrupt-sheet",
    "covers": [
      "move-r2e",
      "set-bank-rates",
      "propose-multisig",
      "vote-multisig",
      "export-backup",
      "reset-testnet"
    ],
    "shows": [
      "program-origin",
      "counterparty",
      "delta-secured",
      "delta-owed",
      "fee-exact",
      "expiry-deadline"
    ],
    "feeBefore": true,
    "survival": "Coins withdrawn to your external address and reserve unassigned to an Account remain yours without counterparty cooperation.",
    "warns": [
      "Each Account stays on its own line with its own fee; a batch never collapses into one blended figure.",
      "If the board is short of its count, this only queues a proposal. No money has moved."
    ]
  }
} as const;

export const XLN_APPS = {
  "otc-deal-room": {
    "kind": "external",
    "render": "fixed",
    "reads": [
      "send-capacity",
      "receive-capacity",
      "secured-receivable"
    ],
    "requests": [
      "cross-j-swap",
      "instant-swap",
      "request-cover"
    ],
    "claimShown": "Settle negotiated 50,000 USDC -> TRX cross-chain deal and lock collateral."
  },
  "merchant-checkout": {
    "kind": "external",
    "render": "fixed",
    "reads": [
      "send-capacity",
      "secured-receivable"
    ],
    "requests": [
      "send-routed",
      "send-direct"
    ],
    "claimShown": "Pay this merchant 25.00 USDC. You see who is paid and the fee ceiling before signing."
  },
  "group-tab": {
    "kind": "embedded",
    "render": "generative",
    "reads": [
      "unbacked-exposure",
      "owed-payable",
      "peer-credit-granted",
      "secured-receivable"
    ],
    "requests": [
      "extend-peer-tab",
      "send-direct",
      "send-routed",
      "request-cover"
    ],
    "claimShown": "Split a shared bill; any tab ceiling, payment, or lock request signs through the wallet sheet."
  },
  "instant-convert": {
    "kind": "embedded",
    "render": "fixed",
    "reads": [
      "send-capacity",
      "orderbook-frame"
    ],
    "requests": [
      "instant-swap"
    ],
    "claimShown": "Swap now at the quoted price, then confirm collateral and unbacked deltas on the wallet sheet."
  },
  "simple-savings": {
    "kind": "embedded",
    "render": "fixed",
    "reads": [
      "secured-receivable",
      "own-credit-granted",
      "peer-credit-granted"
    ],
    "requests": [
      "deposit-savings",
      "close-savings"
    ],
    "claimShown": "Deposit into hub savings only after signing the maximum unsecured amount at risk."
  },
  "otc-room": {
    "kind": "external",
    "render": "fixed",
    "reads": [
      "send-capacity",
      "secured-receivable",
      "unbacked-exposure",
      "peer-credit-granted",
      "own-credit-granted"
    ],
    "requests": [
      "send-direct",
      "request-cover",
      "extend-peer-tab"
    ],
    "claimShown": "Co-sign one bilateral OTC deal with locked collateral, unbacked IOU, credit ceiling, and fee itemized on the wallet sheet."
  },
  "b2b-netting": {
    "kind": "embedded",
    "render": "fixed",
    "reads": [
      "account-lanes",
      "owed-payable",
      "unbacked-exposure",
      "net-position",
      "send-capacity"
    ],
    "requests": [
      "send-routed",
      "send-direct"
    ],
    "claimShown": "Net open supplier items across your Accounts and sign one itemized residual line per counterparty."
  },
  "cross-j-rfq": {
    "kind": "embedded",
    "render": "fixed",
    "reads": [
      "orderbook-frame",
      "send-capacity",
      "receive-capacity",
      "reserve-cash",
      "onchain-cash"
    ],
    "requests": [
      "cross-j-swap",
      "place-limit-order",
      "cancel-order",
      "instant-swap"
    ],
    "claimShown": "Review exact two-network legs, fee ceiling, and expiry deadline before signing."
  },
  "hub-facility": {
    "kind": "embedded",
    "render": "fixed",
    "reads": [
      "reserve-cash",
      "account-lanes",
      "peer-credit-granted",
      "own-credit-granted"
    ],
    "requests": [
      "set-bank-rates",
      "borrow-facility",
      "repay-loan"
    ],
    "claimShown": "Publish hub bank terms or draw/repay a signed facility with debt and deadline itemized."
  },
  "mppx-spend-steward": {
    "kind": "steward",
    "render": "generative",
    "reads": [
      "send-capacity",
      "secured-receivable",
      "unbacked-exposure",
      "account-lanes"
    ],
    "requests": [
      "send-routed"
    ],
    "claimShown": "Authorize up to 25.00 USDC over 24 hours for metered API calls (0.25 USDC max per call, 0.01 USDC max routing fee)."
  },
  "auto-cover-steward": {
    "kind": "steward",
    "render": "generative",
    "reads": [
      "unbacked-exposure",
      "secured-receivable",
      "peer-credit-granted",
      "account-lanes"
    ],
    "requests": [
      "rebalance-policy",
      "request-cover"
    ],
    "claimShown": "Request on-chain collateral cover whenever unbacked receivables exceed 50.00 USDC at <= 0.20% fee."
  },
  "scheduled-payout-steward": {
    "kind": "steward",
    "render": "generative",
    "reads": [
      "secured-receivable",
      "send-capacity",
      "reserve-cash",
      "account-lanes",
      "entity-board"
    ],
    "requests": [
      "send-routed",
      "send-direct",
      "move-r2r"
    ],
    "claimShown": "Queue Friday supplier and payroll schedule across verified recipients with per-lane lines and fee ceiling."
  },
  "disguised-10k-credit-reward": {
    "kind": "hostile-test",
    "render": "generative",
    "reads": [
      "own-credit-granted",
      "peer-credit-granted",
      "receive-capacity"
    ],
    "requests": [
      "set-hub-credit",
      "extend-peer-tab"
    ],
    "claimShown": "Claim your 50.00 USDC welcome reward and unlock zero-fee instant receiving."
  },
  "unbacked-swap-bait": {
    "kind": "hostile-test",
    "render": "generative",
    "reads": [
      "secured-receivable",
      "net-position",
      "orderbook-frame"
    ],
    "requests": [
      "instant-swap",
      "extend-peer-tab"
    ],
    "claimShown": "Swap 1,000.00 USDC for 1,005.00 USDT instantly (+0.50% maker rebate, 100% backed)."
  },
  "hidden-fee-drain": {
    "kind": "hostile-test",
    "render": "generative",
    "reads": [
      "send-capacity",
      "secured-receivable",
      "account-lanes"
    ],
    "requests": [
      "send-routed",
      "request-cover",
      "rebalance-policy"
    ],
    "claimShown": "Pay 5.00 USDC for monthly API access — routing and maintenance fees sponsored (0.00 USDC)."
  },
  "stalled-hub-trap": {
    "kind": "hostile-test",
    "render": "fixed",
    "reads": [
      "dispute-phase",
      "unbacked-exposure",
      "secured-receivable"
    ],
    "requests": [
      "open-account",
      "deposit-savings",
      "send-direct"
    ],
    "claimShown": "Hub sync delayed — sign fast-track bridge release to unlock your stuck 500.00 USDC without waiting on-chain."
  }
} as const;

export const SURFACES = {
  "everyday": {
    "posture": "human-everyday",
    "entry": "home",
    "modes": [
      "personal-only"
    ],
    "terms": {
      "cash": {
        "text": "Cash",
        "basis": "guess",
        "note": "Your money, ready to spend or cash out anytime.",
        "noteWhen": "always"
      },
      "arriving": {
        "text": "Arriving",
        "basis": "guess",
        "note": "Finishing automatically before it joins your Cash.",
        "noteWhen": "non-zero"
      },
      "people": {
        "text": "Friends & tabs",
        "basis": "guess",
        "note": "Shared bills and tabs with people you know.",
        "noteWhen": "non-zero"
      },
      "owed": {
        "text": "You owe",
        "basis": "guess",
        "note": "Settle up in one tap whenever you are ready.",
        "noteWhen": "non-zero"
      },
      "savings": {
        "text": "Savings",
        "basis": "guess",
        "note": "Lent to earn interest — not protected like Cash; separate from Cash and requires explicit consent.",
        "noteWhen": "always"
      }
    },
    "autopilots": {
      "auto-settle-incoming": {
        "verbs": [
          "open-account",
          "request-cover",
          "rebalance-policy"
        ],
        "trigger": "Whenever an incoming hub payment arrives as unsettled hub float.",
        "behavior": "Automatically settles incoming hub float into protected on-chain Cash under a built-in <= 0.20% fee cap, showing 'Incoming · finishing...' for a few seconds instead of a manual Cover button.",
        "fallback": "Payment still finishing — we will keep retrying automatically."
      },
      "auto-route-funds": {
        "verbs": [
          "move-r2c",
          "instant-swap"
        ],
        "trigger": "Whenever Pay or Cash out crosses internal wallet/contract buckets or token pairs.",
        "behavior": "Automatically routes across wallet, contract, and stablecoin pairs behind one Cash balance so the user never manages four buckets.",
        "fallback": "Could not complete right now — your Cash was not touched."
      },
      "auto-recovery-shield": {
        "verbs": [
          "unilateral-exit",
          "finalize-dispute",
          "export-backup"
        ],
        "trigger": "Encrypted backup on setup, plus automatic on-chain claim if a payment hub ever stops responding.",
        "behavior": "Automatically submits the latest signed proof and returns settled funds to Cash without asking the user to act as a lawyer or operator.",
        "fallback": "Provider offline — recovery service blocks stale claims automatically, while starting your own on-chain exit requires network gas (0 ETH available)."
      }
    },
    "flows": {
      "pay": {
        "verb": "send-routed",
        "before": {
          "text": "Pay",
          "basis": "guess"
        },
        "pending": {
          "text": "Sending...",
          "basis": "guess"
        },
        "done": {
          "text": "Sent",
          "basis": "guess"
        },
        "failed": {
          "text": "Not sent — your Cash is untouched.",
          "basis": "guess"
        }
      },
      "request-link": {
        "verb": "request-payment-link",
        "before": {
          "text": "Request",
          "basis": "guess"
        },
        "pending": {
          "text": "Creating request link...",
          "basis": "guess"
        },
        "done": {
          "text": "Request link ready to share",
          "basis": "guess"
        },
        "failed": {
          "text": "Could not create request link.",
          "basis": "guess"
        }
      },
      "settle-tab": {
        "verb": "send-direct",
        "before": {
          "text": "Settle up",
          "basis": "guess"
        },
        "pending": {
          "text": "Settling tab...",
          "basis": "guess"
        },
        "done": {
          "text": "All settled up",
          "basis": "guess"
        },
        "failed": {
          "text": "Could not reach them — tab unchanged.",
          "basis": "guess"
        }
      },
      "split-tab": {
        "verb": "extend-peer-tab",
        "before": {
          "text": "Split a bill",
          "basis": "guess"
        },
        "pending": {
          "text": "Sharing split...",
          "basis": "guess"
        },
        "done": {
          "text": "Added to tab",
          "basis": "guess"
        },
        "failed": {
          "text": "Split cancelled.",
          "basis": "guess"
        }
      },
      "cash-out": {
        "verb": "move-r2e",
        "before": {
          "text": "Cash out",
          "basis": "guess"
        },
        "pending": {
          "text": "Sending to your account...",
          "basis": "guess"
        },
        "done": {
          "text": "Cashed out",
          "basis": "guess"
        },
        "failed": {
          "text": "Cash out cancelled — balance unchanged.",
          "basis": "guess"
        }
      },
      "save-in": {
        "verb": "deposit-savings",
        "before": {
          "text": "Add to Savings",
          "basis": "guess"
        },
        "pending": {
          "text": "Moving to Savings...",
          "basis": "guess"
        },
        "done": {
          "text": "Earning interest in Savings",
          "basis": "guess"
        },
        "failed": {
          "text": "Stayed in Cash.",
          "basis": "guess"
        }
      },
      "save-out": {
        "verb": "close-savings",
        "before": {
          "text": "Move to Cash",
          "basis": "guess"
        },
        "pending": {
          "text": "Moving back to Cash...",
          "basis": "guess"
        },
        "done": {
          "text": "Back in Cash",
          "basis": "guess"
        },
        "failed": {
          "text": "Still in Savings — safe to retry.",
          "basis": "guess"
        }
      },
      "reset-demo": {
        "verb": "reset-testnet",
        "before": {
          "text": "Clear test data",
          "basis": "guess"
        },
        "pending": {
          "text": "Clearing test data...",
          "basis": "guess"
        },
        "done": {
          "text": "Test data cleared; login kept.",
          "basis": "guess"
        },
        "failed": {
          "text": "Nothing changed.",
          "basis": "guess"
        }
      }
    },
    "screens": [
      "home",
      "people",
      "earn",
      "activity"
    ],
    "doors": [
      "place-limit-order",
      "cancel-order",
      "cross-j-swap",
      "move-r2r",
      "set-hub-credit",
      "borrow-facility",
      "repay-loan",
      "set-bank-rates",
      "propose-multisig",
      "vote-multisig"
    ]
  },
  "personal": {
    "posture": "legacy-bucket-baseline",
    "entry": "home",
    "modes": [
      "personal-only"
    ],
    "terms": {
      "secured": {
        "text": "Backed by collateral",
        "basis": "as-is",
        "note": "Covered by funds locked on-chain.",
        "noteWhen": "non-zero"
      },
      "unbacked": {
        "text": "Without collateral",
        "basis": "as-is",
        "note": "Repayment depends on the other party.",
        "noteWhen": "non-zero"
      },
      "owed": {
        "text": "You owe",
        "basis": "as-is",
        "note": null,
        "noteWhen": "always"
      },
      "cover": {
        "text": "Cover it",
        "basis": "as-is",
        "note": null,
        "noteWhen": "always"
      },
      "peer-credit": {
        "text": "Tab limit",
        "basis": "guess",
        "note": null,
        "noteWhen": "always"
      },
      "hub": {
        "text": "Payment hub",
        "basis": "as-is",
        "note": null,
        "noteWhen": "always"
      },
      "exit": {
        "text": "Withdraw on-chain",
        "basis": "guess",
        "note": null,
        "noteWhen": "always"
      }
    },
    "autopilots": {},
    "flows": {
      "pay": {
        "verb": "send-routed",
        "before": {
          "text": "Pay",
          "basis": "as-is"
        },
        "pending": {
          "text": "Sending payment...",
          "basis": "guess"
        },
        "done": {
          "text": "Payment settled in signed Account frame.",
          "basis": "guess"
        },
        "failed": {
          "text": "Payment did not complete; balances unchanged.",
          "basis": "guess"
        }
      },
      "pay-direct": {
        "verb": "send-direct",
        "before": {
          "text": "Pay directly",
          "basis": "guess"
        },
        "pending": {
          "text": "Co-signing bilateral payment...",
          "basis": "guess"
        },
        "done": {
          "text": "Direct payment settled.",
          "basis": "guess"
        },
        "failed": {
          "text": "Counterparty did not co-sign; balances unchanged.",
          "basis": "guess"
        }
      },
      "receive": {
        "verb": "open-account",
        "before": {
          "text": "Receive",
          "basis": "as-is"
        },
        "pending": {
          "text": "Preparing receive link...",
          "basis": "guess"
        },
        "done": {
          "text": "Account ready to receive.",
          "basis": "guess"
        },
        "failed": {
          "text": "Could not open hub Account.",
          "basis": "guess"
        }
      },
      "convert": {
        "verb": "instant-swap",
        "before": {
          "text": "Swap",
          "basis": "as-is"
        },
        "pending": {
          "text": "Filling swap quote...",
          "basis": "guess"
        },
        "done": {
          "text": "Conversion settled.",
          "basis": "guess"
        },
        "failed": {
          "text": "Quote expired; balances unchanged.",
          "basis": "guess"
        }
      },
      "cover": {
        "verb": "request-cover",
        "before": {
          "text": "Cover it",
          "basis": "as-is"
        },
        "pending": {
          "text": "Asking hub to lock on-chain collateral (fee deducted from amount)...",
          "basis": "guess"
        },
        "done": {
          "text": "99.89 USDC is now locked on the blockchain for your Account; you can withdraw it yourself even if the hub disappears.",
          "basis": "guess"
        },
        "failed": {
          "text": "Hub did not lock collateral; unbacked balance unchanged.",
          "basis": "guess"
        }
      },
      "open-tab": {
        "verb": "extend-peer-tab",
        "before": {
          "text": "Set peer tab limit",
          "basis": "guess"
        },
        "pending": {
          "text": "Co-signing peer tab...",
          "basis": "guess"
        },
        "done": {
          "text": "Peer tab active.",
          "basis": "guess"
        },
        "failed": {
          "text": "Peer rejected tab update.",
          "basis": "guess"
        }
      },
      "save-deposit": {
        "verb": "deposit-savings",
        "before": {
          "text": "Review rate and set maximum unsecured risk",
          "basis": "guess"
        },
        "pending": {
          "text": "Opening savings position...",
          "basis": "guess"
        },
        "done": {
          "text": "Savings position active.",
          "basis": "guess"
        },
        "failed": {
          "text": "Savings offer rejected.",
          "basis": "guess"
        }
      },
      "save-close": {
        "verb": "close-savings",
        "before": {
          "text": "Withdraw savings position",
          "basis": "guess"
        },
        "pending": {
          "text": "Closing position...",
          "basis": "guess"
        },
        "done": {
          "text": "Principal and accrued yield returned to Account.",
          "basis": "guess"
        },
        "failed": {
          "text": "Cooperative close timed out; dispute exit available.",
          "basis": "guess"
        }
      },
      "exit": {
        "verb": "unilateral-exit",
        "before": {
          "text": "Take the last page you both signed to the chain. You never need the other side",
          "basis": "as-is"
        },
        "pending": {
          "text": "On-chain dispute window active...",
          "basis": "guess"
        },
        "done": {
          "text": "Dispute registered on the blockchain; claim funds when timer ends.",
          "basis": "guess"
        },
        "failed": {
          "text": "Chain transaction failed; signed frame remains intact to retry.",
          "basis": "guess"
        }
      },
      "finalize-exit": {
        "verb": "finalize-dispute",
        "before": {
          "text": "Claim settled funds to wallet",
          "basis": "guess"
        },
        "pending": {
          "text": "Finalizing on-chain settlement...",
          "basis": "guess"
        },
        "done": {
          "text": "Funds settled to your blockchain address and contract reserve.",
          "basis": "guess"
        },
        "failed": {
          "text": "Window still open or transaction reverted.",
          "basis": "guess"
        }
      },
      "backup": {
        "verb": "export-backup",
        "before": {
          "text": "Save encrypted recovery file",
          "basis": "guess"
        },
        "pending": {
          "text": "Encrypting recovery bundle...",
          "basis": "guess"
        },
        "done": {
          "text": "Encrypted backup saved",
          "basis": "as-is"
        },
        "failed": {
          "text": "Backup export cancelled.",
          "basis": "guess"
        }
      },
      "reset-retired": {
        "verb": "reset-testnet",
        "before": {
          "text": "Reset retired testnet state and keep keys",
          "basis": "canon"
        },
        "pending": {
          "text": "Clearing obsolete local state...",
          "basis": "guess"
        },
        "done": {
          "text": "Local state reset; signer keys preserved.",
          "basis": "canon"
        },
        "failed": {
          "text": "Reset aborted; stop active runtime first.",
          "basis": "guess"
        }
      }
    },
    "screens": [
      "home",
      "pay",
      "receive",
      "convert",
      "savings",
      "safety",
      "activity",
      "settings"
    ],
    "doors": [
      "place-limit-order",
      "cancel-order",
      "cross-j-swap",
      "move-r2c",
      "move-r2r",
      "move-r2e",
      "rebalance-policy",
      "set-hub-credit",
      "borrow-facility",
      "repay-loan",
      "set-bank-rates",
      "propose-multisig",
      "vote-multisig"
    ]
  },
  "pro": {
    "posture": "operator-desk",
    "entry": "desk",
    "modes": [
      "always",
      "pro-only"
    ],
    "terms": {
      "secured": {
        "text": "Backed by collateral",
        "basis": "as-is",
        "note": "Covered by funds locked on-chain.",
        "noteWhen": "non-zero"
      },
      "unbacked": {
        "text": "Without collateral",
        "basis": "as-is",
        "note": "Repayment depends on the other party.",
        "noteWhen": "non-zero"
      },
      "owed": {
        "text": "Payable liability",
        "basis": "cited-code",
        "note": null,
        "noteWhen": "always"
      },
      "cover": {
        "text": "Cover it",
        "basis": "as-is",
        "note": null,
        "noteWhen": "always"
      },
      "peer-credit": {
        "text": "Peer credit limit",
        "basis": "cited-code",
        "note": null,
        "noteWhen": "always"
      },
      "hub": {
        "text": "Payment hub",
        "basis": "as-is",
        "note": null,
        "noteWhen": "always"
      },
      "exit": {
        "text": "Submit dispute proof",
        "basis": "guess",
        "note": null,
        "noteWhen": "always"
      }
    },
    "autopilots": {},
    "flows": {
      "pro-pay": {
        "verb": "send-routed",
        "before": {
          "text": "Send routed payment",
          "basis": "guess"
        },
        "pending": {
          "text": "Routing HTLC payment...",
          "basis": "guess"
        },
        "done": {
          "text": "Routed payment finalized.",
          "basis": "guess"
        },
        "failed": {
          "text": "Route rejected or expired.",
          "basis": "guess"
        }
      },
      "pro-direct": {
        "verb": "send-direct",
        "before": {
          "text": "Send bilateral payment",
          "basis": "guess"
        },
        "pending": {
          "text": "Submitting direct payment...",
          "basis": "guess"
        },
        "done": {
          "text": "Direct frame committed.",
          "basis": "guess"
        },
        "failed": {
          "text": "Rejected by counterparty.",
          "basis": "guess"
        }
      },
      "pro-open-account": {
        "verb": "open-account",
        "before": {
          "text": "Open bilateral Account",
          "basis": "guess"
        },
        "pending": {
          "text": "Opening bilateral Account...",
          "basis": "guess"
        },
        "done": {
          "text": "Account active.",
          "basis": "guess"
        },
        "failed": {
          "text": "Open rejected.",
          "basis": "guess"
        }
      },
      "pro-cover": {
        "verb": "request-cover",
        "before": {
          "text": "Cover it",
          "basis": "as-is"
        },
        "pending": {
          "text": "Requesting r2c allocation...",
          "basis": "guess"
        },
        "done": {
          "text": "Collateral locked on-chain for Account.",
          "basis": "guess"
        },
        "failed": {
          "text": "Policy mismatch or insufficient reserve.",
          "basis": "guess"
        }
      },
      "pro-instant-swap": {
        "verb": "instant-swap",
        "before": {
          "text": "Take book quote",
          "basis": "guess"
        },
        "pending": {
          "text": "Taking book quote...",
          "basis": "guess"
        },
        "done": {
          "text": "Swap settled.",
          "basis": "guess"
        },
        "failed": {
          "text": "Insufficient capacity or expired quote.",
          "basis": "guess"
        }
      },
      "pro-limit-order": {
        "verb": "place-limit-order",
        "before": {
          "text": "Post resting limit order",
          "basis": "guess"
        },
        "pending": {
          "text": "Posting resting swap offer...",
          "basis": "guess"
        },
        "done": {
          "text": "Order live on book.",
          "basis": "guess"
        },
        "failed": {
          "text": "Order rejected.",
          "basis": "guess"
        }
      },
      "pro-cancel-order": {
        "verb": "cancel-order",
        "before": {
          "text": "Cancel resting order",
          "basis": "guess"
        },
        "pending": {
          "text": "Cancelling swap offer...",
          "basis": "guess"
        },
        "done": {
          "text": "Resting order removed.",
          "basis": "guess"
        },
        "failed": {
          "text": "Order already filled or closed.",
          "basis": "guess"
        }
      },
      "pro-cross-swap": {
        "verb": "cross-j-swap",
        "before": {
          "text": "Execute cross-network order",
          "basis": "guess"
        },
        "pending": {
          "text": "Locking cross-J legs...",
          "basis": "guess"
        },
        "done": {
          "text": "Cross-jurisdiction swap settled.",
          "basis": "guess"
        },
        "failed": {
          "text": "Cross-J leg timed out; salvage/refund safe.",
          "basis": "guess"
        }
      },
      "pro-r2c": {
        "verb": "move-r2c",
        "before": {
          "text": "Allocate reserve to Account",
          "basis": "guess"
        },
        "pending": {
          "text": "Batching r2c J-tx...",
          "basis": "guess"
        },
        "done": {
          "text": "Added to the on-chain batch",
          "basis": "as-is"
        },
        "failed": {
          "text": "Batch aborted.",
          "basis": "guess"
        }
      },
      "pro-r2r": {
        "verb": "move-r2r",
        "before": {
          "text": "Transfer contract reserve",
          "basis": "guess"
        },
        "pending": {
          "text": "Batching r2r J-tx...",
          "basis": "guess"
        },
        "done": {
          "text": "Added to the on-chain batch",
          "basis": "as-is"
        },
        "failed": {
          "text": "Batch aborted.",
          "basis": "guess"
        }
      },
      "pro-r2e": {
        "verb": "move-r2e",
        "before": {
          "text": "Withdraw reserve to wallet",
          "basis": "guess"
        },
        "pending": {
          "text": "Batching r2e withdrawal...",
          "basis": "guess"
        },
        "done": {
          "text": "Added to the on-chain batch",
          "basis": "as-is"
        },
        "failed": {
          "text": "Batch aborted.",
          "basis": "guess"
        }
      },
      "pro-set-credit": {
        "verb": "set-hub-credit",
        "before": {
          "text": "Update bilateral credit limit",
          "basis": "guess"
        },
        "pending": {
          "text": "Updating credit limit...",
          "basis": "guess"
        },
        "done": {
          "text": "Credit limit committed.",
          "basis": "guess"
        },
        "failed": {
          "text": "Rejected.",
          "basis": "guess"
        }
      },
      "pro-rebalance": {
        "verb": "rebalance-policy",
        "before": {
          "text": "Save rebalance policy",
          "basis": "guess"
        },
        "pending": {
          "text": "Saving rebalance policy...",
          "basis": "guess"
        },
        "done": {
          "text": "Rebalance policy active.",
          "basis": "guess"
        },
        "failed": {
          "text": "Rejected.",
          "basis": "guess"
        }
      },
      "pro-set-rates": {
        "verb": "set-bank-rates",
        "before": {
          "text": "Publish bank rate policy",
          "basis": "guess"
        },
        "pending": {
          "text": "Publishing bank rate terms...",
          "basis": "guess"
        },
        "done": {
          "text": "Bank lending terms updated.",
          "basis": "guess"
        },
        "failed": {
          "text": "Rejected.",
          "basis": "guess"
        }
      },
      "pro-borrow": {
        "verb": "borrow-facility",
        "before": {
          "text": "Draw from facility",
          "basis": "guess"
        },
        "pending": {
          "text": "Requesting loan drawdown...",
          "basis": "guess"
        },
        "done": {
          "text": "Loan disbursed.",
          "basis": "guess"
        },
        "failed": {
          "text": "Facility or receive capacity insufficient.",
          "basis": "guess"
        }
      },
      "pro-repay": {
        "verb": "repay-loan",
        "before": {
          "text": "Repay active loan",
          "basis": "guess"
        },
        "pending": {
          "text": "Repaying active loan...",
          "basis": "guess"
        },
        "done": {
          "text": "Loan repaid.",
          "basis": "guess"
        },
        "failed": {
          "text": "Insufficient send capacity.",
          "basis": "guess"
        }
      },
      "pro-lend": {
        "verb": "deposit-savings",
        "before": {
          "text": "Fund lending offer",
          "basis": "guess"
        },
        "pending": {
          "text": "Funding lending position...",
          "basis": "guess"
        },
        "done": {
          "text": "Position funded.",
          "basis": "guess"
        },
        "failed": {
          "text": "Offer rejected.",
          "basis": "guess"
        }
      },
      "pro-close-lend": {
        "verb": "close-savings",
        "before": {
          "text": "Close lending position",
          "basis": "guess"
        },
        "pending": {
          "text": "Closing lending position...",
          "basis": "guess"
        },
        "done": {
          "text": "Position closed.",
          "basis": "guess"
        },
        "failed": {
          "text": "Close timed out.",
          "basis": "guess"
        }
      },
      "pro-dispute": {
        "verb": "unilateral-exit",
        "before": {
          "text": "Submit dispute frame on-chain",
          "basis": "guess"
        },
        "pending": {
          "text": "Dispute active...",
          "basis": "guess"
        },
        "done": {
          "text": "Dispute registered on-chain.",
          "basis": "guess"
        },
        "failed": {
          "text": "Submission failed.",
          "basis": "guess"
        }
      },
      "pro-finalize-dispute": {
        "verb": "finalize-dispute",
        "before": {
          "text": "Finalize dispute settlement",
          "basis": "guess"
        },
        "pending": {
          "text": "Finalizing...",
          "basis": "guess"
        },
        "done": {
          "text": "Dispute finalized to reserves.",
          "basis": "guess"
        },
        "failed": {
          "text": "Challenge window still open.",
          "basis": "guess"
        }
      },
      "pro-propose-board": {
        "verb": "propose-multisig",
        "before": {
          "text": "Propose board update",
          "basis": "guess"
        },
        "pending": {
          "text": "Staging Hanko proposal...",
          "basis": "guess"
        },
        "done": {
          "text": "Proposal awaiting co-signers.",
          "basis": "guess"
        },
        "failed": {
          "text": "Invalid threshold.",
          "basis": "guess"
        }
      },
      "pro-vote-board": {
        "verb": "vote-multisig",
        "before": {
          "text": "Sign or reject proposal",
          "basis": "guess"
        },
        "pending": {
          "text": "Submitting Hanko vote...",
          "basis": "guess"
        },
        "done": {
          "text": "Vote recorded.",
          "basis": "guess"
        },
        "failed": {
          "text": "Proposal expired.",
          "basis": "guess"
        }
      },
      "pro-backup": {
        "verb": "export-backup",
        "before": {
          "text": "Export recovery bundle",
          "basis": "guess"
        },
        "pending": {
          "text": "Exporting state...",
          "basis": "guess"
        },
        "done": {
          "text": "Encrypted backup saved",
          "basis": "as-is"
        },
        "failed": {
          "text": "Export failed.",
          "basis": "guess"
        }
      },
      "pro-reset": {
        "verb": "reset-testnet",
        "before": {
          "text": "Reset retired testnet state",
          "basis": "canon"
        },
        "pending": {
          "text": "Resetting...",
          "basis": "guess"
        },
        "done": {
          "text": "Reset complete; keys kept.",
          "basis": "guess"
        },
        "failed": {
          "text": "Stop active runtime first.",
          "basis": "guess"
        }
      }
    },
    "screens": [
      "desk",
      "book",
      "cross-swap",
      "move",
      "credit-lanes",
      "lending",
      "watchtower",
      "multisig",
      "assets"
    ],
    "doors": []
  }
} as const;

export type SurfaceId = keyof typeof SURFACES;
