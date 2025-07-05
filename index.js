const express = require("express");
const session = require("express-session");
const fileUpload = require("express-fileupload");
const { createCanvas, loadImage, registerFont } = require("canvas");

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());

app.use(
  session({
    secret: "supersecret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 600000 },
  })
);

const isAuthenticated = (req, res, next) => {
  if (req.session.loggedIn) return next();
  res.redirect("/login");
};

const layout = (content) => `
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Ausweis Generator</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
body {
  margin: 0;
  font-family: 'Inter', sans-serif;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #333;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}
.card {
  background: white;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 8px 20px rgba(0,0,0,0.2);
  text-align: center;
  max-width: 400px;
  width: 100%;
}
h1 {
  margin-top: 0;
  color: #4a5568;
}
form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
input[type=text], input[type=password], input[type=file] {
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}
button {
  padding: 10px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.3s ease;
}
button:hover {
  background: #5a67d8;
}
.message {
  margin-top: 10px;
  font-size: 14px;
}
.error { color: red; }
.success { color: green; }
</style>
</head>
<body>
<div class="card">
${content}
</div>
</body>
</html>
`;

const loginPage = (error = "") => layout(`
<h1>🔐 Login</h1>
<form method="POST" action="/login">
  <input type="text" name="username" placeholder="Benutzername" required>
  <input type="password" name="password" placeholder="Passwort" required>
  <button type="submit">Einloggen</button>
</form>
${error ? `<div class="message error">${error}</div>` : ""}
`);

const generatorPage = (message = "") => layout(`
<h1>🪪 Ausweis Generator</h1>
<p>Fülle die Felder aus und lade dein Bild hoch.</p>
<form method="POST" action="/generate" enctype="multipart/form-data">
  <input type="text" name="rpname" placeholder="RP-Name" required>
  <input type="text" name="dienstnummer" placeholder="Dienstnummer" required>
  <input type="text" name="rang" placeholder="Rang" required>
  <input type="file" name="image" accept="image/*" required>
  <button type="submit">Ausweis erstellen & herunterladen</button>
</form>
${message ? `<div class="message success">${message}</div>` : ""}
`);

app.get("/", (req, res) => {
  res.redirect("/login");
});

app.get("/login", (req, res) => {
  res.send(loginPage());
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "passwort") {
    req.session.loggedIn = true;
    res.redirect("/generator");
  } else {
    res.send(loginPage("❌ Falsche Anmeldedaten."));
  }
});

app.get("/generator", isAuthenticated, (req, res) => {
  res.send(generatorPage());
});

app.post("/generate", isAuthenticated, async (req, res) => {
  const { rpname, dienstnummer, rang } = req.body;
  const imgFile = req.files?.image;

  if (!imgFile) {
    return res.send(generatorPage("⚠️ Bitte lade ein Bild hoch."));
  }

  try {
    const canvasWidth = 700;
    const canvasHeight = 400;

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext("2d");

    // Hintergrund
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Titelband oben
    ctx.fillStyle = "#4a5568";
    ctx.fillRect(0, 0, canvasWidth, 60);
    ctx.fillStyle = "white";
    ctx.font = "bold 24px Arial";
    ctx.fillText("OFFIZIELLER RP AUSWEIS", 20, 40);

    // Bild links
    const img = await loadImage(imgFile.data);
    ctx.fillStyle = "#cbd5e0";
    ctx.fillRect(20, 80, 180, 240);
    ctx.drawImage(img, 20, 80, 180, 240);

    // Linien & Text rechts
    ctx.fillStyle = "#2d3748";
    ctx.font = "20px Arial";
    ctx.fillText("RP-Name:", 220, 120);
    ctx.fillText("Dienstnummer:", 220, 180);
    ctx.fillText("Rang:", 220, 240);
    ctx.fillText("Unterschrift:", 220, 300);

    ctx.fillStyle = "#1a202c";
    ctx.font = "bold 22px Arial";
    ctx.fillText(rpname, 380, 120);
    ctx.fillText(dienstnummer, 380, 180);
    ctx.fillText(rang, 380, 240);
    ctx.fillText(rpname, 380, 300);

    const buffer = canvas.toBuffer("image/png");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=ausweis-${Date.now()}.png`
    );
    res.setHeader("Content-Type", "image/png");
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.send(generatorPage("❌ Fehler beim Erstellen des Ausweises."));
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Server läuft auf http://localhost:${port}`));
