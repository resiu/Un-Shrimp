// Posture Bot hardware: RGB LED + buzzer, driven by the web app over USB serial
// (web/src/lib/arduino.ts). The app sends one line of text at a time, ending in '\n':
//   "37"  shrimp score 0-100 (0 = straight, 100 = full shrimp), about 5 times a second
//           below SLOUCH_THRESHOLD -> green, at or above -> yellow-orange
//   "J"   jumpscare -> red + one short beep. Stays red until a score below the
//           threshold arrives (posture fixed). A repeated "J" while red doesn't beep again.
//   "O"   LED off (not calibrated yet)
// Anything else is ignored.
#include <Arduino.h>

// PWM pins, so brightness can be set (0-255) for mixed colors like yellow-orange.
const int RED_PIN = 9;
const int GREEN_PIN = 10;
const int BLUE_PIN = 11; // tone() borrows this pin's timer while beeping; blue is never lit then
const int BUZZER_PIN = 2;

// Set to true if the LED's long leg goes to 5V (common anode) instead of GND.
const bool COMMON_ANODE = false;

// Must match SLOUCH_SCORE in web/src/lib/arduino.ts (the app's slouch threshold).
const int SLOUCH_THRESHOLD = 50;

const unsigned long BAUD = 9600;     // must match arduinoBaud in web/src/config.ts
const unsigned int BEEP_HZ = 2000;
const unsigned long BEEP_MS = 200;

const int MAX_LINE = 8; // longest valid line is "100"; anything longer is junk

char line[MAX_LINE + 1];
int lineLen = 0;
bool lineTooLong = false;
bool red = false; // jumpscare state: stay red until posture is fixed

void setColor(int r, int g, int b) {
  analogWrite(RED_PIN, COMMON_ANODE ? 255 - r : r);
  analogWrite(GREEN_PIN, COMMON_ANODE ? 255 - g : g);
  analogWrite(BLUE_PIN, COMMON_ANODE ? 255 - b : b);
}

void green() { setColor(0, 255, 0); }
void yellowOrange() { setColor(255, 90, 0); }
void ledRed() { setColor(255, 0, 0); }
void off() { setColor(0, 0, 0); }

/** "0".."100" -> the number; anything else (empty, letters, too big) -> -1. */
int parseScore(const char *s) {
  if (*s == '\0') return -1;
  int value = 0;
  for (; *s; s++) {
    if (*s < '0' || *s > '9') return -1;
    value = value * 10 + (*s - '0');
    if (value > 100) return -1;
  }
  return value;
}

void handleLine(const char *s) {
  if (strcmp(s, "J") == 0) {
    if (!red) {
      red = true;
      ledRed();
      tone(BUZZER_PIN, BEEP_HZ, BEEP_MS);
    }
    return;
  }
  if (strcmp(s, "O") == 0) {
    red = false;
    off();
    return;
  }
  int score = parseScore(s);
  if (score < 0) return; // malformed: ignore
  if (score < SLOUCH_THRESHOLD) {
    red = false; // posture fixed: back to normal
    green();
  } else if (!red) {
    yellowOrange();
  }
}

void setup() {
  pinMode(RED_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
  pinMode(BLUE_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  off();
  Serial.begin(BAUD);
}

void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\r') continue;
    if (c == '\n') {
      line[lineLen] = '\0';
      if (!lineTooLong) handleLine(line);
      lineLen = 0;
      lineTooLong = false;
    } else if (lineLen < MAX_LINE) {
      line[lineLen++] = c;
    } else {
      lineTooLong = true; // keep reading until the newline, then drop the whole line
    }
  }
}
