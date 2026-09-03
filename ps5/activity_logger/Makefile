PS5_PAYLOAD_SDK ?= /opt/ps5-payload-sdk

# sqlite3.c/.h are NOT bundled with ps5-payload-sdk (verified against the
# SDK source tree) -- vendor the amalgamation next to this Makefile first:
#   curl -sSL -o sqlite.zip https://sqlite.org/2025/sqlite-amalgamation-3450000.zip
#   unzip -o sqlite.zip && cp sqlite-amalgamation-*/sqlite3.{c,h} .
TARGET := savestate-activity.elf
SRCS := main.c sqlite3.c

# Real include path confirmed against the SDK's own samples (samples/http2_get),
# not Makefile.inc, which does not exist in the installed SDK tree.
include $(PS5_PAYLOAD_SDK)/toolchain/prospero.mk

CFLAGS += -O2 -Wall -Wextra -I. -I$(PS5_PAYLOAD_SDK)/include
# sceHttp2 + its dependencies (sceSsl, sceNet) -- verified symbol names
# against sce_stubs/libSceHttp2.c in the SDK. sqlite3.c compiled directly
# into the payload rather than a system -lsqlite3, since the SDK provides
# no sqlite3 of its own.
LDLIBS += -lSceNet -lSceSsl -lSceHttp2

all: $(TARGET)

$(TARGET): $(SRCS)
	@if [ ! -f sqlite3.c ] || [ ! -f sqlite3.h ]; then \
		echo "Missing sqlite3.c/sqlite3.h -- see comment at top of this Makefile."; \
		exit 1; \
	fi
	$(CC) $(CFLAGS) -o $@ $(SRCS) $(LDFLAGS) $(LDLIBS)

clean:
	rm -f $(TARGET) *.o
