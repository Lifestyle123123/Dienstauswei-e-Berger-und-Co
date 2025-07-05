const express = require("express");
const session = require("express-session");
const fileUpload = require("express-fileupload");
const path = require("path");
const fs = require("fs");

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());
app.use(express.static("public"));

// Session
app.use(
  session({
    secret: "supersecret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 600000 },
  })
);

// sicherstellen, dass Upload-Verzeichnis existiert
const uploadDir = path.join(__dirname, "public/uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// helper
const isAuthenticated = (req, res, next) => {
  if (req.session.loggedIn) return next();
  res.redirect("/login");
};

// HTML-Templates
const layout = (content) => `
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Ausweis Generator</title>
<style>
body {
  font-family: Arial, sans-serif;
  background: #f7f7f7;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  margin: 0;
}
.container {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 0 10px rgba(0,0,0,0.1);
  text-align: center;
  width: 300px;
}
input, button {
  margin: 10px 0;
  padding: 8px;
  width: 90%;
}
.error { color: red; }
.success { color: green; }
</style>
</head>
<body>
<div class="container">
${content}
</div>
</body>
</html>
`;

const loginPage = (error = "") => layout(`
<h1>Login</h1>
<form method="POST" action="/login">
  <input type="text" name="username" placeholder="Benutzername" required><br>
  <input type="password" name="password" placeholder="Passwort" required><br>
  <button type="submit">Einloggen</button>
</form>
${error ? `<p class="error">${error}</p>` : ""}
`);

const generatorPage = (message = "", imageUrl = "") => layout(`
<h1>Ausweis Generator</h1>
${message ? `<p class="${imageUrl ? "success" : "error"}">${message}</p>` : ""}
${imageUrl ? `<img src="${imageUrl}" width="200"><br>` : ""}
<form method="POST" action="/generate" enctype="multipart/form-data">
  <input type="file" name="image" accept="image/*" required><br>
  <button type="submit">Ausweis erstellen</button>
</form>
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
    res.send(loginPage("Falsche Anmeldedaten."));
  }
});

app.get("/generator", isAuthenticated, (req, res) => {
  res.send(generatorPage());
});

app.post("/generate", isAuthenticated, (req, res) => {
  if (!req.files || !req.files.image) {
    return res.send(generatorPage("Bitte lade ein Bild hoch."));
  }

  const img = req.files.image;
  const savePath = path.join(uploadDir, Date.now() + "-" + img.name);

  img.mv(savePath, (err) => {
    if (err) {
      console.error(err);
      return res.send(generatorPage("Fehler beim Speichern des Bildes."));
    }

    const relativePath = "/uploads/" + path.basename(savePath);
    res.send(generatorPage("Ausweis erfolgreich erstellt!", relativePath));
  });
});

// für Vercel:
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Server läuft auf http://localhost:${port}`));
