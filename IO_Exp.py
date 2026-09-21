"""
Configure three PCA9535BS I2C IO expanders as all-input on a Raspberry Pi.

Wiring:
    Pi GPIO2 (physical pin 3)  -> SDA (external pull-up to 3.3V)
    Pi GPIO3 (physical pin 5)  -> SCL (external pull-up to 3.3V)

Per the PCA9535 datasheet, the 7-bit I2C address is fixed bits 0100 followed
by the three hardware address pins A2 A1 A0, so the base address is 0x20:
    A2 A1 A0 = 000 -> 0x20
    A2 A1 A0 = 001 -> 0x21
    A2 A1 A0 = 010 -> 0x22

On first run this script enables the Pi's I2C interface (raspi-config) and
installs the smbus2 package if it is missing, then continues automatically.
"""

import os
import subprocess
import sys


def _ensure_i2c_enabled():
    """Enable the I2C interface and make sure /dev/i2c-1 is actually present."""
    subprocess.run(["sudo", "raspi-config", "nonint", "do_i2c", "0"], check=True)
    if os.path.exists("/dev/i2c-1"):
        return

    # The overlay was just enabled in /boot/config.txt but not loaded yet;
    # try loading the kernel modules without requiring a reboot.
    subprocess.run(["sudo", "modprobe", "i2c-dev"], check=False)
    subprocess.run(["sudo", "modprobe", "i2c-bcm2835"], check=False)

    if not os.path.exists("/dev/i2c-1"):
        sys.exit(
            "I2C was just enabled but /dev/i2c-1 is still missing. "
            "Reboot the Raspberry Pi (sudo reboot) and run this script again."
        )


def _ensure_smbus2_installed():
    """Install smbus2 with pip if it isn't importable yet."""
    try:
        import smbus2  # noqa: F401
    except ImportError:
        subprocess.run([sys.executable, "-m", "pip", "install", "smbus2"], check=True)


_ensure_i2c_enabled()
_ensure_smbus2_installed()

from smbus2 import SMBus

# PCA9535 register addresses
REG_INPUT_PORT0 = 0x00
REG_INPUT_PORT1 = 0x01
REG_OUTPUT_PORT1 = 0x03
REG_CONFIG_PORT0 = 0x04
REG_CONFIG_PORT1 = 0x05

# All bits = 1 configures each port fully as input
ALL_INPUT = 0xFF

# I2C addresses for A2A1A0 = 000, 001, 010
EXPANDER_ADDRESSES = [0x20, 0x21, 0x22]

# Port1 pins 5 and 6 on the first expander are driven high as outputs
OUTPUT_PINS_MASK = (1 << 5) | (1 << 6)

# I2C bus 1 uses GPIO2 (SDA) and GPIO3 (SCL) on the Raspberry Pi
I2C_BUS = 1


def configure_as_input(bus, address):
    """Set both ports of a PCA9535 at the given address to all-input."""
    bus.write_byte_data(address, REG_CONFIG_PORT0, ALL_INPUT)
    bus.write_byte_data(address, REG_CONFIG_PORT1, ALL_INPUT)


def read_inputs(bus, address):
    """Read the current state of both input ports."""
    port0 = bus.read_byte_data(address, REG_INPUT_PORT0)
    port1 = bus.read_byte_data(address, REG_INPUT_PORT1)
    return port0, port1


def set_port1_pins_output_high(bus, address, pin_mask):
    """Switch the masked Port1 pins to output and drive them high."""
    bus.write_byte_data(address, REG_OUTPUT_PORT1, pin_mask)
    config = bus.read_byte_data(address, REG_CONFIG_PORT1)
    bus.write_byte_data(address, REG_CONFIG_PORT1, config & ~pin_mask)


def main():
    with SMBus(I2C_BUS) as bus:
        for address in EXPANDER_ADDRESSES:
            configure_as_input(bus, address)
            port0, port1 = read_inputs(bus, address)
            print(
                f"PCA9535 @ 0x{address:02X}: configured as input "
                f"(Port0=0b{port0:08b}, Port1=0b{port1:08b})"
            )

        first_address = EXPANDER_ADDRESSES[0]
        set_port1_pins_output_high(bus, first_address, OUTPUT_PINS_MASK)
        print(
            f"PCA9535 @ 0x{first_address:02X}: Port1 pins 5 and 6 set as output, driven high"
        )


if __name__ == "__main__":
    main()