# Smart Water Tank - Arduino IDE sketch

This folder is an Arduino IDE-compatible copy of the production PlatformIO
firmware. Open `Kahalla_Borehole_Control.ino`; keep every file in this folder
together when copying or sharing the sketch.

## Arduino IDE requirements

1. Install the `esp32 by Espressif Systems` board package. Version `2.0.14`
   matches the PlatformIO build; the sketch was also compiled successfully with
   Arduino ESP32 version `3.3.11`.
2. Install `ArduinoJson` version `7.4.3` from Library Manager (`7.4.2` was also
   compile-tested successfully).
3. Install `WiFiManager` version `2.0.17` by tzapu from Library Manager.
4. Select **Tools > Board > ESP32 Arduino > ESP32 Dev Module**.
5. Select the ESP32 serial port, then click **Upload**.

`WiFi`, `HTTPClient`, `Preferences`, and `WiFiClientSecure` are included with
the ESP32 board package and do not need separate installation.

## Private configuration

`secrets.h` contains the assigned device token and live API endpoints. Send it
privately with the sketch, but never commit it to GitHub or publish it. The
included `secrets.example.h` is only a safe template.

The sketch first tries the Wi-Fi credentials in `secrets.h`. If that network is
unavailable, it opens a temporary access point named `Kachalla-Tank-xxxx` for
Wi-Fi setup.

Do not reuse one device token on multiple ESP32 boards. Provision a separate
device code and token for each production controller.
