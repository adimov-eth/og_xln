Bun v1.4.0 ([`34cbb9a`](<https://github.com/oven-sh/bun/tree/34cbb9a40b4bd1bd767d134a7065e66c2432a676>)) on macos aarch64 [AutoCommand]

Segmentation fault at address 0x2F091EB168038

- [`BlockDirectory.h:107`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/JavaScriptCore/heap/BlockDirectory.h#L107>): `bitvectorLock`
- [`MarkedBlock.cpp:291`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/JavaScriptCore/heap/MarkedBlock.cpp#L291>): `JSC::MarkedBlock::aboutToMarkSlow`
- [`MarkedBlock.h:598`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/JavaScriptCore/heap/MarkedBlock.h#L598>): `aboutToMark`
- [`SlotVisitorInlines.h:101`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/JavaScriptCore/heap/SlotVisitorInlines.h#L101>): `appendHiddenUnbarriered`
- [`SlotVisitorInlines.h:84`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/JavaScriptCore/heap/SlotVisitorInlines.h#L84>): `appendHiddenUnbarriered`
- [`SlotVisitorInlines.h:124`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/JavaScriptCore/heap/SlotVisitorInlines.h#L124>): `appendHidden<JSC::Unknown, WTF::RawValueTraits<JSC::Unknown> >`
- [`SlotVisitorInlines.h:159`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/JavaScriptCore/heap/SlotVisitorInlines.h#L159>): `appendValuesHidden`
- [`JSObject.cpp:500`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/JavaScriptCore/runtime/JSObject.cpp#L500>): `visitChildrenImpl<JSC::SlotVisitor>`
- [`JSObject.cpp:504`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/JavaScriptCore/runtime/JSObject.cpp#L504>): `JSC::JSFinalObject::visitChildren`
- [`SlotVisitor.cpp:375`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/JavaScriptCore/heap/SlotVisitor.cpp#L375>): `visitChildren`
- [`SlotVisitor.cpp:519`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/JavaScriptCore/heap/SlotVisitor.cpp#L519>): `JSC::SlotVisitor::drain(...)::$_0::operator()(...) const`
- [`SlotVisitorInlines.h:200`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/JavaScriptCore/heap/SlotVisitorInlines.h#L200>): `forEachMarkStack<(...)>`
- [`SlotVisitor.cpp:496`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/JavaScriptCore/heap/SlotVisitor.cpp#L496>): `JSC::SlotVisitor::drain`
- [`SlotVisitor.cpp:716`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/JavaScriptCore/heap/SlotVisitor.cpp#L716>): `JSC::SlotVisitor::drainFromShared`
- [`SlotVisitor.cpp:726`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/JavaScriptCore/heap/SlotVisitor.cpp#L726>): `drainInParallel`
- [`Heap.cpp:1689`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/JavaScriptCore/heap/Heap.cpp#L1689>): `JSC::Heap::runFixpointPhase`
- [`Heap.cpp:1487`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/JavaScriptCore/heap/Heap.cpp#L1487>): `JSC::Heap::runCurrentPhase`
- [`Heap.cpp:2135`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/JavaScriptCore/heap/Heap.cpp#L2135>): `operator`
- [`ScopedLambda.h:106`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/WTF/wtf/ScopedLambda.h#L106>): `WTF::ScopedLambdaFunctor<void (...), JSC::Heap::collectInMutatorThread()::$_0>::implFunction`
- [`ScopedLambda.h:58`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/WTF/wtf/ScopedLambda.h#L58>): `operator(...)<JSC::CurrentThreadState &>`
- [`MachineStackMarker.cpp:235`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/JavaScriptCore/heap/MachineStackMarker.cpp#L235>): `JSC::callWithCurrentThreadState`
- [`Heap.cpp:2147`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/JavaScriptCore/heap/Heap.cpp#L2147>): `JSC::Heap::collectInMutatorThread`
- [`Heap.cpp:2116`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/JavaScriptCore/heap/Heap.cpp#L2116>): `stopIfNecessarySlow`
- [`Heap.cpp:2173`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/JavaScriptCore/heap/Heap.cpp#L2173>): `waitForCollector<(...)>`
- [`Heap.cpp:3359`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/JavaScriptCore/heap/Heap.cpp#L3359>): `JSC::Heap::preventCollection`
- [`PreventCollectionScope.h:37`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/JavaScriptCore/heap/PreventCollectionScope.h#L37>): `PreventCollectionScope`
- [`PreventCollectionScope.h:36`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/JavaScriptCore/heap/PreventCollectionScope.h#L36>): `PreventCollectionScope`
- [`Heap.cpp:1133`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/JavaScriptCore/heap/Heap.cpp#L1133>): `JSC::Heap::deleteAllCodeBlocks`
- [`VM.cpp:1067`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/JavaScriptCore/runtime/VM.cpp#L1067>): `operator`
- [`Function.h:59`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/WTF/wtf/Function.h#L59>): `WTF::Detail::CallableWrapper<JSC::VM::deleteAllCode(...)::$_0, void>::call() `
- [`Function.h:103`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/WTF/wtf/Function.h#L103>): `operator`
- [`VM.cpp:1040`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/JavaScriptCore/runtime/VM.cpp#L1040>): `whenIdle`
- [`VM.cpp:1056`](<https://github.com/oven-sh/WebKit/blob/bun-34cbb9a40b4bd1bd767d134a7065e66c2432a676/Source/JavaScriptCore/runtime/VM.cpp#L1056>): `JSC::VM::deleteAllCode`
- [`ZigGlobalObject.cpp:4391`](<https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/jsc/bindings/ZigGlobalObject.cpp#L4391>): `WebWorker__teardownJSCVM`
- [`VirtualMachine.rs:1894`](<https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/jsc/VirtualMachine.rs#L1894>): `<bun_jsc::virtual_machine::VirtualMachine>::teardown `
- [`web_worker.rs:1043`](<https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/jsc/web_worker.rs#L1043>): `<bun_jsc::web_worker::WebWorker>::shutdown`
- [`web_worker.rs:0`](<https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/jsc/web_worker.rs#L0>): `spin`
- [`web_worker.rs:665`](<https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/jsc/web_worker.rs#L665>): `thread_main`
- [`web_worker.rs:474`](<https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/jsc/web_worker.rs#L474>): `{closure#2}`
- [`backtrace.rs:166`](<https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/rust/library/std/src/sys/backtrace.rs#L166>): `__rust_begin_short_backtrace<bun_jsc::web_worker::{impl#1}::create::{closure_env#2}, (...)>`
- [`lifecycle.rs:70`](<https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/rust/library/std/src/thread/lifecycle.rs#L70>): `{closure#0}<bun_jsc::web_worker::{impl#1}::create::{closure_env#2}, (...)>`
- [`unwind_safe.rs:275`](<https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/rust/library/core/src/panic/unwind_safe.rs#L275>): `call_once<(), std::thread::lifecycle::spawn_unchecked::{closure#1}::{closure_env#0}<bun_jsc::web_worker::{impl#1}::create::{closure_env#2}, (...)>>`
- [`panicking.rs:576`](<https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/rust/library/std/src/panicking.rs#L576>): `do_call<core::panic::unwind_safe::AssertUnwindSafe<std::thread::lifecycle::spawn_unchecked::{closure#1}::{closure_env#0}<bun_jsc::web_worker::{impl#1}::create::{closure_env#2}, ()>>, (...)>`
- [`panicking.rs:544`](<https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/rust/library/std/src/panicking.rs#L544>): `catch_unwind<(), core::panic::unwind_safe::AssertUnwindSafe<std::thread::lifecycle::spawn_unchecked::{closure#1}::{closure_env#0}<bun_jsc::web_worker::{impl#1}::create::{closure_env#2}, (...)>>>`
- [`panic.rs:359`](<https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/rust/library/std/src/panic.rs#L359>): `catch_unwind<core::panic::unwind_safe::AssertUnwindSafe<std::thread::lifecycle::spawn_unchecked::{closure#1}::{closure_env#0}<bun_jsc::web_worker::{impl#1}::create::{closure_env#2}, ()>>, (...)>`
- [`lifecycle.rs:68`](<https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/rust/library/std/src/thread/lifecycle.rs#L68>): `{closure#1}<bun_jsc::web_worker::{impl#1}::create::{closure_env#2}, (...)>`
- [`function.rs:250`](<https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/rust/library/core/src/ops/function.rs#L250>): `<std::thread::lifecycle::spawn_unchecked<<bun_jsc::web_worker::WebWorker>::create::{closure#2}, ()>::{closure#1} as core::ops::function::FnOnce<(...)>>::call_once::{shim:vtable#0}`
- [`boxed.rs:2321`](<https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/rust/library/alloc/src/boxed.rs#L2321>): `call_once<(), (...), alloc::alloc::Global>`
- [`unix.rs:123`](<https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/rust/library/std/src/sys/thread/unix.rs#L123>): `<std::sys::thread::unix::Thread>::new::thread_start`

Features: transpiler\_cache, tsconfig, tsconfig\_paths, workers\_spawned, workers\_terminated, napi\_module\_register, process\_dlopen, Bun.stderr, WebSocket, fetch, http\_server, jsc
