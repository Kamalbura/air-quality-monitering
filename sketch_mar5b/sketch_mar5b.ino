#include <Adafruit_AHTX0.h>

Adafruit_AHTX0 aht;

void setup() {
  Serial.begin(115200);
  while (!Serial) delay(10);  // Wait for Serial monitor to be ready

  if (!aht.begin()) {
    Serial.println("Failed to initialize AHT sensor! Check your wiring.");
    while (1) delay(10);
  }
  Serial.println("AHT sensor initialized successfully.");
}

void loop() {
  sensors_event_t humidity, temp;
  aht.getEvent(&humidity, &temp);

  Serial.print("Temperature: ");
  Serial.print(temp.temperature);
  Serial.print(" °C\tHumidity: ");
  Serial.print(humidity.relative_humidity);
  Serial.println(" %");

  delay(2000);  // Delay between readings
}
