const API_URL = "http://localhost:5000/auth";

// Always fetch the latest token
function getToken(){
  return localStorage.getItem("token");
}

if (!getToken()) {
  console.warn("No token found — redirecting to login...");
  window.location.href = "login.html";
} else {
  console.log("✅ Token found. Loading Admin Panel...");
  initializeAdminPanel();
}
async function loadStudentCount(){

const token = localStorage.getItem("token")

try{

const res = await fetch("http://localhost:5000/auth/students-count",{
headers:{
"Authorization":`Bearer ${getToken()}`
}
})

const data = await res.json()

if(data.success){

document.getElementById("studentCount").innerText = data.count

}

}catch(err){

console.error("Student count error:",err)

}

}
async function loadSubjects(){

try{

const res = await fetch("http://localhost:5000/ask/subjects")

const data = await res.json()

if(data.subjects){

document.getElementById("subjectCount").innerText = data.subjects.length

}

}catch(err){

console.error("Error loading subjects:",err)

}

}
// --- Initialize all data ---
async function initializeAdminPanel() {
  try {
    await loadHODs();
    await loadTeachers();
    await loadStudentCount()
    await loadSubjects()
  } catch (err) {
    console.error("Error initializing admin panel:", err);
  }
}

// --- Register HOD ---
document.getElementById("hodForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const hodData = {
    name: document.getElementById("hodName").value,
    email: document.getElementById("hodEmail").value,
    password: document.getElementById("hodPassword").value,
    department: document.getElementById("hodDepartment").value,
  };

  try {
    const res = await fetch(`${API_URL}/register-hod`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(hodData),
    });

    const data = await res.json();
    document.getElementById("hodMessage").innerText = data.message || data.error;

    if (res.status === 401) {
      console.warn("Unauthorized — invalid or expired token.");
      localStorage.removeItem("token");
      window.location.href = "login.html";
      return;
    }

    await loadHODs(); // refresh table
  } catch (err) {
    console.error("Error registering HOD:", err);
    document.getElementById("hodMessage").innerText = "Error registering HOD.";
  }
});

// --- Fetch all HODs ---
async function loadHODs() {
  try {
    const res = await fetch(`${API_URL}/hods`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    if (res.status === 401) {
      console.warn("Unauthorized — invalid or expired token.");
      localStorage.removeItem("token");
      window.location.href = "login.html";
      return;
    }

    const data = await res.json();
    const table = document.getElementById("hodTable");
    const dropdown = document.getElementById("teacherHod");
    document.getElementById("hodCount").innerText = data.data.length

    table.innerHTML = "";
    dropdown.innerHTML = '<option value="">Select HOD</option>';

    if (data.success && Array.isArray(data.data)) {
      data.data.forEach((hod) => {
        // Fill table
        table.innerHTML += `
          <tr>
            <td>${hod.name}</td>
            <td>${hod.email}</td>
            <td>${hod.department}</td>
          </tr>
        `;
        // Fill dropdown
        const option = document.createElement("option");
        option.value = hod._id;
        option.text = hod.name;
        dropdown.appendChild(option);
      });
    } else {
      table.innerHTML = `<tr><td colspan="3">${data.error || "No HODs found"}</td></tr>`;
    }
  } catch (err) {
    console.error("Error fetching HODs:", err);
    const table = document.getElementById("hodTable");
    table.innerHTML = `<tr><td colspan="3">Error fetching HODs</td></tr>`;
  }
}

// --- Fetch all Teachers ---
async function loadTeachers() {
  try {
    const res = await fetch(`${API_URL}/teachers`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    if (res.status === 401) {
      console.warn("Unauthorized — invalid or expired token.");
      localStorage.removeItem("token");
      window.location.href = "login.html";
      return;
    }

    const data = await res.json();
    const table = document.getElementById("teacherTable");
    table.innerHTML = "";
    document.getElementById("teacherCount").innerText = data.data.length

    if (data.success && Array.isArray(data.data)) {
      data.data.forEach((teacher) => {
        table.innerHTML += `
          <tr>
            <td>${teacher.name}</td>
            <td>${teacher.email}</td>
            <td>${teacher.status || "Active"}</td>
            <td>${teacher.hodName || "-"}</td>
          </tr>
        `;
      });
    } else {
      table.innerHTML = `<tr><td colspan="4">${data.error || "No teachers found"}</td></tr>`;
    }
  } catch (err) {
    console.error("Error fetching teachers:", err);
  }
}

// --- Register Teacher ---
document.getElementById("teacherForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const teacherData = {
    name: document.getElementById("teacherName").value,
    email: document.getElementById("teacherEmail").value,
    password: document.getElementById("teacherPassword").value,
    hodId: document.getElementById("teacherHod").value,
  };

  try {
    const res = await fetch(`${API_URL}/register-teacher`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(teacherData),
    });

    const data = await res.json();
    document.getElementById("teacherMessage").innerText = data.message || data.error;

    if (res.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "login.html";
      return;
    }

    if (data.success) {
      document.getElementById("teacherForm").reset();
      await loadTeachers();
    }
  } catch (err) {
    console.error("Error registering teacher:", err);
    document.getElementById("teacherMessage").innerText = "Error registering teacher.";
  }
});
