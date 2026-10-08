"""
WISUN: drive IO1_6 on the second PCA9535BS IO expander (A2A1A0 = 001,
address 0x21) as an output, driven low. This pin enables WISUN power.
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
REG_OUTPUT_PORT0 = 0x02
REG_CONFIG_PORT0 = 0x06
REG_OUTPUT_PORT1 = 0x03
REG_CONFIG_PORT1 = 0x07

# I2C address for the first expander (A2A1A0 = 000)
FIRST_EXPANDER_ADDRESS = 0x20

# I2C address for the second expander (A2A1A0 = 001)
WISUN_ADDRESS = 0x21

# I2C bus 1 uses GPIO2 (SDA) and GPIO3 (SCL) on the Raspberry Pi
I2C_BUS = 1

# IO0_2 is Port0 bit 2 on the first expander
IO0_2_MASK = 1 << 2

# IO1_6 is Port1 bit 6, and enables WISUN power
IO1_6_MASK = 1 << 6



wisun_on =0

print(wisun_on)

def set_io0_2_output_high(bus, address, pin_mask):
    """Configure IO0_2 as an output and drive it high."""
    bus.write_byte_data(address, REG_OUTPUT_PORT0, pin_mask)
    config = bus.read_byte_data(address, REG_CONFIG_PORT0)
    bus.write_byte_data(address, REG_CONFIG_PORT0, config & ~pin_mask)


def set_io1_6_output_low(bus, address, pin_mask):
    """Switch the masked Port1 pins to output and drive them low."""
    bus.write_byte_data(address, REG_OUTPUT_PORT1, 0x00)
    config = bus.read_byte_data(address, REG_CONFIG_PORT1)
    bus.write_byte_data(address, REG_CONFIG_PORT1, config & ~pin_mask)



def set_io0_2_output_low(bus, address, pin_mask):
    """Configure IO0_2 as an output and drive it low."""
    output = bus.read_byte_data(address, REG_OUTPUT_PORT0)
    bus.write_byte_data(address, REG_OUTPUT_PORT0, output & ~pin_mask)
    config = bus.read_byte_data(address, REG_CONFIG_PORT0)
    bus.write_byte_data(address, REG_CONFIG_PORT0, config & ~pin_mask)


def set_io1_6_output_high(bus, address, pin_mask):
    """Switch the masked Port1 pins to output and drive them high."""
    output = bus.read_byte_data(address, REG_OUTPUT_PORT1)
    bus.write_byte_data(address, REG_OUTPUT_PORT1, output | pin_mask)
    config = bus.read_byte_data(address, REG_CONFIG_PORT1)
    bus.write_byte_data(address, REG_CONFIG_PORT1, config & ~pin_mask)



def main():
    with SMBus(I2C_BUS) as bus:

        if (wisun_on==0):
         print("WISUN is turned off") 
         set_io0_2_output_high(bus, FIRST_EXPANDER_ADDRESS, IO0_2_MASK)
         set_io1_6_output_low(bus, WISUN_ADDRESS, IO1_6_MASK)
        else:
         print("WISUN is turned on")
         set_io0_2_output_low(bus, FIRST_EXPANDER_ADDRESS, IO0_2_MASK)
         set_io1_6_output_high(bus, WISUN_ADDRESS, IO1_6_MASK)


if __name__ == "__main__":
    main()


