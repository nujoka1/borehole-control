# Verification checklist

Record date, tester, board revision, sensor model, relay model, supply voltage,
tank dimensions and firmware checksum for every commissioned controller.

## Software

- [ ] Native control tests pass.
- [ ] PlatformIO firmware build passes.
- [ ] Arduino sketch build passes when that delivery path is used.
- [ ] Dashboard tests, type check, lint and production build pass.
- [ ] APK signature and package identity are verified.

## Low-voltage hardware

- [ ] GPIO wiring matches the documented pin table.
- [ ] No supply-to-ground short exists before power-up.
- [ ] ESP32 supply voltage remains stable during relay switching.
- [ ] ECHO voltage is safe for GPIO 14.
- [ ] Relay input polarity is confirmed without a connected pump.
- [ ] Controller returns the relay to OFF during boot and sensor failure.

## Calibration and behavior

- [ ] Tank depth and mounting offset were physically measured.
- [ ] At least five manual readings agree with the dashboard within the agreed tolerance.
- [ ] Automatic start occurs at the lower threshold.
- [ ] Automatic stop occurs at the upper threshold.
- [ ] Maximum-runtime lockout stops the relay.
- [ ] Manual unsafe-start requests are rejected.
- [ ] Wi-Fi loss does not stop local automatic safety logic.
- [ ] Power interruption recovers to a safe state.

## Electrical and field commissioning

- [ ] Qualified electrician approved contactor, breaker, overload and earthing.
- [ ] Pump current is within equipment ratings.
- [ ] Enclosure and cable entries are suitable for the environment.
- [ ] Emergency isolation is accessible and labeled.
- [ ] Multiple complete fill cycles were observed without abnormal behavior.

Do not mark the installation commissioned while any safety-critical item is
unchecked or unresolved.
