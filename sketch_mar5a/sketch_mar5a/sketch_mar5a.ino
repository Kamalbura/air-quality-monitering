#include <WiFi.h>
#include <HTTPClient.h>
#include <ThingSpeak.h>
#include <Adafruit_AHTX0.h>
#include <SDS011.h>

const char* SSID = "D-LINK";
const char* PASSWORD = "vasavicc";

// Include generated ThingSpeak config
#include "thingspeak_config.h"

// Use values from thingspeak_config.h
// const unsigned long THINGSPEAK_CHANNEL_ID = 2863798;
// const char* THINGSPEAK_WRITE_API_KEY = "PV514C353A367A3J"; 
// const char* THINGSPEAK_READ_API_KEY = "RIXYDDDMXDBX9ALI";

WiFiClient client;

Adafruit_AHTX0 aht;
SDS011 sds;

unsigned long previousMillis = 0;
const long interval = 10000;

void setup() {
  Serial.begin(115200);

  // Initialize Wi-Fi
  Serial.println("Connecting to Wi-Fi...");
  WiFi.begin(SSID, PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting...");
  }
  Serial.println("Wi-Fi connected.");

  // Initialize ThingSpeak with the correct channel ID
  ThingSpeak.begin(client);

  // Initialize AHT10 sensor
  if (!aht.begin()) {
    Serial.println("Failed to initialize AHT10 sensor!");
    while (1);
  }

  // Initialize SDS011 sensor
  sds.begin(14, 12); // Use GPIO14 as RX and GPIO12 as TX
  Serial.println("Sensors initialized successfully.");
}

void loop() {
  unsigned long currentMillis = millis();

  // Check if it's time to read sensors and send data
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;

    // Read temperature and humidity from AHT10
    sensors_event_t humidity, temp;
    aht.getEvent(&humidity, &temp);
    float temperature = temp.temperature;
    float humidityValue = humidity.relative_humidity;

    // Read PM2.5 and PM10 from SDS011
    float pm25, pm10;
    int error = sds.read(&pm25, &pm10);

    if (error == 0) {
      Serial.println("Sensor readings:");
      Serial.print("Temperature: "); Serial.println(temperature);
      Serial.print("Humidity: "); Serial.println(humidityValue);
      Serial.print("PM2.5: "); Serial.println(pm25);
      Serial.print("PM10: "); Serial.println(pm10);

      // Push data to ThingSpeak
      ThingSpeak.setField(1, humidityValue);    // Field1 = Humidity
      ThingSpeak.setField(2, temperature);      // Field2 = Temperature 
      ThingSpeak.setField(3, pm25);             // Field3 = PM2.5
      ThingSpeak.setField(4, pm10);             // Field4 = PM10

      int responseCode = ThingSpeak.writeFields(THINGSPEAK_CHANNEL_ID, THINGSPEAK_WRITE_API_KEY);
      if (responseCode == 200) {
        Serial.println("Data sent to ThingSpeak successfully.");
      } else {
        Serial.print("Failed to send data. Error code: "); Serial.println(responseCode);
        
        // Handle specific error codes
        switch (responseCode) {
          case -301:
            Serial.println("Failed to connect to ThingSpeak server");
            break;
          case -302:
            Serial.println("Unexpected response from server");
            break;
          case -303:
            Serial.println("Unable to parse response");
            break;
          case -304:
            Serial.println("Timeout waiting for server response");
            break;
          case -401:
            Serial.println("Invalid field number specified");
            break;
          case 0:
            Serial.println("ThingSpeak returned 0 - check API key");
            break;
          default:
            Serial.println("Unknown error");
        }
      }
    } else {
      Serial.println("Failed to read data from SDS011 sensor.");
    }
  }

  // Handle Wi-Fi reconnection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi disconnected. Reconnecting...");
    WiFi.begin(SSID, PASSWORD);
    while (WiFi.status() != WL_CONNECTED) {
      delay(1000);
      Serial.println("Reconnecting...");
    }
    Serial.println("Wi-Fi reconnected.");
  }
}