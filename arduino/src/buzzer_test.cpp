// Connection test: upload with the "buzzer_test" environment (see platformio.ini).
// If the upload worked, every second the buzzer on D2 beeps, the board's built-in
// "L" LED blinks, and "alive" is printed to the Serial Monitor.
#include <Arduino.h>

const int BUZZER_PIN = 2;

void setup() {
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  tone(BUZZER_PIN, 2000, 200);
  Serial.println("alive");
  delay(1000);
  digitalWrite(LED_BUILTIN, LOW);
  delay(1000);
}
