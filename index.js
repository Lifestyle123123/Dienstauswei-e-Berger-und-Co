const express = require("express");
const session = require("express-session");
const axios = require("axios");
const sharp = require("sharp");

const app = express();

app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: "supersecret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 60 * 1000 }, // 30 min
  })
);

const USER = "Test";
const PASS = "TestPW";

const PORT = process.env.PORT || 3000;

const CSS = `
body {
  font-family: 'Segoe UI', sans-serif;
  background: radial-gradient(circle, #4e54c8, #8f94fb);
  color: #222;
  margin: 0;
  padding: 0;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.container {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 0 15px rgba(0,0,0,0.2);
}
h1 {
  text-align: center;
  color: #4e54c8;
}
form {
  display: flex;
  flex-direction: column;
}
label {
  margin-top: 10px;
  font-weight: bold;
}
input {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 6px;
}
button {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #4e54c8;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
}
button:hover {
  background: #3b40a4;
}
.error {
  color: red;
  text-align: center;
  margin-top: 1rem;
}
.logout {
  text-align: right;
  margin-bottom: 1rem;
}
.logout a {
  color: #4e54c8;
  text-decoration: none;
}
.logout a:hover {
  text-decoration: underline;
}
`;

// 🔒 Auth middleware
function requireAuth(req, res, next) {
  if (req.session.loggedIn) {
    next();
  } else {
    res.redirect("/login");
  }
}

// 🔐 Login-Seite
app.get("/login", (req, res) => {
  const error = req.query.error ? `<p class="error">Falsche Anmeldedaten!</p>` : "";
  res.send(`
  <html><head><style>${CSS}</style><title>Login</title></head><body>
  <div class="container">
    <h1>Login</h1>
    <form method="POST" action="/login">
      <label>Benutzername</label>
      <input name="username" required />
      <label>Passwort</label>
      <input type="password" name="password" required />
      <button type="submit">Einloggen</button>
    </form>
    ${error}
  </div>
  </body></html>
  `);
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === USER && password === PASS) {
    req.session.loggedIn = true;
    req.session.username = username;
    res.redirect("/");
  } else {
    res.redirect("/login?error=1");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

app.get("/", requireAuth, (req, res) => {
  res.send(`
  <html><head><style>${CSS}</style><title>Dienstausweis</title></head><body>
  <div class="container">
  <div class="logout"><a href="/logout">Logout</a></div>
  <h1>Dienstausweis Generator</h1>
  <form method="POST" action="/generate">
    <label>Name</label>
    <input name="name" required />
    <label>Dienstnummer</label>
    <input name="dienstnummer" required />
    <label>Rang</label>
    <input name="rang" required />
    <label>Unterschrift</label>
    <input name="unterschrift" required />
    <label>Roblox Profil-Link</label>
    <input name="robloxLink" required placeholder="https://www.roblox.com/users/ID/profile" />
    <button type="submit">Ausweis generieren</button>
  </form>
  </div>
  </body></html>
  `);
});

// 📸 Roblox-Avatar laden
async function fetchAvatar(userId) {
  const url = `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png`;
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data, "binary");
}

function parseRobloxId(url) {
  const match = url.match(/users\/(\d+)\//);
  return match?.[1] || null;
}

// 🪄 Ausweis erstellen
async function generateCard(data, avatar) {
  const canvas = sharp({
    create: {
      width: 600,
      height: 350,
      channels: 4,
      background: "#fff"
    }
  });

  const circleAvatar = await sharp(avatar)
    .resize(150, 150)
    .composite([{ input: Buffer.from(`<svg><circle cx="75" cy="75" r="75"/></svg>`), blend: "dest-in" }])
    .png()
    .toBuffer();

  const svgText = `
  <svg width="600" height="350">
    <rect width="600" height="350" fill="#fff"/>
    <text x="200" y="50" font-size="24" fill="#4e54c8" font-family="Segoe UI" font-weight="bold">ANWALTSKANZLEI BERGER & CO</text>
    <text x="200" y="100" font-size="18" fill="#333" font-family="Segoe UI">Name: ${data.name}</text>
    <text x="200" y="130" font-size="18" fill="#333" font-family="Segoe UI">Dienstnummer: ${data.dienstnummer}</text>
    <text x="200" y="160" font-size="18" fill="#333" font-family="Segoe UI">Rang: ${data.rang}</text>
    <text x="200" y="190" font-size="18" fill="#333" font-family="Segoe UI">Unterschrift: ${data.unterschrift}</text>
  </svg>`;

  const card = await canvas
    .composite([
      { input: circleAvatar, top: 100, left: 20 },
      { input: Buffer.from(svgText), top: 0, left: 0 }
    ])
    .jpeg()
    .toBuffer();

  return card;
}

app.post("/generate", requireAuth, async (req, res) => {
  try {
    const { name, dienstnummer, rang, unterschrift, robloxLink } = req.body;
    const userId = parseRobloxId(robloxLink);

    if (!userId) {
      return res.send(`<html><head><style>${CSS}</style></head><body><div class="container"><p class="error">Ungültiger Roblox-Link! <a href="/">Zurück</a></p></div></body></html>`);
    }

    const avatar = await fetchAvatar(userId);
    const card = await generateCard({ name, dienstnummer, rang, unterschrift }, avatar);

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Content-Disposition", `attachment; filename="${name}_dienstausweis.jpg"`);
    res.send(card);

  } catch (err) {
    console.error(err);
    res.send(`<html><head><style>${CSS}</style></head><body><div class="container"><p class="error">Fehler beim Generieren! <a href="/">Zurück</a></p></div></body></html>`);
  }
});

app.listen(PORT, () => console.log(`🚀 Server läuft: http://localhost:${PORT}`));
