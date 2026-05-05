<?php
$ch = curl_init("https://api.elevenlabs.io/v1/voices");
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => ["xi-api-key: sk_5497758fe0ac3bf940ffbea949f1e2ac9b648059773ee037"],
  CURLOPT_SSL_VERIFYPEER => false,
  CURLOPT_SSL_VERIFYHOST => false
]);
$res = curl_exec($ch);

if (!$res) {
  echo "CURL ERROR: " . curl_error($ch);
} else {
  echo $res;
}
