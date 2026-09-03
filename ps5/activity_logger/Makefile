PS5_PAYLOAD_SDK ?= /opt/ps5-payload-sdk

# sqlite3.c/.h are NOT bundled with ps5-payload-sdk.
# SQLite 3.45.0 was released in 2024, so use the 2024 release path:
#   curl -sSL -o sqlite.zip https://sqlite.org/2024/sqlite-amalgamation-3450000.zip
#   unzip -o sqlite.zip && cp sqlite-amalgamation-*/sqlite3.{c,h} .

TARGET := savestate-activity.elf
SRCS := main.c sqlite3.c

include $(PS5_PAYLOAD_SDK)/toolchain/prospero.mk

CFLAGS += -O2 -Wall -Wextra -I. -I$(PS5_PAYLOAD_SDK)/include

# sceHttp2 + its dependencies.
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
