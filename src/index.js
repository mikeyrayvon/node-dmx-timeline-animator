#!/usr/bin/env node

import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DMX, EnttecUSBDMXProDriver, Animation } from "dmx-ts";
import { program } from "commander";

// Setup CLI options
program
  .name("node src/index.js")
  .description("Play DMX timelines from JSON files")
  .version("1.0.0")
  .option("-t, --timeline <path>", "Path to timeline JSON file")
  .option("-p, --presets <path>", "Path to presets JSON file")
  .option(
    "-d, --device <path>",
    "DMX device path",
    "/dev/tty.usbserial-EN365093"
  )
  .option("-s, --start <seconds>", "Start time in seconds", "0")
  .option("-l, --loop", "Loop the timeline", false)
  .option(
    "-i, --interval <minutes>",
    "Pause interval between loops in minutes",
    "0"
  )
  .option(
    "-w, --wait <seconds>",
    "Initial delay before starting the animation in seconds",
    "0"
  )
  .parse(process.argv);

const options = program.opts();

// Resolve file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const timelineFilePath =
  options.timeline || path.join(process.cwd(), "timeline.json");
const presetsFilePath =
  options.presets || path.join(process.cwd(), "presets.json");
const devicePath = options.device;
const startTime = parseFloat(options.start);
const shouldLoop = options.loop;
const loopInterval = parseFloat(options.interval) * 60 * 1000; // Convert minutes to milliseconds
const initialDelay = parseFloat(options.wait) * 1000; // Convert seconds to milliseconds

