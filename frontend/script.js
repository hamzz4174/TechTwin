function openSubject(name){

localStorage.setItem("subject",name)

window.location.href="lectures.html"

}

function openLecture(topic){

localStorage.setItem("lecture",topic)

window.location.href="material.html"

}

function sendMsg(){

let msg=document.getElementById("msg").value

let chat=document.getElementById("chat")

chat.innerHTML+=`<div class="user">You: ${msg}</div>`

chat.innerHTML+=`<div class="ai">AI: I will help you with "${msg}"</div>`

document.getElementById("msg").value=""

}