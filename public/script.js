
function showSection(sectionId) {
    document.querySelectorAll(".section").forEach(section => {
        section.classList.remove("active");
    });

    document.getElementById(sectionId).classList.add("active");

    if (sectionId === "doctors") loadDoctors();
    if (sectionId === "appointments") loadAppointments();
}

// Patient Registration
document.getElementById("registerForm").addEventListener("submit", async function(e) {
    e.preventDefault();

    const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: document.getElementById("regName").value,
            email: document.getElementById("regEmail").value,
            password: document.getElementById("regPassword").value
        })
    });

    const result = await response.json();
    document.getElementById("registerMessage").textContent = result.message;

    if (response.ok) this.reset();
});

// Login
document.getElementById("loginForm").addEventListener("submit", async function(e) {
    e.preventDefault();

    const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: document.getElementById("loginEmail").value,
            password: document.getElementById("loginPassword").value
        })
    });

    const result = await response.json();
    document.getElementById("loginMessage").textContent = result.message;

    if (response.ok) {
        alert("Welcome " + result.user.name);
        this.reset();
        showSection(result.user.role === "admin" ? "admin" : "doctors");
    }
});

// Load Doctors
async function loadDoctors() {
    const specialization = document.getElementById("specialization").value;

    const response = await fetch(
        "/api/doctors?specialization=" + encodeURIComponent(specialization)
    );

    const doctors = await response.json();
    const doctorList = document.getElementById("doctorList");

    doctorList.innerHTML = "";

    if (doctors.length === 0) {
        doctorList.innerHTML = "<p>No doctors found.</p>";
        return;
    }

    doctors.forEach(doctor => {
        doctorList.innerHTML += `
            <div class="doctor-card">
                <h3>${doctor.name}</h3>
                <p>Specialization: ${doctor.specialization}</p>
                <p>Experience: ${doctor.experience} years</p>
                <p>Consultation Fee: ₹${doctor.fee}</p>
                <input type="date" id="date-${doctor.id}">
                <button onclick="bookAppointment(${doctor.id})">
                    Book Appointment
                </button>
            </div>
        `;
    });
}

// Book Appointment
async function bookAppointment(doctorId) {
    const appointmentDate = document.getElementById("date-" + doctorId).value;

    if (!appointmentDate) {
        alert("Please select an appointment date.");
        return;
    }

    const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            doctor_id: doctorId,
            appointment_date: appointmentDate
        })
    });

    const result = await response.json();
    alert(result.message);

    if (response.ok) loadAppointments();
}

// View My Appointments
async function loadAppointments() {
    const response = await fetch("/api/appointments");
    const appointmentList = document.getElementById("appointmentList");

    if (!response.ok) {
        appointmentList.innerHTML = "<p>Please login first to view appointments.</p>";
        return;
    }

    const appointments = await response.json();
    appointmentList.innerHTML = "";

    if (appointments.length === 0) {
        appointmentList.innerHTML = "<p>No appointments found.</p>";
        return;
    }

    appointments.forEach(appointment => {
        appointmentList.innerHTML += `
            <div class="appointment-card">
                <h3>${appointment.doctor_name}</h3>
                <p>Specialization: ${appointment.specialization}</p>
                <p>Date: ${appointment.appointment_date}</p>
                <p>Status: ${appointment.status}</p>
                ${appointment.status === "Booked" ?
                    `<button onclick="cancelAppointment(${appointment.id})">
                        Cancel Appointment
                    </button>` : ""}
            </div>
        `;
    });
}

// Cancel Appointment
async function cancelAppointment(id) {
    if (!confirm("Are you sure you want to cancel this appointment?")) return;

    const response = await fetch(`/api/appointments/${id}/cancel`, {
        method: "PUT"
    });

    const result = await response.json();
    alert(result.message);

    loadAppointments();
}

// Admin Dashboard
async function loadAdminAppointments() {
    const response = await fetch("/api/admin/appointments");
    const adminList = document.getElementById("adminList");

    if (!response.ok) {
        adminList.innerHTML = "<p>Admin login required.</p>";
        return;
    }

    const appointments = await response.json();
    adminList.innerHTML = "";

    if (appointments.length === 0) {
        adminList.innerHTML = "<p>No appointments available.</p>";
        return;
    }

    appointments.forEach(a => {
        adminList.innerHTML += `
            <div class="appointment-card">
                <h3>${a.patient_name}</h3>
                <p>Patient Email: ${a.email}</p>
                <p>Doctor: ${a.doctor_name}</p>
                <p>Specialization: ${a.specialization}</p>
                <p>Date: ${a.appointment_date}</p>
                <p>Status: ${a.status}</p>
            </div>
        `;
    });
}

// Logout
async function logout() {
    const response = await fetch("/api/logout", { method: "POST" });
    const result = await response.json();
    alert(result.message);
    showSection("home");
}
