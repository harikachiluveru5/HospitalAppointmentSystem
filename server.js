
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: "hospital-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 3600000,
        httpOnly: true
    }
}));

// Frontend
app.use(express.static(path.join(__dirname, "public")));

// Database connection
const db = new sqlite3.Database(
    path.join(__dirname, "database", "hospital.db"),
    (err) => {
        if (err) {
            console.log("Database connection failed:", err.message);
        } else {
            console.log("Hospital database connected!");
        }
    }
);

// Create database tables and default records
db.serialize(() => {

    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'patient'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS doctors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        specialization TEXT NOT NULL,
        experience INTEGER,
        fee REAL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER,
        doctor_id INTEGER,
        appointment_date TEXT,
        status TEXT DEFAULT 'Booked',
        FOREIGN KEY(patient_id) REFERENCES users(id),
        FOREIGN KEY(doctor_id) REFERENCES doctors(id)
    )`);

    // Insert default doctors
    const doctors = [
        ["Dr. Ravi Kumar", "Cardiology", 10, 500],
        ["Dr. Priya Sharma", "Dermatology", 8, 400],
        ["Dr. Arjun Reddy", "Neurology", 12, 600]
    ];

    doctors.forEach(doctor => {
        db.run(
            `INSERT INTO doctors
             (name, specialization, experience, fee)
             SELECT ?, ?, ?, ?
             WHERE NOT EXISTS (
                 SELECT 1 FROM doctors WHERE name = ?
             )`,
            [...doctor, doctor[0]],
            (err) => {
                if (err) {
                    console.log("Doctor insertion error:", err.message);
                }
            }
        );
    });

    // Create or update Admin account
    db.run(
        `INSERT INTO users (name, email, password, role)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET
         password = excluded.password,
         role = 'admin'`,
        [
            "Admin",
            "admin@hospital.com",
            bcrypt.hashSync("Admin@123", 10),
            "admin"
        ],
        (err) => {
            if (err) {
                console.log("Admin creation error:", err.message);
            } else {
                console.log("Admin account ready!");
            }
        }
    );
});

// Login verification middleware
function requireLogin(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({
            message: "Please login first"
        });
    }

    next();
}

// Admin verification middleware
function requireAdmin(req, res, next) {
    if (!req.session.user || req.session.user.role !== "admin") {
        return res.status(403).json({
            message: "Admin access required"
        });
    }

    next();
}

// Patient Registration
app.post("/api/register", async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({
            message: "All fields are required"
        });
    }

    try {
        const cleanEmail = email.trim().toLowerCase();
        const hashedPassword = await bcrypt.hash(password, 10);

        db.run(
            `INSERT INTO users (name, email, password)
             VALUES (?, ?, ?)`,
            [name.trim(), cleanEmail, hashedPassword],
            function(err) {
                if (err) {
                    return res.status(400).json({
                        message: "Email already registered or invalid details"
                    });
                }

                res.json({
                    message: "Registration successful",
                    userId: this.lastID
                });
            }
        );
    } catch (error) {
        console.log("Registration error:", error.message);

        res.status(500).json({
            message: "Registration failed"
        });
    }
});

// Patient and Admin Login
app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;

    console.log("Login attempt received for:", email);

    if (!email || !password) {
        return res.status(400).json({
            message: "Email and password are required"
        });
    }

    const cleanEmail = email.trim().toLowerCase();

    db.get(
        "SELECT * FROM users WHERE email = ?",
        [cleanEmail],
        async (err, user) => {
            if (err) {
                console.log("Database login error:", err.message);

                return res.status(500).json({
                    message: "Login database error"
                });
            }

            if (!user) {
                console.log("User not found:", cleanEmail);

                return res.status(401).json({
                    message: "Invalid email or password"
                });
            }

            try {
                const valid = await bcrypt.compare(
                    password,
                    user.password
                );

                console.log("Password verification:", valid);

                if (!valid) {
                    return res.status(401).json({
                        message: "Invalid email or password"
                    });
                }

                req.session.user = {
                    id: user.id,
                    name: user.name,
                    role: user.role
                };

                req.session.save((sessionError) => {
                    if (sessionError) {
                        console.log("Session error:", sessionError.message);

                        return res.status(500).json({
                            message: "Session creation failed"
                        });
                    }

                    console.log("Login successful:", user.role);

                    res.json({
                        message: "Login successful",
                        user: req.session.user
                    });
                });

            } catch (error) {
                console.log("Password verification error:", error.message);

                res.status(500).json({
                    message: "Login verification failed"
                });
            }
        }
    );
});

// Logout
app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                message: "Logout failed"
            });
        }

        res.json({
            message: "Logged out successfully"
        });
    });
});

// Current user
app.get("/api/me", requireLogin, (req, res) => {
    res.json(req.session.user);
});

// Doctor listing and specialization search
app.get("/api/doctors", (req, res) => {
    const specialization = req.query.specialization || "";

    let sql = "SELECT * FROM doctors";
    let params = [];

    if (specialization.trim()) {
        sql += " WHERE specialization LIKE ?";
        params.push(`%${specialization.trim()}%`);
    }

    db.all(sql, params, (err, doctors) => {
        if (err) {
            return res.status(500).json({
                message: "Error fetching doctors"
            });
        }

        res.json(doctors);
    });
});

// Book appointment
app.post("/api/appointments", requireLogin, (req, res) => {
    const { doctor_id, appointment_date } = req.body;

    if (!doctor_id || !appointment_date) {
        return res.status(400).json({
            message: "Doctor and date are required"
        });
    }

    const selectedDate = new Date(appointment_date);

    if (
        Number.isNaN(selectedDate.getTime()) ||
        selectedDate <= new Date()
    ) {
        return res.status(400).json({
            message: "Choose a valid future appointment date"
        });
    }

    db.get(
        "SELECT id FROM doctors WHERE id = ?",
        [doctor_id],
        (err, doctor) => {
            if (err || !doctor) {
                return res.status(404).json({
                    message: "Doctor not found"
                });
            }

            db.run(
                `INSERT INTO appointments
                 (patient_id, doctor_id, appointment_date)
                 VALUES (?, ?, ?)`,
                [
                    req.session.user.id,
                    doctor_id,
                    appointment_date
                ],
                function(err) {
                    if (err) {
                        return res.status(500).json({
                            message: "Booking failed"
                        });
                    }

                    res.json({
                        message: "Appointment booked successfully",
                        appointmentId: this.lastID
                    });
                }
            );
        }
    );
});

// View patient appointments
app.get("/api/appointments", requireLogin, (req, res) => {
    db.all(
        `SELECT a.*, d.name AS doctor_name,
         d.specialization
         FROM appointments a
         JOIN doctors d ON a.doctor_id = d.id
         WHERE a.patient_id = ?
         ORDER BY a.appointment_date`,
        [req.session.user.id],
        (err, appointments) => {
            if (err) {
                return res.status(500).json({
                    message: "Error fetching appointments"
                });
            }

            res.json(appointments);
        }
    );
});

// Cancel appointment
app.put(
    "/api/appointments/:id/cancel",
    requireLogin,
    (req, res) => {
        db.run(
            `UPDATE appointments
             SET status = 'Cancelled'
             WHERE id = ? AND patient_id = ?
             AND status = 'Booked'`,
            [req.params.id, req.session.user.id],
            function(err) {
                if (err) {
                    return res.status(500).json({
                        message: "Cancellation failed"
                    });
                }

                if (this.changes === 0) {
                    return res.status(404).json({
                        message: "Appointment not found or already cancelled"
                    });
                }

                res.json({
                    message: "Appointment cancelled successfully"
                });
            }
        );
    }
);

// Admin dashboard
app.get(
    "/api/admin/appointments",
    requireAdmin,
    (req, res) => {
        db.all(
            `SELECT a.*, u.name AS patient_name,
             u.email, d.name AS doctor_name,
             d.specialization
             FROM appointments a
             JOIN users u ON a.patient_id = u.id
             JOIN doctors d ON a.doctor_id = d.id
             ORDER BY a.appointment_date`,
            [],
            (err, appointments) => {
                if (err) {
                    return res.status(500).json({
                        message: "Error fetching appointments"
                    });
                }

                res.json(appointments);
            }
        );
    }
);

// Start server
app.listen(PORT, () => {
    console.log(
        `Hospital Appointment System running at http://localhost:${PORT}`
    );
});
