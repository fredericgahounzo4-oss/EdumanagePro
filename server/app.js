require("./lib/asyncErrors"); // erreurs des routes asynchrones -> réponse JSON (et non plus de blocage / erreur 504)
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api", (req, res) => res.json({ status: "SchoolManager Pro API en cours d'exécution." }));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/ecoles", require("./routes/ecoles"));
app.use("/api/students", require("./routes/students"));
app.use("/api/reference", require("./routes/reference"));
app.use("/api/notes", require("./routes/notes"));
app.use("/api/attendance", require("./routes/attendance"));
app.use("/api/results", require("./routes/results"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/bulletin", require("./routes/bulletin"));
app.use("/api/export", require("./routes/export"));
app.use("/api/teachers", require("./routes/teachers"));
app.use("/api/timetable", require("./routes/timetable"));
app.use("/api/exams", require("./routes/exams"));
app.use("/api/matieres", require("./routes/matieres"));
app.use("/api/settings", require("./routes/settings").router);
app.use("/api/mon-espace", require("./routes/portail-eleve"));
app.use("/api/ecolage", require("./routes/ecolage"));
app.use("/api/parents", require("./routes/parents"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/cartes", require("./routes/cartes"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/classes", require("./routes/classes"));
app.use("/api/stats", require("./routes/stats"));
app.use("/api/conseil", require("./routes/conseil"));
app.use("/api/cron", require("./routes/cron"));

// Erreurs non interceptées (ex : upload multer trop volumineux) -> réponse JSON propre
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Erreur serveur" });
});

module.exports = app;
