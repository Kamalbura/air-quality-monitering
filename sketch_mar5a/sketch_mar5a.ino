#include <SDS011.h>

SDS011 sds;

void setup() {
  Serial.begin(115200);
  // Initialize the SDS011 sensor.
  // Parameter 1: ESP32 TX pin (to SDS011 RX)
  // Parameter 2: ESP32 RX pin (from SDS011 TX) – here using D25.
  sds.begin(14, 12); 
  Serial.println("SDS011 sensor test started.");
}

void loop() {
  float pm25, pm10;
  int error = sds.read(&pm25, &pm10);
  if (error == 0) {
    Serial.print("PM2.5: ");
    Serial.print(pm25);
    Serial.print("  PM10: ");
    Serial.println(pm10);
  } else {
    Serial.println("Failed to read from SDS011 sensor.");
  }
  delay(2000); // Read every 2 seconds
}
