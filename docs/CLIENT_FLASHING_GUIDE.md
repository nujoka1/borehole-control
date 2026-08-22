# Client flashing guide

This guide is for installing the prepared Kahalla Borehole Control firmware on
an ESP32 Dev Module. It does not cover mains pump wiring.

## Choose one flashing method

### Method A: precompiled full image

Use `Kahalla-Borehole-Control-full.bin` for the simplest first installation on
a blank ESP32. It contains the bootloader, partition table and application and
must be written at address `0x0`.

Install Python and `esptool`, then connect the ESP32 by a data-capable USB cable:

```bash
python -m pip install esptool
esptool --chip esp32 --port COM5 --baud 460800 write-flash 0x0 Kahalla-Borehole-Control-full.bin
```

Replace `COM5` with the detected port. Linux commonly uses `/dev/ttyUSB0` or
`/dev/ttyACM0`. If the board does not enter download mode, hold **BOOT**, start
the command, then release **BOOT** when writing begins.

Do not write the ordinary `firmware.bin` at `0x0`; that application-only image
belongs at `0x10000` and is insufficient for a blank device.

### Method B: Arduino IDE

Open `Kahalla_Borehole_Control.ino` inside its matching
`Kahalla_Borehole_Control` folder. Keep the adjacent `.cpp`, `.h` and private
`secrets.h` files in that same folder.

Install:

- `esp32 by Espressif Systems`; select **ESP32 Dev Module**
- `ArduinoJson` 7.4.3
- `WiFiManager` 2.0.17 by tzapu

Select the serial port and click **Upload**. The sketch has been compile-tested
with the Arduino ESP32 3.3.11 toolchain. ESP32 Arduino 2.0.14 matches the
PlatformIO framework used by the main firmware build.

## First boot

1. Power the low-voltage controller without connecting the pump mains circuit.
2. Open Serial Monitor at `115200` baud.
3. If the configured Wi-Fi cannot be reached within 20 seconds, connect a phone
   to the `Kahalla-Pump-xxxx` access point.
4. Select the installation Wi-Fi network and enter its password.
5. Confirm the status LED changes to the connected state.
6. Sign in to the dashboard and confirm the device eventually becomes online.

## Security warning

The private firmware package contains a device token. Send it only through a
private channel. Never place `secrets.h` or a credential-bearing binary in a
public repository. Provision a separate device code and token for every ESP32.

## Verification boundary

A successful upload confirms only that the software reached the ESP32. Before
connecting a pump, complete the hardware checks in
[Installation and wiring](INSTALLATION_AND_WIRING.md).
