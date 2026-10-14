# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Intelligent EV Charger — Python hardware-bring-up scripts for an EV charger controller board driven by a Raspberry Pi 5. Each top-level `.py` file is a standalone script that exercises one subsystem of the board. There is no package structure, build step, test suite, or linter config.

## Running

Scripts only work on the Raspberry Pi with the board attached (they need `/dev/i2c-1`, `/dev/ttyAMA0`, `RPi.GPIO`). They cannot be run or meaningfully tested on the Windows dev machine.

```sh
python3 IO_Exp.py                 # configure the 3 PCA9535 expanders as inputs, drive 0x20 Port1 pins 5/6 high
python3 ADS1015.py                # one-shot read of AIN0..AIN3 + TMP235 temperature
python3 ADS1015.py --gpio 25 --edge rising   # read AIN0/AIN1 on each GPIO edge
python3 Control_Pilot.py          # toggle IO0_4 on 0x21, then 1 kHz PWM on GPIO25 while sampling AIN0/AIN1
python3 WISUN.py                  # switch Wi-SUN module power (set `wisun_on` in the file: 0 = off, 1 = on)
python3 "UART communication.py"   # dump raw bytes received on UART0 (GPIO14/15) at 115200
python3 spinel-cli.py -u /dev/ttyAMA0 -b 115200   # talk to the Wi-SUN module (spinel-cli is not in this repo)
```

Dependencies: `smbus2`, `RPi.GPIO`. `IO_Exp.py`, `Control_Pilot.py` and `WISUN.py` auto-run `sudo raspi-config nonint do_i2c 0`, `modprobe`, and `pip install` at import time.

## Hardware architecture

All I2C devices share bus 1 (GPIO2 SDA / GPIO3 SCL):

| Addr | Device | Used for |
|------|--------|----------|
| 0x20 | PCA9535 #1 (A2A1A0=000) | Port1 bits 5/6 outputs (`IO_Exp.py`); IO0_2 is part of the Wi-SUN power sequence (`WISUN.py`) |
| 0x21 | PCA9535 #2 (A2A1A0=001) | IO0_4 = Control Pilot control; IO1_6 = Wi-SUN power enable |
| 0x22 | PCA9535 #3 (A2A1A0=010) | inputs only |
| 0x48 | ADS1015 ADC (ADDR→GND) | AIN0/AIN1 = Control Pilot sensing, AIN2 = TMP235A2 temp sensor |

- GPIO25 (BCM) produces the Control Pilot PWM (1 kHz, per IEC 61851 convention).
- UART0 on GPIO14/15 (`/dev/ttyAMA0`) connects to the Wi-SUN module; requires `dtoverlay=uart0-pi5` in `/boot/firmware/config.txt`.
- ADS1015 is configured for ±2.048 V PGA (1 mV/LSB), single-shot 1600 SPS; each reading discards one sample after a mux switch and averages 8.

## Code conventions and gotchas

- `ADS1015.py` is the only module imported by another (`Control_Pilot.py` imports `read_ain0_and_ain1`). It intentionally has no import-time side effects; keep it that way. The other scripts run their setup helpers at import, so don't import them from elsewhere.
- The `_ensure_i2c_enabled` / `_ensure_smbus2_installed` helpers and PCA9535 register constants are duplicated across scripts rather than shared — match that if adding a new standalone script, or factor them out deliberately.
- PCA9535 pin changes should read-modify-write the output and config registers so other pins on the port are untouched. `WISUN.set_io1_6_output_low` and `IO_Exp.set_port1_pins_output_high` currently write the whole Port1 output register, which clobbers other bits.
- Pins are named `IO<port>_<bit>` after the PCA9535 datasheet (e.g. IO1_6 = Port1 bit 6); GPIO numbers are BCM.
- `ADS1015.py` mentions a `VOLTAGE_CORRECTION_FACTOR` in `Control_Pilot.py` that doesn't exist yet.
