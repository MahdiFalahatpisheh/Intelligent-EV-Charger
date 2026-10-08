"""Exercise IO0_4 on the second PCA9535BS expander and GPIO25 PWM."""

import os
import subprocess
import sys
import time


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

# PCA9535 register addresses
REG_OUTPUT_PORT0 = 0x02
REG_CONFIG_PORT0 = 0x06

# I2C address for the second expander (A2A1A0 = 001)
CONTROL_PILOT_ADDRESS = 0x21

# I2C bus 1 uses GPIO2 (SDA) and GPIO3 (SCL) on the Raspberry Pi
I2C_BUS = 1

# IO0_4 is Port0 bit 4
IO0_4_MASK = 1 << 4

# Raspberry Pi GPIO25 (BCM numbering)
GPIO25_PIN = 25

IO0_4_STEP_TIME_S = 3
GPIO25_PWM_FREQUENCY_HZ = 1000
GPIO25_PWM_DUTY_CYCLE = 50
GPIO25_PWM_DURATION_S = 10


def set_io0_4_output_low(bus, address, pin_mask):
    """Configure the masked Port0 pins as outputs, initially driven low."""
    output = bus.read_byte_data(address, REG_OUTPUT_PORT0)
    bus.write_byte_data(address, REG_OUTPUT_PORT0, output & ~pin_mask)
    config = bus.read_byte_data(address, REG_CONFIG_PORT0)
    bus.write_byte_data(address, REG_CONFIG_PORT0, config & ~pin_mask)


def set_io0_4_level(bus, address, pin_mask, high):
    """Set the masked Port0 pins without changing the other output bits."""
    output = bus.read_byte_data(address, REG_OUTPUT_PORT0)
    if high:
        output |= pin_mask
    else:
        output &= ~pin_mask
    bus.write_byte_data(address, REG_OUTPUT_PORT0, output)


def main():
    with SMBus(I2C_BUS) as bus:
        set_io0_4_output_low(bus, CONTROL_PILOT_ADDRESS, IO0_4_MASK)
        print(f"PCA9535 @ 0x{CONTROL_PILOT_ADDRESS:02X}: IO0_4 output LOW")
        time.sleep(IO0_4_STEP_TIME_S)

        set_io0_4_level(bus, CONTROL_PILOT_ADDRESS, IO0_4_MASK, True)
        print("IO0_4 HIGH")
        time.sleep(IO0_4_STEP_TIME_S)

        set_io0_4_level(bus, CONTROL_PILOT_ADDRESS, IO0_4_MASK, False)
        print("IO0_4 LOW")
        time.sleep(IO0_4_STEP_TIME_S)

        set_io0_4_level(bus, CONTROL_PILOT_ADDRESS, IO0_4_MASK, True)
        print("IO0_4 HIGH")

    GPIO.setmode(GPIO.BCM)
    GPIO.setup(GPIO25_PIN, GPIO.OUT)
    pwm = GPIO.PWM(GPIO25_PIN, GPIO25_PWM_FREQUENCY_HZ)
    try:
        pwm.start(GPIO25_PWM_DUTY_CYCLE)
        print(
            f"GPIO{GPIO25_PIN}: {GPIO25_PWM_FREQUENCY_HZ} Hz PWM, "
            f"{GPIO25_PWM_DUTY_CYCLE}% duty cycle for {GPIO25_PWM_DURATION_S} seconds"
        )
        time.sleep(GPIO25_PWM_DURATION_S)
    finally:
        pwm.stop()
        GPIO.cleanup(GPIO25_PIN)


if __name__ == "__main__":
    main()
