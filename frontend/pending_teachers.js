    // pending_teachers.js
    // ✅ Handles listing + approving of pending teachers for HOD panel

    const API_URL = "http://localhost:5000/auth";
    const token = localStorage.getItem("hodToken") || localStorage.getItem("token");

    // --- Redirect if no token ---
    if (!token) {
      alert("Please login as HOD first!");
      window.location.href = "hod.html";
    }

    // --- Load Pending Teachers ---
    async function loadPendingTeachers() {
      try {
        const res = await fetch(`${API_URL}/teachers`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();

        if (!data.success) {
          console.error(data.error || "Failed to fetch teachers");
          return;
        }

        // Filter only pending teachers
        const pendingTeachers = data.data.filter(t => t.status === "pending");

        const table = document.getElementById("pendingTeachersTable");
        table.innerHTML = "";

        if (pendingTeachers.length === 0) {
          table.innerHTML = `<tr><td colspan="4" style="text-align:center;">✅ No pending teachers</td></tr>`;
          return;
        }

        pendingTeachers.forEach((teacher, index) => {
          table.innerHTML += `
            <tr>
              <td>${index + 1}</td>
              <td>${teacher.name}</td>
              <td>${teacher.email}</td>
              <td>
                <button class="approve-btn" onclick="approveTeacher('${teacher._id}')">
                  Approve
                </button>
              </td>
            </tr>
          `;
        });
      } catch (err) {
        console.error("Error loading teachers:", err);
      }
    }

    // --- Approve Teacher ---
    async function approveTeacher(teacherId) {
      try {
        const res = await fetch(`${API_URL}/approve-teacher/${teacherId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();

        if (data.success) {
          alert("✅ Teacher approved successfully!");
          loadPendingTeachers(); // reload list
        } else {
          alert(`⚠️ ${data.error || "Failed to approve teacher"}`);
        }
      } catch (err) {
        console.error("Error approving teacher:", err);
        alert("Server error while approving teacher");
      }
    }

    // --- Auto load when page opens ---
    document.addEventListener("DOMContentLoaded", loadPendingTeachers);
