"""
Control Pilot: drive IO0_4 on the second PCA9535BS IO expander (A2A1A0 = 001,
address 0x21) as an output, driven high.
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


def _ensure_rpi_gpio_installed():
    """Install RPi.GPIO with pip if it isn't importable yet."""
    try:
        import RPi.GPIO  # noqa: F401
    except ImportError:
        subprocess.run([sys.executable, "-m", "pip", "install", "RPi.GPIO"], check=True)


_ensure_i2c_enabled()
_ensure_smbus2_installed()
_ensure_rpi_gpio_installed()

import RPi.GPIO as GPIO
from smbus2 import SMBus

from ADS1015 import ADS1015_ADDRESS, read_all_voltages

# PCA9535 register addresses
REG_OUTPUT_PORT0 = 0x02
REG_CONFIG_PORT0 = 0x06

# I2C address for the second expander (A2A1A0 = 001)
CONTROL_PILOT_ADDRESS = 0x21

# I2C bus 1 uses GPIO2 (SDA) and GPIO3 (SCL) on the Raspberry Pi
I2C_BUS = 1

# IO0_4 is Port0 bit 4
IO0_4_MASK = 1 << 4

# Raspberry Pi GPIO25 (BCM numbering) is driven high
GPIO25_PIN = 25

# The ADC readings on AIN0/AIN1 come out attenuated; divide by this factor
# to recover the actual voltage
VOLTAGE_CORRECTION_FACTOR = 0.081


def set_io0_4_output_high(bus, address, pin_mask):
    """Switch the masked Port0 pins to output and drive them high."""
    bus.write_byte_data(address, REG_OUTPUT_PORT0, pin_mask)
    config = bus.read_byte_data(address, REG_CONFIG_PORT0)
    bus.write_byte_data(address, REG_CONFIG_PORT0, config & ~pin_mask)


def set_gpio25_output_high():
    """Configure Raspberry Pi GPIO25 as output and drive it high."""
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(GPIO25_PIN, GPIO.OUT)
    GPIO.output(GPIO25_PIN, GPIO.HIGH)


def set_gpio25(level):
    """Drive GPIO25 to the given boolean level (already configured as output)."""
    GPIO.output(GPIO25_PIN, GPIO.HIGH if level else GPIO.LOW)


def read_ain0_ain1(bus):
    """Read AIN0/AIN1 and apply the attenuation correction factor."""
    ain0, ain1 = read_all_voltages(bus)[:2]
    return ain0 / VOLTAGE_CORRECTION_FACTOR, ain1 / VOLTAGE_CORRECTION_FACTOR


def main():
    with SMBus(I2C_BUS) as bus:
        set_io0_4_output_high(bus, CONTROL_PILOT_ADDRESS, IO0_4_MASK)
        print(
            f"PCA9535 @ 0x{CONTROL_PILOT_ADDRESS:02X}: IO0_4 set as output, driven high"
        )

        set_gpio25_output_high()
        print(f"Raspberry Pi GPIO{GPIO25_PIN}: set as output, driven high")

        for cycle in range(1, 6):
            ain0, ain1 = read_ain0_ain1(bus)
            print(f"Cycle {cycle} - GPIO{GPIO25_PIN} HIGH: AIN0={ain0:.4f} V, AIN1={ain1:.4f} V")

            set_gpio25(False)
            ain0, ain1 = read_ain0_ain1(bus)
            print(f"Cycle {cycle} - GPIO{GPIO25_PIN} LOW:  AIN0={ain0:.4f} V, AIN1={ain1:.4f} V")

            set_gpio25(True)


if __name__ == "__main__":
    main()
