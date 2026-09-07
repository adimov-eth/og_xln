# Experimental library; reuse the exact shipped host, including full wipe.
.PHONY: all
VARIANT ?= lookahead
DISTANCE ?= 1
all: build/argon2.metallib build/brainvault-argon2-metal
build:
	mkdir -p build
build/argon2.air: $(VARIANT).metal ../metal/argon2.metal | build
	xcrun metal -O3 -DLOOKAHEAD_DISTANCE=$(DISTANCE) -mmacosx-version-min=11.0 -c $(VARIANT).metal -o $@
build/argon2.metallib: build/argon2.air
	xcrun metallib $< -o $@
build/brainvault-argon2-metal: ../../prebuilds/darwin-arm64/brainvault-argon2-metal table-host.m | build
ifeq ($(VARIANT),table)
	clang -std=c11 -O3 -flto -mcpu=apple-m1 -mmacosx-version-min=11.0 -fobjc-arc -D_DARWIN_C_SOURCE -D__SSE2__ -I../c/compat -I../c/vendor/sse2neon -I../c/vendor/argon2/include -I../c/vendor/argon2/src table-host.m ../c/vendor/argon2/src/argon2.c ../c/vendor/argon2/src/core.c ../c/vendor/argon2/src/blake2/blake2b.c ../c/vendor/argon2/src/thread.c ../c/vendor/argon2/src/encoding.c ../c/vendor/argon2/src/opt.c -framework Foundation -framework Metal -pthread -o $@
else
	cp $< $@
endif
