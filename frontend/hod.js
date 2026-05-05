const API_URL = "http://localhost:5000/auth";

// Get token from localStorage
let token = localStorage.getItem("token");

// --- Check for token on page load ---
if (!token) {
  console.warn("No token found — redirecting to login...");
  window.location.href = "login.html"; // change to your actual login page
} else {
  console.log("✅ Token found. Loading data...");
  loadTeachers();
  loadSubjects();
}

// --- Add Teacher ---
document.getElementById("teacherForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const teacherData = {
    name: document.getElementById("teacherName").value,
    email: document.getElementById("teacherEmail").value,
    password: document.getElementById("teacherPassword").value,
  };

  try {
    const res = await fetch(`${API_URL}/register-teacher`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(teacherData),
    });

    const data = await res.json();
    document.getElementById("teacherMessage").innerText = data.message || data.error;

    document.getElementById("teacherForm").reset();
    await loadTeachers(); // Refresh table
  } catch (err) {
    console.error(err);
    document.getElementById("teacherMessage").innerText = "Failed to add teacher.";
  }
});

// --- Assign Subject ---
document.getElementById("subjectForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const teacherId = document.getElementById("teacherSelect").value;
  const subject = document.getElementById("subjectInput").value;

  if (!teacherId) {
    document.getElementById("subjectMessage").innerText = "Select a teacher first!";
    return;
  }

  try {
    const res = await fetch(`${API_URL}/assign-subject`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ teacherId, subject }),
    });

    const data = await res.json();
    document.getElementById("subjectMessage").innerText = data.message || data.error;

    document.getElementById("subjectForm").reset();
    await loadTeachers(); // Refresh table
  } catch (err) {
    console.error(err);
    document.getElementById("subjectMessage").innerText = "Failed to assign subject.";
  }
});

// --- Load Teachers Table & Populate Dropdown ---
async function loadTeachers() {
  try {
    const res = await fetch(`${API_URL}/teachers`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      console.warn("Unauthorized — token may be invalid or expired.");
      localStorage.removeItem("token");
      window.location.href = "login.html";
      return;
    }

    const data = await res.json();
    const teachers = data.data || [];

    // Populate Table
    const table = document.getElementById("teacherTable");
    table.innerHTML = "";
    teachers.forEach((teacher) => {
      table.innerHTML += `
        <tr>
          <td>${teacher.name}</td>
          <td>${teacher.email}</td>
          <td>${teacher.status || "Active"}</td>
          <td>${Array.isArray(teacher.subjects) ? teacher.subjects.join(", ") : ""}</td>
        </tr>
      `;
    });

    // Populate Dropdown
    const select = document.getElementById("teacherSelect");
    select.innerHTML = '<option value="">Select Teacher</option>';
    teachers.forEach((teacher) => {
      const option = document.createElement("option");
      option.value = teacher._id;
      option.text = teacher.name;
      select.add(option);
    });
  } catch (err) {
    console.error("Failed to load teachers:", err);
  }
}
async function loadSubjects(){

try{

const res = await fetch("http://localhost:5000/ask/subjects")

const data = await res.json()

const dropdown = document.getElementById("subjectInput")

dropdown.innerHTML = '<option value="">Select Subject</option>'

if(data.success && data.subjects){

data.subjects.forEach(subject=>{

const option = document.createElement("option")

option.value = subject
option.text = subject

dropdown.appendChild(option)

})

}

}catch(err){

console.error("Subject load error:",err)

}

}