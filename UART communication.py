"""Enable Raspberry Pi UART on GPIO14/15 and print received serial data."""

import os
import select
import shutil
import subprocess
import termios
import tty


UART_DEVICE = "/dev/ttyAMA0"
UART_CONFIG = "/boot/firmware/config.txt"
BAUD_RATE = termios.B115200


def verify_uart0_configuration():
    """Require the Pi 5 overlay that routes UART0 to GPIO14/15."""
    try:
        with open(UART_CONFIG, encoding="utf-8") as config_file:
            overlays = [
                line.split("#", 1)[0].strip()
                for line in config_file
            ]
    except OSError as error:
        raise SystemExit(f"Cannot read {UART_CONFIG}: {error}") from error

    if not any(
        line == "dtoverlay=uart0-pi5" or line.startswith("dtoverlay=uart0-pi5,")
        for line in overlays
    ):
        raise SystemExit(
            f"UART0 overlay is missing from {UART_CONFIG}. Add "
            "'dtoverlay=uart0-pi5' and reboot the Raspberry Pi."
        )


def read_uart():
    """Read and display incoming UART bytes at 115200 baud."""
    if not os.path.exists(UART_DEVICE):
        raise SystemExit(
          
            f"{UART_DEVICE} is missing. Enable UART in raspi-config and reboot."
        )

    print(f"UART device: {UART_DEVICE} -> {os.path.realpath(UART_DEVICE)}")
    if shutil.which("fuser"):
        users = subprocess.run(
            ["fuser", "-v", UART_DEVICE], capture_output=True, text=True
        )
        if users.returncode == 0:
            details = (users.stdout + users.stderr).strip()
            raise SystemExit(
                f"{UART_DEVICE} is already in use; stop the other reader first.\n"
                f"{details}"
            )

    try:
        descriptor = os.open(UART_DEVICE, os.O_RDWR | os.O_NOCTTY)
    except OSError as error:
        raise SystemExit(
            f"Cannot open {UART_DEVICE}: {error}. If UART was just enabled, "
            "reboot the Raspberry Pi and run this script again."
        ) from error

    try:
        tty.setraw(descriptor)
        settings = termios.tcgetattr(descriptor)
        settings[2] |= termios.CLOCAL | termios.CREAD
        settings[4] = BAUD_RATE
        settings[5] = BAUD_RATE
        settings[6][termios.VMIN] = 1
        settings[6][termios.VTIME] = 0
        termios.tcsetattr(descriptor, termios.TCSANOW, settings)

        print(f"Listening on {UART_DEVICE} at 115200 baud. Press Ctrl+C to stop.")
        warned_no_data = False
        while True:
            readable, _, _ = select.select([descriptor], [], [], 10)
            if not readable:
                if not warned_no_data:
                    print(
                        "No bytes received in 10 seconds. Check TX -> GPIO15/pin 10, "
                        "shared ground, 3.3V logic, baud rate, and reboot after "
                        "enabling UART. Still listening...",
                        flush=True,
                    )
                    warned_no_data = True
                continue
            data = os.read(descriptor, 256)
            print(
                f"[RX {len(data)} bytes] {data!r} (hex: {data.hex(' ')})",
                flush=True,
            )
    except KeyboardInterrupt:
        print("\nUART reading stopped.")
    finally:
        os.close(descriptor)


def main():
    verify_uart0_configuration()
    read_uart()


if __name__ == "__main__":
    main()



    # python3 spinel-cli.py -u /dev/ttyAMA0 -b 115200