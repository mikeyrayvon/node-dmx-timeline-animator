# Node DMX Timeline Animator

A Node.js command-line tool for playing DMX lighting timelines from JSON files.

## Overview

DMX Timeline Player allows you to control DMX lighting fixtures according to pre-programmed timelines defined in JSON files. It's designed to run on any system that supports Node.js, including Raspberry Pi, making it ideal for automated lighting installations, exhibitions, or performances.

## Features

- Play DMX timelines from JSON configuration files
- Support for custom channel values and presets
- Start playback from any point in the timeline
- Loop playback with configurable intervals
- Compatible with Enttec USB DMX Pro interfaces
- Graceful shutdown with blackout on exit

## Requirements

- Node.js (v14 or newer)
- Enttec USB DMX Pro interface or compatible
- DMX lighting fixtures

## Installation

### Clone the Repository

```
git clone https://github.com/mikeyrayvon/node-dmx-timeline-animator.git
cd node-dmx-timeline-animator
npm install
```

## Configuration Files

### Timeline File (timeline.json)

```
{
    "events": [
        {
            "time": 0,
            "type": "custom",
            "channels": [255, 0, 0, 0]
        },
        {
            "time": 5,
            "type": "preset",
            "presetName": "blue"
        },
        {
            "time": 10,
            "type": "custom",
            "channels": [0, 0, 255, 255]
        }
    ],
    "duration": 15
}
```

The `channels` array represents DMX values (0-255) for each channel, starting from channel 1. For example, `[255, 0, 0, 0]` sets channel 1 to 255, channel 2 to 0, channel 3 to 0, and channel 4 to 0.

### Presets File (presets.json)

```
[
    {
        "name": "blue",
        "channels": [0, 0, 255, 0]
    },
    {
        "name": "red",
        "channels": [255, 0, 0, 0]
    }
]
```

## Usage

### Command Line Options

Usage: `node src/index.js [options]`

Play DMX timelines from JSON files

Options:

```
-V, --version output the version number
-t, --timeline <path> Path to timeline JSON file
-p, --presets <path> Path to presets JSON file
-d, --device <path>DMX device path (default: "/dev/tty.usbserial-EN365093")
-s, --start <seconds> Start time in seconds (default: "0")
-l, --loop Loop the timeline (default: false)
-i, --interval <minutes> Pause interval between loops in minutes (default: "0")
-h, --help display help for command
```

### Basic Usage

`node src/index.js --device /dev/ttyUSB0 --timeline my-timeline.json --presets my-presets.json`

### Start from a Specific Time

`node src/index.js --start 5.5`

### Loop the Timeline

`node src/index.js --loop`

### Loop with Pause Interval

`node src/index.js --loop --interval 2`

## Running on Raspberry Pi

### Installation

1. Install Node.js on your Raspberry Pi:

```
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs
```

2. Clone the repository:

```
git clone https://github.com/mikeyrayvon/node-dmx-timeline-animator.git
cd node-dmx-timeline-animator
npm install
```

### Autostart on Boot

To make the script run automatically when the Raspberry Pi boots:

1. Create a systemd service file:

`sudo nano /etc/systemd/system/dmx-player.service`

2. Add the following content (adjust paths as needed):

```
[Unit]
Description=DMX Timeline Player
After=multi-user.target

[Service]
Type=simple
ExecStart=/usr/bin/node /home/pi/node-dmx-timeline-animator/src/index.js --device /dev/ttyUSB0
WorkingDirectory=/home/pi/node-dmx-timeline-animator
User=pi
Restart=always

[Install]
WantedBy=multi-user.target
```

3. Enable and start the service:

```
sudo systemctl enable dmx-player.service
sudo systemctl start dmx-player.service
```

## Troubleshooting

- Check the device path for your DMX interface
- Verify your JSON files are properly formatted
- For permission issues with the USB device, you may need to add your user to the dialout group:

`sudo usermod -a -G dialout $USER`

- Check service logs if running as a systemd service:

`sudo journalctl -u dmx-player.service`

## Acknowledgements

This project made possible by these technologies:

- [dmx-ts](https://github.com/node-dmx/dmx-ts)
- [Commander.js](https://github.com/tj/commander.js)
- [Node.js](https://nodejs.org/)
- [Enttec](https://www.enttec.com/)

## License

MIT
