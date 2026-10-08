/**
 * Hand-drawn ASCII agent room (clerk, desk, computer, wall portrait, files).
 * Inspired by Piotr’s “ASCII STYLE PREVIEWS” sheet — not a photo conversion.
 * Mockup only. Not copied from ascii.rest source.
 */

const W = 46;

function line(s: string): string {
  if (s.length > W) {
    throw new Error(`ASCII room line is ${s.length} cols, max ${W}: ${JSON.stringify(s)}`);
  }
  return s.padEnd(W, " ");
}

function frame(rows: string[]): string {
  return rows.map(line).join("\n");
}

/** Cursor on, smoke low. */
export const ROOM_FRAME_0 = frame([
  "+--------------------------------------------+",
  "| +------+                      +----+       |",
  "| | .--. |                      |====|       |",
  "| |(o  o)|   WIKTORIA CUKT 2.0  |====| FILES |",
  "| | \\__/ |                      |====|       |",
  "| |  \\/  |                      +----+       |",
  "| +------+                                   |",
  "|                                            |",
  "|                     .                      |",
  "|   .----------.    ( )      .-----.         |",
  "|   | .------. |   /   \\    /  o o  \\        |",
  "|   | | >_   | |   |___|    |   -   |        |",
  "|   | '------' |            |  /|\\  |        |",
  "|   |    ||    |            |  / \\  |        |",
  "|   '----------'            '-------'        |",
  "| ========================================   |",
  "+--------------------------------------------+",
]);

/** Cursor off, smoke mid. */
export const ROOM_FRAME_1 = frame([
  "+--------------------------------------------+",
  "| +------+                      +----+       |",
  "| | .--. |                      |====|       |",
  "| |(o  o)|   WIKTORIA CUKT 2.0  |====| FILES |",
  "| | \\__/ |                      |====|       |",
  "| |  \\/  |                      +----+       |",
  "| +------+                                   |",
  "|                    .                       |",
  "|                     '                      |",
  "|   .----------.    ( )      .-----.         |",
  "|   | .------. |   /   \\    /  o o  \\        |",
  "|   | | >_   | |   |___|    |   -   |        |",
  "|   | '------' |            |  /|\\  |        |",
  "|   |    ||    |            |  / \\  |        |",
  "|   '----------'            '-------'        |",
  "| ========================================   |",
  "+--------------------------------------------+",
]);

/** Block cursor, smoke high, a glyph on the screen. */
export const ROOM_FRAME_2 = frame([
  "+--------------------------------------------+",
  "| +------+                      +----+       |",
  "| | .--. |                      |====|       |",
  "| |(o  o)|   WIKTORIA CUKT 2.0  |====| FILES |",
  "| | \\__/ |                      |====|       |",
  "| |  \\/  |                      +----+       |",
  "| +------+                                   |",
  "|                   '                        |",
  "|                    .                       |",
  "|   .----------.    ( )      .-----.         |",
  "|   | .------. |   /   \\    /  o o  \\        |",
  "|   | | >_#  | |   |___|    |   -   |        |",
  "|   | '------' |            |  /|\\  |        |",
  "|   |    ||    |            |  / \\  |        |",
  "|   '----------'            '-------'        |",
  "| ========================================   |",
  "+--------------------------------------------+",
]);

/** Cursor off, smoke drift, clerk blinks. */
export const ROOM_FRAME_3 = frame([
  "+--------------------------------------------+",
  "| +------+                      +----+       |",
  "| | .--. |                      |====|       |",
  "| |(o  o)|   WIKTORIA CUKT 2.0  |====| FILES |",
  "| | \\__/ |                      |====|       |",
  "| |  \\/  |                      +----+       |",
  "| +------+                                   |",
  "|                  .                         |",
  "|                     .                      |",
  "|   .----------.    ( )      .-----.         |",
  "|   | .------. |   /   \\    /  - -  \\        |",
  "|   | | >_   | |   |___|    |   -   |        |",
  "|   | '------' |            |  /|\\  |        |",
  "|   |    ||    |            |  / \\  |        |",
  "|   '----------'            '-------'        |",
  "| ========================================   |",
  "+--------------------------------------------+",
]);

export const ROOM_FRAMES = [ROOM_FRAME_0, ROOM_FRAME_1, ROOM_FRAME_2, ROOM_FRAME_3];

/** Wall strip (portrait + files) for the chat header backdrop. */
export const ROOM_BANNER_LINES = 8;

export const ROOM_ALT =
  "ASCII drawing of an agent room: a portrait of Wiktoria Cukt 2.0 hanging on the wall, a clerk at a desk with a computer, a coffee cup, and a filing cabinet.";
