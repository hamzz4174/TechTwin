<?php
ini_set("display_errors", 1);
error_reporting(E_ALL);

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  http_response_code(405);
  exit("Method not allowed");
}

if (!isset($_FILES["voice"]) || !isset($_POST["text"])) {
  http_response_code(400);
  exit("Missing voice or text");
}

$API_KEY = "sk_5497758fe0ac3bf940ffbea949f1e2ac9b648059773ee037";

$text = substr($_POST["text"], 0, 250);
$tmp = $_FILES["voice"]["tmp_name"];

// =====================
// STEP 1: Create Voice
// =====================
$ch = curl_init("https://api.elevenlabs.io/v1/voices/add");
curl_setopt_array($ch, [
  CURLOPT_HTTPHEADER => ["xi-api-key: $API_KEY"],
  CURLOPT_POST => true,
  CURLOPT_POSTFIELDS => [
    "name" => "user_voice_" . time(),
    "files" => new CURLFile($tmp)
  ],
  CURLOPT_RETURNTRANSFER => true
]);

$response = curl_exec($ch);
if (!$response) {
  http_response_code(500);
  exit("Curl failed while creating voice");
}

$data = json_decode($response, true);
if (!isset($data["voice_id"])) {
  http_response_code(500);
  exit("Voice creation failed:\n$response");
}

$voice_id = $data["voice_id"];

// =====================
// STEP 2: TTS in voice
// =====================
$ch = curl_init("https://api.elevenlabs.io/v1/text-to-speech/$voice_id");
curl_setopt_array($ch, [
  CURLOPT_HTTPHEADER => [
    "xi-api-key: $API_KEY",
    "Content-Type: application/json",
    "Accept: audio/mpeg"
  ],
  CURLOPT_SSL_VERIFYPEER => false,
  CURLOPT_SSL_VERIFYHOST => false,
  CURLOPT_POST => true,
  CURLOPT_POSTFIELDS => json_encode(["text" => $text]),
  CURLOPT_RETURNTRANSFER => true
]);

$audio = curl_exec($ch);

if (!$audio || strpos($audio, "{") === 0) {
  http_response_code(500);
  exit("TTS failed:\n$audio");
}

// =====================
// RETURN AUDIO
// =====================
header("Content-Type: audio/mpeg");
header("Content-Length: " . strlen($audio));
header("Accept-Ranges: bytes");
echo $audio;