// Utility functions
async function loadFile(filePath) {
  try {
    const data = await fs.readFile(filePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error loading file ${filePath}:`, error);
    process.exit(1);
  }
}

async function initializeDMX() {
  try {
    const dmx = new DMX();
    const driver = new EnttecUSBDMXProDriver(devicePath, {
      dmxSpeed: 30,
    });
    const universe = await dmx.addUniverse("demo", driver);
    console.log("DMX initialized successfully");
    return { dmx, universe };
  } catch (error) {
    console.error("Failed to initialize DMX:", error);
    process.exit(1);
  }
}

function createAnimation(timelineEvents, presets, duration, startTime = 0) {
  const sortedEvents = [...timelineEvents].sort((a, b) => a.time - b.time);
  const animation = new Animation();

  // Start with all channels at 0
  const initialState = {};
  for (let i = 1; i <= 512; i++) {
    initialState[i] = 0;
  }

  // Find the last event before the start time
  let lastEventBeforeStart = sortedEvents
    .filter((event) => event.time <= startTime)
    .pop();
  let currentState = { ...initialState };

  if (lastEventBeforeStart) {
    if (
      lastEventBeforeStart.type === "custom" &&
      lastEventBeforeStart.channels
    ) {
      lastEventBeforeStart.channels.forEach((value, index) => {
        currentState[index + 1] = value;
      });
    } else if (lastEventBeforeStart.type === "preset") {
      const preset = presets.find(
        (p) => p.name === lastEventBeforeStart.presetName
      );
      if (preset) {
        preset.channels.forEach((value, index) => {
          currentState[index + 1] = value;
        });
      }
    }
  }

  // Add the initial state at the start time
  animation.add(currentState, 0);

  let lastEventTime = startTime;

  for (let i = 0; i < sortedEvents.length; i++) {
    const event = sortedEvents[i];
    if (event.time < startTime) continue;

    const eventDuration = (event.time - lastEventTime) * 1000; // Duration since the last event

    let targetState = { ...currentState };

    if (event.type === "custom" && event.channels) {
      event.channels.forEach((value, index) => {
        targetState[index + 1] = value;
      });
    } else if (event.type === "preset") {
      const preset = presets.find((p) => p.name === event.presetName);
      if (preset) {
        preset.channels.forEach((value, index) => {
          targetState[index + 1] = value;
        });
      }
    }

    // Add the animation step to transition to the new state
    animation.add(targetState, eventDuration);

    // Update the current state and last event time for the next iteration
    currentState = targetState;
    lastEventTime = event.time;
  }

  // If the last event is before the timeline duration, add a final state
  if (lastEventTime < duration) {
    const finalDuration = (duration - lastEventTime) * 1000;
    animation.add(currentState, finalDuration);
  }

  return animation;
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);
  return `${minutes}:${remainingSeconds
    .toString()
    .padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
}

async function main() {
  if (shouldLoop) {
    console.log("Loop enabled");
  }
  if (loopInterval > 0) {
    console.log(`Loop interval: ${loopInterval}ms`);
  }
  if (initialDelay > 0) {
    console.log(`Initial delay: ${initialDelay / 1000}s`);
  }
  console.log(`Loading timeline from: ${timelineFilePath}`);
  console.log(`Loading presets from: ${presetsFilePath}`);

  // Load timeline and presets
  const timeline = await loadFile(timelineFilePath);
  const presets = await loadFile(presetsFilePath);

  // Validate timeline structure
  if (
    !timeline.events ||
    !Array.isArray(timeline.events) ||
    !timeline.duration
  ) {
    console.error(
      "Invalid timeline format. Expected { events: [...], duration: number }"
    );
    process.exit(1);
  }

  console.log(
    `Timeline loaded: ${timeline.events.length} events, duration: ${timeline.duration}s`
  );
  console.log(`Presets loaded: ${presets.length} presets`);

  // Initialize DMX
  const { dmx, universe } = await initializeDMX();

  // Keep track of the current animation for cleanup
  let currentAnimation = null;

  // Function to run the animation
  const runAnimation = () => {
    console.log(`Creating animation (starting at ${formatTime(startTime)})...`);
    const animation = createAnimation(
      timeline.events,
      presets,
      timeline.duration,
      startTime
    );

    console.log(`Starting animation (duration: ${timeline.duration}s)...`);

    // Store animation reference for cleanup
    currentAnimation = animation;

    // Run the animation with a callback for completion
    if (shouldLoop) {
      if (loopInterval > 0) {
        // Custom loop with pause interval
        animation.run(universe);

        // Set a timeout to handle the loop with pause
        const totalDuration = (timeline.duration - startTime) * 1000;
        setTimeout(() => {
          console.log(
            `Animation completed. Pausing for ${options.interval} minutes before next loop...`
          );

          // Set all channels to 0 during the pause
          const blackoutState = {};
          for (let i = 1; i <= 512; i++) {
            blackoutState[i] = 0;
          }
          universe.update(blackoutState);

          // Wait for the specified interval, then run again
          setTimeout(runAnimation, loopInterval);
        }, totalDuration + 500); // Add a small buffer
      } else {
        // Standard loop without pause
        animation.runLoop(universe);
      }
    } else {
      // For non-looping animations, we need to handle completion manually
      animation.run(universe);

      // Set a timeout to detect when animation is complete
      const totalDuration = (timeline.duration - startTime) * 1000;
      setTimeout(() => {
        console.log("Animation completed");
        process.exit(0);
      }, totalDuration + 500); // Add a small buffer
    }
  };

  function handleShutdown() {
    console.log("\nStopping animation...");
    if (currentAnimation) {
      currentAnimation.stop();
    }

    // Set all channels to 0
    const blackoutState = {};
    for (let i = 1; i <= 512; i++) {
      blackoutState[i] = 0;
    }
    universe.update(blackoutState);
    console.log("All DMX channels set to 0");

    setTimeout(() => {
      console.log("Animation stopped");
      process.exit(0);
    }, 500);
  }

  // Handle various termination signals
  process.on("SIGINT", handleShutdown); // Ctrl+C
  process.on("SIGTERM", handleShutdown); // systemctl stop
  process.on("SIGQUIT", handleShutdown); // Keyboard quit

  // Start the animation
  if (initialDelay > 0) {
    console.log(`Waiting ${initialDelay / 1000} seconds before starting...`);
    setTimeout(runAnimation, initialDelay);
  } else {
    runAnimation();
  }
}

// Run the main function
main().catch((error) => {
  console.error("Error running animation:", error);
  process.exit(1);
});
