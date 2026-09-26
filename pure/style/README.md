# xln.ts style gate

`bun style/check.ts` (from `pure/`) scans `xln.ts` with the ast-grep rules in `style/rules/` and fails if any rule's hit count rises above `style/baseline.json`. After a refactor lowers a count, `bun style/check.ts --update` ratchets the baseline down.

The rules encode the rewrite's pure style: lines of at most 100 characters (`long-line`), no `let`, no loops, no in-place mutation (`push`, `set`, `delete`, member assignment, `++`), no `throw`, no classes. The original 2.5k-line rewrite (f3ca37c) scored 164 hits, mostly in its byte and hex codecs. The equivalence port raised that to 1198; the baseline records that starting point so the count can only go down.
