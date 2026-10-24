/*
  Posture Bot — Arduino side
  ===========================
  The laptop does all the camera / AI work and sends ONE letter per line over USB:

    G  = good posture  -> calm eyebrows, green LED, quiet
    B  = bad posture   -> angry eyebrows, red LED, beeps every second
    J  = jumpscare     -> eyebrows flap, siren, red LED strobes (~1.5 s), then stays angry

  TEST WITHOUT THE WEB APP: open Tools > Serial Monitor (9600 baud, "Newline"),
  type B, G or J and press Enter.

  !! Close the Serial Monitor before connecting the web app — only one program
     can use the COM port at a time.

  Wiring (change the pin numbers below if yours differ):
    Left eyebrow servo   signal -> D9    (red -> 5V, brown/black -> GND)
    Right eyebrow servo  signal -> D10
    Buzzer               +      -> D8,   - -> GND
    Red LED   (+ 220Ω resistor) -> D7
    Green LED (+ 220Ω resistor) -> D6

  If the board resets or servos jitter when they move, it's a power issue:
  add a 100-470µF capacitor across the servo 5V/GND, or power servos from a separate 5V supply
  (keep GND shared with the Arduino).
*/

#include <Servo.h>

// ---------- Pins ----------
const int PIN_BROW_LEFT  = 9;
const int PIN_BROW_RIGHT = 10;
const int PIN_BUZZER     = 8;
const int PIN_LED_RED    = 7;
const int PIN_LED_GREEN  = 6;

// ---------- Eyebrow angles (TUNE THESE once brows are glued to the plush) ----------
// The two servos face opposite directions, so "angry" is mirrored.
const int LEFT_CALM   = 90;
const int LEFT_ANGRY  = 55;
const int RIGHT_CALM  = 90;
const int RIGHT_ANGRY = 125;

// ---------- Buzzer ----------
const int BEEP_FREQ_HZ  = 2000;
const int BEEP_LEN_MS   = 120;
const unsigned long BEEP_EVERY_MS = 1000;

Servo browLeft;
Servo browRight;

enum Mood { CALM, ANGRY };
Mood mood = CALM;
unsigned long lastBeep = 0;

void setCalm() {
  mood = CALM;
  browLeft.write(LEFT_CALM);
  browRight.write(RIGHT_CALM);
  digitalWrite(PIN_LED_RED, LOW);
  digitalWrite(PIN_LED_GREEN, HIGH);
  noTone(PIN_BUZZER);
}

void setAngry() {
  mood = ANGRY;
  browLeft.write(LEFT_ANGRY);
  browRight.write(RIGHT_ANGRY);
  digitalWrite(PIN_LED_RED, HIGH);
  digitalWrite(PIN_LED_GREEN, LOW);
  lastBeep = 0; // beep right away
}

// Blocking on purpose: it's only ~1.5 s and keeps the code simple.
void jumpscare() {
  digitalWrite(PIN_LED_GREEN, LOW);
  for (int i = 0; i < 6; i++) {
    bool up = (i % 2 == 0);
    browLeft.write(up ? LEFT_ANGRY : LEFT_CALM);
    browRight.write(up ? RIGHT_ANGRY : RIGHT_CALM);
    digitalWrite(PIN_LED_RED, up ? HIGH : LOW);
    tone(PIN_BUZZER, up ? 2500 : 1500);
    delay(250);
  }
  noTone(PIN_BUZZER);
  setAngry(); // stay angry until the laptop says G
}

void handleCommand(char c) {
  switch (c) {
    case 'G': case 'g': setCalm();   Serial.println("ACK G"); break;
    case 'B': case 'b': setAngry();  Serial.println("ACK B"); break;
    case 'J': case 'j': jumpscare(); Serial.println("ACK J"); break;
    case '\n': case '\r': case ' ': break; // ignore line endings
    default:
      Serial.print("UNKNOWN ");
      Serial.println(c);
  }
}

void setup() {
  Serial.begin(9600); // must match CONFIG.baudRate in web/src/config.ts
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  browLeft.attach(PIN_BROW_LEFT);
  browRight.attach(PIN_BROW_RIGHT);
  setCalm();
  Serial.println("READY");
}

void loop() {
  while (Serial.available() > 0) {
    handleCommand((char)Serial.read());
  }

  // While angry, chirp once per second without blocking.
  if (mood == ANGRY && millis() - lastBeep >= BEEP_EVERY_MS) {
    lastBeep = millis();
    tone(PIN_BUZZER, BEEP_FREQ_HZ, BEEP_LEN_MS);
  }
}
