"""
Read all 4 single-ended input voltages from an ADS1015IDGS ADC on a
Raspberry Pi, sharing the same I2C bus as the PCA9535 IO expanders
(GPIO2/SDA, GPIO3/SCL).

ADDR pin tied to GND gives I2C address 0x48 (GND=0x48, VDD=0x49, SDA=0x4A,
SCL=0x4B) — update ADS1015_ADDRESS below to match the actual wiring.
"""

import time

from smbus2 import SMBus

# ADS1015 register addresses
REG_CONVERSION = 0x00
REG_CONFIG = 0x01

# ADS1015 I2C address (ADDR pin -> GND)
ADS1015_ADDRESS = 0x48

# I2C bus 1 uses GPIO2 (SDA) and GPIO3 (SCL) on the Raspberry Pi
I2C_BUS = 1

# MUX bits (config[14:12]) for single-ended reads AIN0..AIN3
CHANNEL_MUX = [0x04, 0x05, 0x06, 0x07]

# PGA = +/-2.048 V (config[11:9] = 011), giving a 12-bit LSB of 1 mV
PGA_FSR_VOLTS = 2.048
LSB_VOLTS = PGA_FSR_VOLTS / 2048

# Config register bits that stay constant across reads:
# single-shot mode, 1600 SPS data rate, comparator disabled
BASE_CONFIG = (
    (0x1 << 8)  # MODE = single-shot
    | (0x3 << 9)  # PGA = +/-2.048 V
    | (0x4 << 5)  # DR = 1600 SPS
    | 0x0003  # COMP_QUE = disable comparator
)

CONVERSION_TIME_S = 0.001  # >1 sample period at 1600 SPS


def _read_channel_raw(bus, channel):
    """Trigger a single-shot conversion on the given channel and return the raw 12-bit value."""
    config = 0x8000 | (CHANNEL_MUX[channel] << 12) | BASE_CONFIG
    bus.write_i2c_block_data(ADS1015_ADDRESS, REG_CONFIG, [(config >> 8) & 0xFF, config & 0xFF])

    time.sleep(CONVERSION_TIME_S)

    data = bus.read_i2c_block_data(ADS1015_ADDRESS, REG_CONVERSION, 2)
    raw = ((data[0] << 8) | data[1]) >> 4  # top 12 bits hold the result
    if raw & 0x800:  # sign-extend a negative 12-bit reading
        raw -= 1 << 12
    return raw


def read_all_voltages(bus):
    """Return a list of the 4 single-ended input voltages [AIN0, AIN1, AIN2, AIN3]."""
    return [_read_channel_raw(bus, channel) * LSB_VOLTS for channel in range(4)]


def main():
    with SMBus(I2C_BUS) as bus:
        voltages = read_all_voltages(bus)
        for channel, voltage in enumerate(voltages):
            print(f"ADS1015 @ 0x{ADS1015_ADDRESS:02X} AIN{channel}: {voltage:.4f} V")


if __name__ == "__main__":
    main()
