<?php
$API_KEY = "sk_5497758fe0ac3bf940ffbea949f1e2ac9b648059773ee037";
$VOICE_ID = "CwhRBWXzGAHq8TQ4Fs17"; // Bella

$text = isset($_POST['text']) ? $_POST['text'] : "Hello, I am your AI teacher.";

$ch = curl_init("https://api.elevenlabs.io/v1/text-to-speech/$VOICE_ID");

$data = [
  "text" => $text,
  "model_id" => "eleven_multilingual_v2",
  "voice_settings" => [
    "stability" => 0.4,
    "similarity_boost" => 0.8
  ]
];

curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => [
    "Content-Type: application/json",
    "xi-api-key: $API_KEY"
  ],
  CURLOPT_POSTFIELDS => json_encode($data),

  // 🔥 FORCE SSL BYPASS
  CURLOPT_SSL_VERIFYPEER => false,
  CURLOPT_SSL_VERIFYHOST => false,
]);

$audio = curl_exec($ch);

if (curl_errno($ch)) {
  echo "Curl error: " . curl_error($ch);
  exit;
}

header("Content-Type: audio/mpeg");
echo $audio;
