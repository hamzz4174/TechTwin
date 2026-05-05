  const API_URL = "http://localhost:5000";

  // === Elements ===
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");
  const subjectSelect = document.getElementById("subjectSelect");
  const pdfSelect = document.getElementById("pdfSelect");
  const transcriptEl = document.getElementById("transcript");
  const aiReplyEl = document.getElementById("aiReply");
  const clonePlayer = document.getElementById("clonePlayer");

  // === Voice Clone Sample Recorder ===
  let mediaRec, voiceChunks = [], userVoiceBlob = null;

  async function recordUserVoice() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRec = new MediaRecorder(stream);
    voiceChunks = [];

    mediaRec.ondataavailable = e => voiceChunks.push(e.data);
    mediaRec.onstop = () => {
      userVoiceBlob = new Blob(voiceChunks, { type: "audio/wav" });
      console.log("Voice sample ready");
    };

    mediaRec.start();
    setTimeout(() => mediaRec.stop(), 25000); // 8 sec sample
  }

  // === Load Subjects ===
  async function loadSubjects() {
    try {
      const res = await fetch(`${API_URL}/ask/subjects`);
      const data = await res.json();
      subjectSelect.innerHTML = data.subjects.map(s => `<option>${s}</option>`).join("");
    } catch {
      subjectSelect.innerHTML = `<option>Error loading</option>`;
    }
  }
  loadSubjects();

  // === Load PDFs ===
  subjectSelect.addEventListener("change", async () => {
    const s = subjectSelect.value;
    try {
      const res = await fetch(`${API_URL}/ask/pdfs/${encodeURIComponent(s)}`);
      const data = await res.json();
      pdfSelect.innerHTML = data.pdfs.map(p => `<option>${p}</option>`).join("");
    } catch (err) {
      console.error("PDF load error:", err);
      pdfSelect.innerHTML = `<option>Error loading PDFs</option>`;
    }
  });

  // === Speech Recognition ===
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognizer = new SpeechRecognition();
  recognizer.lang = "en-IN";
  recognizer.interimResults = true;

  let finalTranscript = "";

  recognizer.onresult = ev => {
    let interim = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (r.isFinal) finalTranscript += r[0].transcript;
      else interim += r[0].transcript;
    }
    transcriptEl.innerText = finalTranscript + (interim ? " — " + interim : "");
  };

  recognizer.onend = async () => {
    stopBtn.disabled = true;
    startBtn.disabled = false;
    if (finalTranscript.trim()) {
      addMessage(finalTranscript,"user") 
      await sendToAI(finalTranscript.trim());
      finalTranscript = "";
    }
  };

  // === Buttons ===
 startBtn.onclick = () => {

document.body.classList.add("listening")

recognizer.start()

}

stopBtn.onclick = () => {

document.body.classList.remove("listening")

recognizer.stop()

}
  // === Send to AI ===
async function sendToAI(text){
  let user = {};
  try {
    const userStr = localStorage.getItem("user");
    if (userStr && userStr !== "undefined") user = JSON.parse(userStr);
  } catch (e) { console.warn("User parse error", e); }
  
  const userId = user._id || user.id;
  const subject=document.getElementById("subjectSelect").value;
  const pdf=document.getElementById("pdfSelect").value;

  console.log(`[Voice] Sending question: "${text}" to /ask...`);

  if (window.showTyping) window.showTyping();
  else showTyping();

  try {
    const res=await fetch(`${API_URL}/ask`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({question:text,subject,pdf, userId})
    });

    const data=await res.json();
    console.log("[Voice] Received data from /ask:", data);

    if (window.removeTyping) window.removeTyping();
    else removeTyping();

    const answer = data.answer || "Sorry, I could not generate a response.";
    
    if (window.addMessage) {
      console.log("[Voice] Using window.addMessage to show answer");
      window.addMessage(`<strong style="color:var(--lavender)"><i class='bx bx-brain'></i> AI (Voice)</strong><br><br>${answer}`, "ai");
    } else {
      console.log("[Voice] Using local addMessage to show answer");
      addMessage(answer, "ai");
    }
    speakInUserVoice(answer);
  } catch (err) {
    console.error("[Voice] Fetch error:", err);
    if (window.removeTyping) window.removeTyping();
    if (window.addMessage) window.addMessage("⚠️ System error while contacting AI.", "ai");
  }
}

async function loadVoices(){

const res = await fetch("http://localhost:5000/auth/voices")

const data = await res.json()

const select = document.getElementById("voiceSelect")

select.innerHTML=""

data.voices.forEach(v=>{

const option=document.createElement("option")

option.value=v.voice_id
option.text=v.name

select.appendChild(option)

})

}

loadVoices()

speechSynthesis.onvoiceschanged = loadVoices
function speakInUserVoice(text){
  const voiceId = document.getElementById("voiceSelect").value;
  const url = `http://localhost:5000/speak?text=${encodeURIComponent(text)}&voiceId=${voiceId}`;

  clonePlayer.src = url;
  clonePlayer.type = "audio/mpeg";

  clonePlayer.play().catch(e => {
    console.warn("ElevenLabs failed (likely payment issue), falling back to Browser Voice:", e);
    // FALLBACK: Use Web Speech API
    const utterance = new SpeechSynthesisUtterance(text);
    const selectedVoiceId = document.getElementById("voiceSelect").value;
    // Try to match browser voice if possible, else just speak
    window.speechSynthesis.speak(utterance);
  });
}
function addMessage(text,type){

const div=document.createElement("div")
div.classList.add("message",type)

document.getElementById("chatMessages").appendChild(div)

if(type==="ai"){

let i=0

function type(){
if(i<text.length){
div.innerHTML+=text.charAt(i)
i++
setTimeout(type,20)
}
}

type()

}else{
div.innerText=text
}

div.scrollIntoView()

}
function showTyping(){

const typing=document.createElement("div")

typing.classList.add("typing")
typing.id="typing"

typing.innerHTML=`
<div class="dot"></div>
<div class="dot"></div>
<div class="dot"></div>
`

document.getElementById("chatMessages").appendChild(typing)

typing.scrollIntoView()

}

function removeTyping(){

const typing=document.getElementById("typing")

if(typing) typing.remove()

}
function stopSpeech(){
speechSynthesis.cancel()
}