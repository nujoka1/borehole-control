# User guide

Production dashboard: <https://nujoka1.github.io/borehole-control/>

## Sign in

Use the email and password assigned by the system owner. Access is based on the
device membership role:

- **Owner:** full assigned-device access and administration responsibility.
- **Operator:** monitoring and permitted operational commands.
- **Viewer:** monitoring without pump-control authority.

Do not share accounts. Report unexpected access or command history immediately.

## Home screen

The home screen shows the latest tank level, pump state, control mode, sensor
health and whether the ESP32 is online. “Online” describes recent cloud contact;
it does not prove that the pump, relay or sensor is physically healthy.

## Automatic mode

Automatic mode is recommended for normal operation. The ESP32 starts filling at
or below the lower threshold and stops at the upper threshold. This decision is
made locally, so temporary internet loss does not remove the upper-limit logic.

## Manual mode

Manual mode is for supervised operation. Select manual mode before requesting a
pump state. The ESP32 can reject a start request when sensing is invalid, data
is stale, the tank is already at the upper limit or a runtime lockout is active.

Never use the app as the only emergency isolation method. Use the installed
electrical isolator when the pump or wiring is unsafe.

## History and alerts

- **History** displays recent valid tank readings.
- **Alerts** displays system events and command delivery status.
- A pending command has not yet been accepted by the ESP32.
- An acknowledged command includes the device result.
- A rejected command should be investigated rather than repeatedly retried.

## Settings

Keep at least five percentage points between start and stop thresholds. Confirm
the physical tank depth before changing calibration. Settings are applied only
after the ESP32 receives and validates the command.

## Common problems

| Symptom | Check |
|---|---|
| Device offline | Controller power, Wi-Fi availability, router internet access |
| Level unavailable | Sensor power, ECHO voltage, alignment and obstructions |
| Pump will not start | Mode, sensor health, upper limit, runtime lockout, relay circuit |
| Reading is inaccurate | Usable depth, mounting offset and sensor mounting position |
| Command remains pending | ESP32 connectivity and device token assignment |

## Maintenance

- Inspect the tank sensor mount and enclosure monthly.
- Check for moisture, corrosion, loose terminals and damaged cables.
- Test the electrical overload and isolation equipment on the manufacturer’s
  recommended schedule.
- Review alerts after power failures or unusual pump behavior.
